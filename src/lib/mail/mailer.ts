import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { appUrl, type Mail } from "./types";

// Re-exported so existing callers keep importing these from here.
export { appUrl, type Mail };

const transport = process.env.MAIL_TRANSPORT ?? "log";
const from =
  process.env.MAIL_FROM ??
  "Memories in Prints <studio@memoriesinprints.co.uk>";

/**
 * In development every message is written to .mail/ as an .html file you can
 * open in a browser, so the signup and reset flows are testable end to end
 * without an email provider.
 *
 * Set MAIL_TRANSPORT=resend to send through Resend, or =smtp for a plain
 * SMTP server. Anything else keeps writing to disk, which is the safe
 * default: a misconfigured environment writes a file rather than silently
 * mailing a real customer.
 */
async function writeToDisk(mail: Mail): Promise<void> {
  const dir = path.join(process.cwd(), ".mail");
  await mkdir(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = mail.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const file = path.join(dir, `${stamp}-${slug}.html`);

  await writeFile(
    file,
    `<!-- To: ${mail.to}\n     Subject: ${mail.subject} -->\n${mail.html}`,
    "utf8",
  );

  console.info(`[mail] ${mail.subject} → ${mail.to}  (saved to ${file})`);
}

/**
 * Resend's REST API is a single POST, so it needs no SDK — one less
 * dependency to keep current for an endpoint that has not changed in years.
 */
async function sendWithResend(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("MAIL_TRANSPORT=resend but RESEND_API_KEY is not set.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? from,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });

  if (!response.ok) {
    // The body carries Resend's reason — an unverified domain, a bad
    // address — which is what makes a failure fixable rather than a mystery.
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend refused the message (HTTP ${response.status}): ${detail.slice(0, 200)}`,
    );
  }
}

export async function sendMail(mail: Mail): Promise<void> {
  if (transport === "log") {
    await writeToDisk(mail);
    return;
  }

  if (transport === "resend") {
    await sendWithResend(mail);
    return;
  }

  const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await mailer.sendMail({ from, ...mail });
}

