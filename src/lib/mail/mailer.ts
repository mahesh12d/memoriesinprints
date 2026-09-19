import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const transport = process.env.MAIL_TRANSPORT ?? "log";
const from =
  process.env.MAIL_FROM ??
  "Memories in Prints <studio@memoriesinprints.co.uk>";

/**
 * In development every message is written to .mail/ as an .html file you can
 * open in a browser, so the signup and reset flows are testable end to end
 * without an email provider. Set MAIL_TRANSPORT=smtp to send for real.
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

export async function sendMail(mail: Mail): Promise<void> {
  if (transport === "log") {
    await writeToDisk(mail);
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

export function appUrl(pathname: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}${pathname}`;
}
