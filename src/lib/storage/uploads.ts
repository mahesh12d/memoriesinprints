/**
 * What the studio is willing to accept as a proof, kept free of server
 * imports so the rules can be tested directly and reused on the client.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(",");

export type UploadCheck =
  | { ok: true; mimeType: AcceptedMimeType }
  | { ok: false; reason: string };

/**
 * Checked on the server, not just in the file picker — the `accept` attribute
 * is a convenience for the person choosing a file, never a control.
 */
export function checkUpload(file: {
  type: string;
  size: number;
  name: string;
}): UploadCheck {
  if (!file.name || file.size === 0) {
    return { ok: false, reason: "That file appears to be empty." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const limit = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return {
      ok: false,
      reason: `That file is larger than ${limit}MB. Flatten the artwork or send it over separately.`,
    };
  }

  const mimeType = file.type.toLowerCase().split(";")[0]?.trim() ?? "";

  if (!ACCEPTED_MIME_TYPES.includes(mimeType as AcceptedMimeType)) {
    return {
      ok: false,
      reason: "Proofs must be a PDF, JPEG, PNG or WebP.",
    };
  }

  return { ok: true, mimeType: mimeType as AcceptedMimeType };
}

export function isPdf(mimeType: string | null | undefined): boolean {
  return (mimeType ?? "").toLowerCase().startsWith("application/pdf");
}
