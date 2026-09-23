/**
 * The storage implementation.
 *
 * Split out of storage.ts so the seed can use the real upload path. The
 * guard in storage.ts cannot be imported outside Next — "server-only" is an
 * alias the bundler provides, not an installed package — and a seed that
 * writes files a different way from the app is a seed that produces proofs
 * the app cannot open, which is exactly what happened.
 *
 * Application code imports storage.ts, never this. That keeps the guard on
 * the path everything actually uses, so R2 credentials still cannot be
 * pulled into a client bundle.
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildArchiveKey, buildStorageKey, localUploadPath } from "./keys";

export { buildArchiveKey, buildStorageKey };

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
 * A short-lived link the browser can PUT one file to.
 *
 * The file goes straight from the family's computer to the bucket rather than
 * through this server, so a large scan of an order of service never occupies
 * a request handler.
 *
 * Returns null when R2 isn't configured, which is the signal to fall back to
 * the local upload route in development.
 */
export async function signedUploadUrl(
  storageKey: string,
  mimeType: string,
): Promise<string | null> {
  if (!isRemoteStorageConfigured()) return null;

  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: config().bucket,
      Key: storageKey,
      ContentType: mimeType,
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
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

/**
 * Copies an object within the bucket, server side.
 *
 * Archiving a finished proof moves bytes that are already in R2, so there is
 * no reason to pull a 25MB PDF down and push it back up again — and no window
 * where the copy exists only in this process's memory.
 */
export async function copyObject(
  fromKey: string,
  toKey: string,
): Promise<void> {
  if (!isRemoteStorageConfigured()) {
    if (!localUploadsAllowed()) {
      throw new Error(
        "R2 is not configured. Refusing to archive to local disk in production.",
      );
    }

    const target = localUploadPath(toKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(localUploadPath(fromKey)));
    return;
  }

  const { bucket } = config();

  await s3().send(
    new CopyObjectCommand({
      Bucket: bucket,
      // CopySource is bucket-qualified and must be URI-encoded, or any key
      // with a space or a hash in it fails with a 404 that names the wrong key.
      CopySource: encodeURI(`${bucket}/${fromKey}`),
      Key: toKey,
    }),
  );
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
