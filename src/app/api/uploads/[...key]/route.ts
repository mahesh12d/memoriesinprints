import { NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderForms, orders, proofVersions } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { mayOpenProof } from "@/lib/auth/guards";
import { isRemoteStorageConfigured, readObject } from "@/lib/storage/storage";

/**
 * Serves uploads in development, where there is no R2 bucket to sign against.
 *
 * Serves both kinds of file an order collects: the proofs the studio
 * uploads, and the photographs the family attaches to their order form.
 *
 * It is not a public file server: the caller must be signed in and must own
 * the order the file belongs to, be the designer it is assigned to, or be a
 * proofreader or admin. With R2 configured this route refuses outright,
 * because signed URLs are used instead.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (isRemoteStorageConfigured()) {
    return NextResponse.json(
      { error: "Uploads are served from object storage." },
      { status: 404 },
    );
  }

  const session = await getSession("site");
  if (!session) return new NextResponse("Not found", { status: 404 });

  const { key } = await params;
  const storageKey = key.map(decodeURIComponent).join("/");

  const file = (await proofFile(storageKey)) ?? (await attachment(storageKey));

  if (!file) return new NextResponse("Not found", { status: 404 });

  /*
    The customer, the designer the order is assigned to, and whoever routes
    work — the same rule whichever kind of file this is. isStaff alone served
    any designer any file in the studio, and left admin out, which was wrong
    in both directions.

    A stranger gets the same answer as a missing file, so this cannot be used
    to work out which orders exist.
  */
  if (!mayOpenProof(session.user, file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  /**
   * ?download=name.jpg saves the file instead of displaying it.
   *
   * The name is taken from the record, never from the query string — that
   * value only says whether to download, because anything reflected into a
   * Content-Disposition header can otherwise be used to inject one.
   */
  const asDownload = new URL(request.url).searchParams.has("download");

  try {
    const body = await readObject(storageKey);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": file.mimeType ?? "application/octet-stream",
        "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${file.fileName.replace(/"/g, "'")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

type StoredFile = {
  mimeType: string | null;
  fileName: string;
  ownerId: string;
  assignedDesignerId: string | null;
};

/** A proof version, looked up by the key it was stored under. */
async function proofFile(storageKey: string): Promise<StoredFile | null> {
  const [row] = await db
    .select({
      mimeType: proofVersions.mimeType,
      fileName: proofVersions.fileName,
      ownerId: orders.userId,
      assignedDesignerId: orders.assignedDesignerId,
    })
    .from(proofVersions)
    .innerJoin(orders, eq(orders.id, proofVersions.orderId))
    .where(eq(proofVersions.storageKey, storageKey))
    .limit(1);

  return row ? { ...row, fileName: row.fileName ?? "proof" } : null;
}

/**
 * A photograph the family attached to their order form.
 *
 * These were not served here at all, so with no R2 bucket configured every
 * attachment on the studio's order pages was a broken image. The keys live
 * inside a jsonb array rather than in a column of their own, which is why
 * this asks the database whether any form holds it rather than joining on it.
 */
async function attachment(storageKey: string): Promise<StoredFile | null> {
  const [row] = await db
    .select({
      attachments: orderForms.attachments,
      attachmentKey: orderForms.attachmentKey,
      attachmentName: orderForms.attachmentName,
      ownerId: orders.userId,
      assignedDesignerId: orders.assignedDesignerId,
    })
    .from(orderForms)
    .innerJoin(orders, eq(orders.id, orderForms.orderId))
    .where(
      or(
        eq(orderForms.attachmentKey, storageKey),
        sql`${orderForms.attachments} @> ${JSON.stringify([{ key: storageKey }])}::jsonb`,
      ),
    )
    .limit(1);

  if (!row) return null;

  const found = (row.attachments ?? []).find((one) => one.key === storageKey);

  return {
    mimeType: found?.type || null,
    fileName: found?.name ?? row.attachmentName ?? "attachment",
    ownerId: row.ownerId,
    assignedDesignerId: row.assignedDesignerId,
  };
}
