import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildStorageKey, localUploadPath } from "./keys";

export { buildStorageKey };

/**
 * Proof artwork lives in Cloudflare R2, which speaks the S3 API.
 *
 * The bucket is private. Nothing is ever served from a public URL — every read
 * goes through a signed link that expires, so a proof can't be passed around
 * or indexed once someone has seen it.
 *
 * Until the R2 credentials are added, files are written to .uploads/ on disk
 * instead, so the whole proof journey is testable locally. That fallback is
 * refused outright in a production build rather than quietly losing files —
 * unless ALLOW_LOCAL_UPLOADS is set, which is how the end-to-end suite runs
 * the journey against a real build. Nothing sets that by accident.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 10;

function localUploadsAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_LOCAL_UPLOADS === "1"
  );
}

export type StoredObject = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
  };
}

export function isRemoteStorageConfigured(): boolean {
  const { accountId, accessKeyId, secretAccessKey, bucket } = config();
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket);
}

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;

  const { accountId, accessKeyId, secretAccessKey } = config();

  client = new S3Client({
    // R2 is single-region; "auto" is what Cloudflare expects here.
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export async function putObject(
  storageKey: string,
  body: Buffer,
  mimeType: string,
): Promise<void> {
  if (!isRemoteStorageConfigured()) {
    if (!localUploadsAllowed()) {
      throw new Error(
        "R2 is not configured. Refusing to write uploads to local disk in production.",
      );
    }

    const target = localUploadPath(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return;
  }

  await s3().send(
    new PutObjectCommand({
      Bucket: config().bucket,
      Key: storageKey,
      Body: body,
      ContentType: mimeType,
    }),
  );
}

/**
 * A short-lived link to read one object. In development this points at the
 * route that serves from disk instead.
 */
export async function signedReadUrl(storageKey: string): Promise<string> {
  if (!isRemoteStorageConfigured()) {
    // Each segment is encoded separately: a single encodeURIComponent would
    // turn the slashes into %2F, which some servers refuse outright.
    const segments = storageKey.split("/").map(encodeURIComponent).join("/");
    return `/api/uploads/${segments}`;
  }

  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: config().bucket, Key: storageKey }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );
}

export async function readObject(storageKey: string): Promise<Buffer> {
  if (!isRemoteStorageConfigured()) {
    return readFile(localUploadPath(storageKey));
  }

  const response = await s3().send(
    new GetObjectCommand({ Bucket: config().bucket, Key: storageKey }),
  );

  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`No body returned for ${storageKey}`);

  return Buffer.from(bytes);
}

export async function deleteObject(storageKey: string): Promise<void> {
  if (!isRemoteStorageConfigured()) {
    await unlink(localUploadPath(storageKey)).catch(() => {});
    return;
  }

  await s3().send(
    new DeleteObjectCommand({ Bucket: config().bucket, Key: storageKey }),
  );
}
