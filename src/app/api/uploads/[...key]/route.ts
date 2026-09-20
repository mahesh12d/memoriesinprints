import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, proofVersions } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/guards";
import { isRemoteStorageConfigured, readObject } from "@/lib/storage/storage";

/**
 * Serves uploads in development, where there is no R2 bucket to sign against.
 *
 * It is not a public file server: the caller must be signed in and must
 * either own the order the proof belongs to, or be studio staff. With R2
 * configured this route refuses outright, because signed URLs are used
 * instead.
 */
export async function GET(
  _request: Request,
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

  const [proof] = await db
    .select({
      id: proofVersions.id,
      mimeType: proofVersions.mimeType,
      fileName: proofVersions.fileName,
      ownerId: orders.userId,
    })
    .from(proofVersions)
    .innerJoin(orders, eq(orders.id, proofVersions.orderId))
    .where(eq(proofVersions.storageKey, storageKey))
    .limit(1);

  if (!proof) return new NextResponse("Not found", { status: 404 });

  const allowed =
    proof.ownerId === session.user.id || isStaff(session.user.role);

  // A stranger gets the same answer as a missing file, so this can't be used
  // to work out which proofs exist.
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  try {
    const body = await readObject(storageKey);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": proof.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${proof.fileName ?? "proof"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
