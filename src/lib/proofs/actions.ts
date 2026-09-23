"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityEvents,
  notifications,
  orders,
  proofComments,
  proofVersions,
  users,
} from "@/db/schema";
import {
  canSeeAllOrders,
  canUploadProofs,
  isStaff,
  requireStaff,
  requireUser,
} from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import {
  buildStorageKey,
  deleteObject,
  putObject,
} from "@/lib/storage/storage";
import { checkUpload } from "@/lib/storage/uploads";
import { fail, type FormState } from "@/lib/auth/form-state";
import { sendMail } from "@/lib/mail/mailer";
import { paymentRequestMail, proofReadyMail } from "@/lib/mail/templates";
import { clampPin } from "./pins";

/* -------------------------------------------------------------------------- */
/* Designer: upload a proof                                                   */
/* -------------------------------------------------------------------------- */

/**
 * An order carries two proofs at a time: the one the customer last saw, and
 * the one replacing it. Uploading a third drops the oldest, file and all, so
 * there is always exactly one "before" to compare the current artwork against.
 *
 * Version numbers still climb, so "version 7" means the seventh proof drawn
 * even though only six and seven are still on the shelf.
 */
// A "use server" module may only export async functions, so this stays local.
const PROOF_VERSIONS_KEPT = 2;

export async function uploadProofAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();

  // Proofreaders check artwork; they never replace it.
  if (!canUploadProofs(session.user.role)) {
    return fail("Only the assigned designer can upload a proof.");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const file = formData.get("file");

  if (!orderId) return fail("Missing order.");
  if (!(file instanceof File)) return fail("Choose a file to upload.");

  const check = checkUpload({ type: file.type, size: file.size, name: file.name });
  if (!check.ok) return fail(check.reason);

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      userId: orders.userId,
      assignedDesignerId: orders.assignedDesignerId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return fail("That order no longer exists.");

  // A designer may only upload against their own job. Checked here and not
  // only on the page, because the action is reachable on its own.
  if (
    !canSeeAllOrders(session.user.role) &&
    order.assignedDesignerId !== session.user.id
  ) {
    return fail("That order is assigned to another designer.");
  }

  const storageKey = buildStorageKey(`proofs/${order.reference}`, file.name);
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await putObject(storageKey, bytes, check.mimeType);
  } catch (error) {
    console.error("[proofs] upload failed", error);
    return fail(
      "We couldn't store that file. Nothing has changed — please try again.",
    );
  }

  // Version numbers are per order and must not collide if two uploads land
  // together, so the next number is computed inside the insert.
  const nextVersion = sql<number>`(
    select coalesce(max(${proofVersions.versionNumber}), 0) + 1
    from ${proofVersions}
    where ${proofVersions.orderId} = ${orderId}::uuid
  )`;

  await db.insert(proofVersions).values({
    orderId,
    versionNumber: nextVersion,
    storageKey,
    fileName: file.name,
    mimeType: check.mimeType,
    sizeBytes: file.size,
    uploadedById: session.user.id,
    status: "awaiting_proofreading",
  });

  await pruneOldVersions(orderId);

  /**
   * The order's own status deliberately does not move here.
   *
   * This used to set it to "in_production" the moment a designer uploaded a
   * draft — before the proofreader had checked it and before the customer had
   * seen it. The customer's order then read "In production" while the artwork
   * was still being corrected, and it stayed that way even when they asked for
   * changes, because nothing moved it back.
   *
   * Printing starts when the customer approves, and that is the only place
   * that sets it.
   */

  await db.insert(activityEvents).values({
    orderId,
    actorId: session.user.id,
    type: "proof_uploaded",
    summary: `${session.user.name} uploaded a proof for ${order.reference}`,
  });

  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath("/staff");
  revalidatePath("/staff/queue");

  return { ok: true, message: "Proof uploaded and sent for proofreading." };
}

/**
 * Keeps the newest two versions of an order's proof and removes the rest,
 * object storage included.
 *
 * An archived version is never dropped: once an order has been completed its
 * final artwork is kept for the record, whatever else happens afterwards.
 * Storage deletions are best-effort — a file left behind in the bucket is a
 * tidiness problem, but a half-deleted database row is a correctness one, so
 * the row only goes once the object has.
 */
async function pruneOldVersions(orderId: string): Promise<void> {
  const stale = await db
    .select({
      id: proofVersions.id,
      storageKey: proofVersions.storageKey,
      archivedStorageKey: proofVersions.archivedStorageKey,
    })
    .from(proofVersions)
    .where(eq(proofVersions.orderId, orderId))
    .orderBy(desc(proofVersions.versionNumber))
    .offset(PROOF_VERSIONS_KEPT);

  for (const version of stale) {
    if (version.archivedStorageKey) continue;

    try {
      await deleteObject(version.storageKey);
    } catch (error) {
      console.error("[proofs] could not remove superseded file", error);
      continue;
    }

    await db.delete(proofVersions).where(eq(proofVersions.id, version.id));
  }
}

/* -------------------------------------------------------------------------- */
/* Proofreader: approve to the customer, or return to the designer            */
/* -------------------------------------------------------------------------- */

async function latestVersion(orderId: string) {
  const [version] = await db
    .select({
      id: proofVersions.id,
      versionNumber: proofVersions.versionNumber,
      status: proofVersions.status,
    })
    .from(proofVersions)
    .where(eq(proofVersions.orderId, orderId))
    .orderBy(desc(proofVersions.versionNumber))
    .limit(1);

  return version ?? null;
}

export async function sendProofToCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();

  if (session.user.role !== "proofreader" && session.user.role !== "admin") {
    return fail("Only a proofreader can send a proof to the customer.");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const version = await latestVersion(orderId);
  if (!version) return fail("There's no proof to send yet.");

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      userId: orders.userId,
      customerEmail: users.email,
      customerName: users.name,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return fail("That order no longer exists.");

  await db
    .update(proofVersions)
    .set({
      status: "awaiting_customer",
      proofreaderId: session.user.id,
      proofreadAt: new Date(),
      sentToCustomerAt: new Date(),
    })
    .where(eq(proofVersions.id, version.id));

  await db.insert(notifications).values({
    userId: order.userId,
    type: "proof_ready",
    title: `Your proof for ${order.reference} is ready`,
    body: "Have a look and either approve it or tell us what to change.",
    linkUrl: `/account/orders/${order.id}/proof`,
  });

  /**
   * And by email, because nobody sits in the portal waiting.
   *
   * Failing to send must not fail the action: the proofreader has done their
   * part, the version is already marked as sent and the notification is
   * recorded. Losing the email is recoverable — telling the proofreader it
   * failed and leaving them to press the button again is not, because the
   * second press would send the customer a duplicate.
   */
  try {
    await sendMail(
      proofReadyMail(
        order.customerEmail,
        order.customerName,
        order.reference,
        order.id,
      ),
    );
  } catch (error) {
    console.error("[proofs] could not email the customer", error);
  }

  await db.insert(activityEvents).values({
    orderId,
    actorId: session.user.id,
    type: "proof_sent",
    summary: `${session.user.name} sent version ${version.versionNumber} of ${order.reference} to the customer`,
  });

  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath("/staff/queue");

  return { ok: true, message: "Sent to the customer." };
}

export async function returnProofToDesignerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();

  if (session.user.role !== "proofreader" && session.user.role !== "admin") {
    return fail("Only a proofreader can return a proof.");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!notes) return fail("Say what needs changing, so it's clear to fix.");

  const version = await latestVersion(orderId);
  if (!version) return fail("There's no proof to return yet.");

  await db
    .update(proofVersions)
    .set({
      status: "returned_to_designer",
      proofreaderId: session.user.id,
      proofreadAt: new Date(),
      proofreaderNotes: notes,
    })
    .where(eq(proofVersions.id, version.id));

  await db.insert(activityEvents).values({
    orderId,
    actorId: session.user.id,
    type: "proof_returned",
    summary: `${session.user.name} returned version ${version.versionNumber} to the designer`,
    meta: { notes },
  });

  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath("/staff/queue");

  return { ok: true, message: "Returned to the designer with your notes." };
}

/* -------------------------------------------------------------------------- */
/* Assigning a designer                                                       */
/* -------------------------------------------------------------------------- */

export async function assignDesignerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();

  // Designers can't reassign work; that's a proofreader or admin decision.
  if (session.user.role !== "proofreader" && session.user.role !== "admin") {
    return fail("Only a proofreader or an admin can assign work.");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const designerId = String(formData.get("designerId") ?? "");

  if (!orderId) return fail("Missing order.");

  if (designerId) {
    const [designer] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.id, designerId), eq(users.role, "designer")))
      .limit(1);

    if (!designer) return fail("That person isn't a designer.");

    await db
      .update(orders)
      .set({ assignedDesignerId: designer.id, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    await db.insert(activityEvents).values({
      orderId,
      actorId: session.user.id,
      type: "designer_assigned",
      summary: `${session.user.name} assigned the order to ${designer.name}`,
    });
  } else {
    await db
      .update(orders)
      .set({ assignedDesignerId: null, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }

  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath("/staff/queue");

  return { ok: true, message: "Assignment updated." };
}

/* -------------------------------------------------------------------------- */
/* Customer: comment, approve, request changes                                */
/* -------------------------------------------------------------------------- */

/** Confirms this proof belongs to the caller, or to staff looking at it. */
async function proofForViewer(proofVersionId: string) {
  const session = await getSession("site");
  if (!session) return null;

  const [row] = await db
    .select({
      id: proofVersions.id,
      orderId: proofVersions.orderId,
      status: proofVersions.status,
      versionNumber: proofVersions.versionNumber,
      ownerId: orders.userId,
      reference: orders.reference,
      // Needed when approving: whether there is still anything to pay, and
      // what to ask for.
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      customerEmail: users.email,
      customerName: users.name,
    })
    .from(proofVersions)
    .innerJoin(orders, eq(orders.id, proofVersions.orderId))
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(proofVersions.id, proofVersionId))
    .limit(1);

  if (!row) return null;

  const isOwner = row.ownerId === session.user.id;
  if (!isOwner && !isStaff(session.user.role)) return null;

  return { ...row, session, isOwner };
}

export async function addProofCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const proofVersionId = String(formData.get("proofVersionId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const xPct = Number.parseFloat(String(formData.get("xPct") ?? ""));
  const yPct = Number.parseFloat(String(formData.get("yPct") ?? ""));

  if (!body) return fail("Write what you'd like changed.");
  if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) {
    return fail("Click the proof to place your comment.");
  }

  const proof = await proofForViewer(proofVersionId);
  if (!proof) return fail("That proof isn't available.");

  if (proof.status === "approved") {
    return fail("This proof has been approved, so it can't take new comments.");
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proofComments)
    .where(eq(proofComments.proofVersionId, proofVersionId));

  const pin = clampPin(xPct, yPct);

  await db.insert(proofComments).values({
    proofVersionId,
    authorId: proof.session.user.id,
    body: body.slice(0, 2000),
    xPct: pin.xPct,
    yPct: pin.yPct,
    pinNumber: count + 1,
  });

  revalidatePath(`/account/orders/${proof.orderId}/proof`);
  revalidatePath(`/staff/orders/${proof.orderId}`);

  return { ok: true, message: "Comment added." };
}

export async function deleteProofCommentAction(
  formData: FormData,
): Promise<void> {
  const session = await requireUser();
  const commentId = String(formData.get("commentId") ?? "");
  if (!commentId) return;

  // Ownership is in the WHERE clause, so a forged id matches nothing.
  const [deleted] = await db
    .delete(proofComments)
    .where(
      and(
        eq(proofComments.id, commentId),
        eq(proofComments.authorId, session.user.id),
      ),
    )
    .returning({ proofVersionId: proofComments.proofVersionId });

  if (deleted) {
    const [proof] = await db
      .select({ orderId: proofVersions.orderId })
      .from(proofVersions)
      .where(eq(proofVersions.id, deleted.proofVersionId))
      .limit(1);

    if (proof) revalidatePath(`/account/orders/${proof.orderId}/proof`);
  }
}

export async function decideProofAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser();

  const proofVersionId = String(formData.get("proofVersionId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const proof = await proofForViewer(proofVersionId);
  if (!proof) return fail("That proof isn't available.");

  // Only the customer whose order it is can approve or reject it.
  if (!proof.isOwner) {
    return fail("Only the customer can approve their own proof.");
  }

  if (proof.status !== "awaiting_customer") {
    return fail("This proof isn't waiting on you.");
  }

  if (decision === "approve") {
    await db
      .update(proofVersions)
      .set({ status: "approved", customerDecisionAt: new Date() })
      .where(eq(proofVersions.id, proofVersionId));

    /**
     * Approving is what creates the bill. Until the customer has seen the
     * proof there is nothing to pay for, so the order only reaches
     * awaiting_payment here.
     *
     * An order that somehow arrives already paid goes straight to printing
     * rather than asking for the money twice.
     */
    await db
      .update(orders)
      .set({
        status: proof.paymentStatus === "paid" ? "in_production" : "awaiting_payment",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, proof.orderId));

    await db.insert(activityEvents).values({
      orderId: proof.orderId,
      actorId: session.user.id,
      type: "proof_approved",
      summary: `${session.user.name} approved version ${proof.versionNumber} of ${proof.reference}`,
    });

    // Approving is what creates the bill, so the request goes out with it.
    if (proof.paymentStatus !== "paid") {
      try {
        await sendMail(
          paymentRequestMail(
            proof.customerEmail,
            proof.customerName,
            proof.reference,
            proof.orderId,
            proof.totalMinor,
            proof.currency,
          ),
        );
      } catch (error) {
        console.error("[proofs] could not email the payment request", error);
      }
    }

    revalidatePath(`/account/orders/${proof.orderId}/proof`);
    revalidatePath("/staff/queue");

    return {
      ok: true,
      message:
        proof.paymentStatus === "paid"
          ? "Approved — thank you. We'll start printing."
          : "Approved — thank you. We've emailed you the payment details.",
    };
  }

  if (decision === "changes") {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proofComments)
      .where(eq(proofComments.proofVersionId, proofVersionId));

    if (count === 0) {
      return fail(
        "Click the proof to mark what needs changing, so the studio knows where to look.",
      );
    }

    await db
      .update(proofVersions)
      .set({ status: "changes_requested", customerDecisionAt: new Date() })
      .where(eq(proofVersions.id, proofVersionId));

    await db.insert(activityEvents).values({
      orderId: proof.orderId,
      actorId: session.user.id,
      type: "changes_requested",
      summary: `${session.user.name} requested changes to ${proof.reference} (${count} comment${count === 1 ? "" : "s"})`,
    });

    revalidatePath(`/account/orders/${proof.orderId}/proof`);
    revalidatePath("/staff/queue");

    return {
      ok: true,
      message: "Thank you — the studio has your comments and will send a new proof.",
    };
  }

  return fail("Choose whether to approve or request changes.");
}
