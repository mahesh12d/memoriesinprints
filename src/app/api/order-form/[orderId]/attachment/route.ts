import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import {
  buildStorageKey,
  isRemoteStorageConfigured,
  putObject,
  signedUploadUrl,
} from "@/lib/storage/storage";
import { checkUpload } from "@/lib/storage/uploads";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Hands the browser somewhere to put the family's photograph.
 *
 * With R2 configured this mints a presigned PUT and the file never touches
 * this server. Without it — local development — the same route accepts the
 * PUT itself and writes to disk, so the journey is identical either way and
 * the client needs no branch.
 *
 * The enquiry id is the credential, the same one that opens the form. It is
 * checked against a real enquiry so this can't be used as an open bucket, and
 * the key is generated here rather than accepted from the caller so nothing
 * outside this enquiry's folder can be written.
 */
/**
 * The order behind this request, or nothing.
 *
 * Ownership is checked, not just existence. Before the move these attachments
 * hung off an enquiry id that was the only credential, so a forwarded link let
 * a stranger read a family's photographs.
 */
async function requireOwnOrder(orderId: string) {
  if (!z.string().uuid().safeParse(orderId).success) return null;

  const session = await getSession("site");
  if (!session) return null;

  const [order] = await db
    .select({ id: orders.id, reference: orders.reference })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  return order ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);

  // A made-up id gets the same answer as a missing one.
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName ?? "").trim();
  const mimeType = String(body?.contentType ?? "");
  const size = Number(body?.size ?? 0);

  const check = checkUpload({ type: mimeType, size, name: fileName });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const storageKey = buildStorageKey(
    `order-forms/${order.reference}`,
    fileName,
  );

  const uploadUrl = await signedUploadUrl(storageKey, check.mimeType);

  return NextResponse.json({
    storageKey,
    // Falls back to this same route, which accepts the PUT below.
    uploadUrl:
      uploadUrl ??
      `/api/order-form/${orderId}/attachment?key=${encodeURIComponent(storageKey)}`,
    direct: uploadUrl !== null,
  });
}

/** The development fallback: R2 isn't configured, so take the bytes here. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (isRemoteStorageConfigured()) {
    return NextResponse.json(
      { error: "Upload straight to storage instead." },
      { status: 404 },
    );
  }

  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storageKey = new URL(request.url).searchParams.get("key") ?? "";

  // The key must be one this route generated for this order, or a caller
  // could write anywhere in the bucket by asking nicely.
  if (!storageKey.startsWith(`order-forms/${order.reference}/`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  const check = checkUpload({
    type: request.headers.get("content-type") ?? "",
    size: bytes.byteLength,
    name: storageKey,
  });

  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  await putObject(storageKey, bytes, check.mimeType);

  return NextResponse.json({ ok: true });
}
