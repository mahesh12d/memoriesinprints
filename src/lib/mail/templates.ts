import { appUrl, type Mail } from "./types";
import { formatMoney } from "@/lib/pricing/money";

/** Plain, quiet styling — this is a bereavement-adjacent business. */
function wrap(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px;background:#faf8f4;font-family:'Work Sans',system-ui,Helvetica,Arial,sans-serif;color:#2b2a28;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e0d8;border-radius:6px;padding:36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:600;color:#2b2a28;margin-bottom:28px;">Memories in Prints</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;margin:0 0 16px;">${heading}</h1>
    ${bodyHtml}
  </div>
  <p style="max-width:520px;margin:20px auto 0;font-size:12px;color:#8a8580;text-align:center;">
    Memories in Prints · Member of the UK Funeral Suppliers' Association
  </p>
</body>
</html>`;
}

/**
 * Anything a visitor typed is escaped before it goes into an email body —
 * otherwise a crafted enquiry could inject markup into the studio's inbox.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string): string {
  return `<p style="margin:26px 0;">
    <a href="${href}" style="display:inline-block;background:#2b2a28;color:#faf8f4;text-decoration:none;padding:13px 26px;border-radius:2px;font-size:14px;font-weight:600;">${label}</a>
  </p>`;
}

export function verifyEmailMail(to: string, name: string, token: string): Mail {
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return {
    to,
    subject: "Confirm your email address",
    html: wrap(
      "Confirm your email address",
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${esc(name)},</p>
       <p style="font-size:15px;line-height:1.6;">Please confirm this address so we can send you proofs and order updates.</p>
       ${button(link, "Confirm my email")}
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
    ),
    text: `Hello ${name},\n\nConfirm your email address: ${link}\n\nThis link expires in 24 hours.`,
  };
}

export function resetPasswordMail(
  to: string,
  name: string,
  token: string,
): Mail {
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return {
    to,
    subject: "Reset your password",
    html: wrap(
      "Reset your password",
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${esc(name)},</p>
       <p style="font-size:15px;line-height:1.6;">Use the link below to choose a new password.</p>
       ${button(link, "Choose a new password")}
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">This link expires in one hour. If you didn't ask for this, nothing has changed and you can ignore this email.</p>`,
    ),
    text: `Hello ${name},\n\nReset your password: ${link}\n\nThis link expires in one hour.`,
  };
}

export function passwordChangedMail(to: string, name: string): Mail {
  return {
    to,
    subject: "Your password was changed",
    html: wrap(
      "Your password was changed",
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${esc(name)},</p>
       <p style="font-size:15px;line-height:1.6;">Your password has just been changed and every other signed-in device has been signed out.</p>
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">If this wasn't you, please contact the studio straight away.</p>`,
    ),
    text: `Hello ${name},\n\nYour password was changed and other devices were signed out. If this wasn't you, contact the studio straight away.`,
  };
}

export function enquiryReceivedMail(
  to: string,
  name: string,
  reference: string,
): Mail {
  return {
    to,
    subject: `We've received your enquiry (${reference})`,
    html: wrap(
      "Thank you — we have your enquiry",
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${esc(name)},</p>
       <p style="font-size:15px;line-height:1.6;">Thank you for getting in touch. Your reference is <strong>${esc(reference)}</strong>.</p>
       <p style="font-size:15px;line-height:1.6;">We read every enquiry ourselves and will come back to you within one working day — sooner if your date is close. Nothing is charged until you've seen and approved a written quote.</p>
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">If anything changes in the meantime, just reply to this email and quote your reference.</p>`,
    ),
    text: `Hello ${name},\n\nThank you for getting in touch. Your reference is ${reference}.\n\nWe'll come back to you within one working day. Nothing is charged until you've approved a written quote.`,
  };
}

export function studioEnquiryMail(
  to: string,
  enquiry: {
    reference: string;
    name: string;
    email: string;
    phone: string | null;
    subject: string;
    message: string;
  },
): Mail {
  const rows = [
    ["Reference", esc(enquiry.reference)],
    ["From", esc(enquiry.name)],
    ["Email", esc(enquiry.email)],
    ["Phone", esc(enquiry.phone ?? "—")],
    ["Subject", esc(enquiry.subject)],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#6b6560;">${label}</td><td style="padding:4px 0;font-size:13px;">${value}</td></tr>`,
    )
    .join("");

  return {
    to,
    subject: `New enquiry ${enquiry.reference} — ${enquiry.subject}`,
    html: wrap(
      "New enquiry",
      `<table style="border-collapse:collapse;margin-bottom:18px;">${rows}</table>
       <p style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(enquiry.message)}</p>
       ${button(appUrl("/admin/enquiries"), "Open in admin")}`,
    ),
    text: `New enquiry ${enquiry.reference}\n\nFrom: ${enquiry.name} <${enquiry.email}>\nPhone: ${enquiry.phone ?? "—"}\nSubject: ${enquiry.subject}\n\n${enquiry.message}`,
  };
}

/**
 * The proof is ready to look at.
 *
 * This is the one message in the set that asks the customer to do something
 * time-sensitive: nothing is printed until they approve it, and for funeral
 * stationery the date is usually days away. Until now it was an in-app
 * notification only, which assumed they would think to log in and check.
 */
export function proofReadyMail(
  to: string,
  name: string,
  reference: string,
  orderId: string,
): Mail {
  const link = appUrl(`/account/orders/${encodeURIComponent(orderId)}/proof`);
  return {
    to,
    subject: `Your proof for ${reference} is ready`,
    html: wrap(
      "Your proof is ready",
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${esc(name)},</p>
       <p style="font-size:15px;line-height:1.6;">Your proof for ${esc(reference)} is ready for you to look over. You can read it through, and click anywhere on it to point out anything you'd like changed.</p>
       ${button(link, "Look over my proof")}
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">Nothing is printed until you've approved it, and there's no charge until then either. If anything isn't right, just tell us and we'll put it right.</p>`,
    ),
    text: `Hello ${name},

Your proof for ${reference} is ready for you to look over:
${link}

Nothing is printed until you have approved it, and there is no charge until then. If anything is not right, tell us and we will put it right.`,
  };
}

/**
 * The proof has been approved, so now there is something to pay for.
 *
 * Sent at the moment of approval rather than as a reminder: under this flow
 * approving is what creates the bill, and the customer has just done it, so
 * the request should arrive while they still have the order in mind.
 */
export function paymentRequestMail(
  to: string,
  name: string,
  reference: string,
  orderId: string,
  amountMinor: number | null,
  currency: string,
): Mail {
  const link = appUrl(`/checkout/${encodeURIComponent(orderId)}`);
  const amount =
    amountMinor !== null ? formatMoney(amountMinor, currency) : "the agreed amount";

  return {
    to,
    subject: `Payment for ${reference}`,
    html: wrap(
      "Thank you for approving your proof",
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${esc(name)},</p>
       <p style="font-size:15px;line-height:1.6;">Thank you for approving the proof for ${esc(reference)}. The last step is payment of <strong>${esc(amount)}</strong>, and then we go straight to print.</p>
       ${button(link, "Pay for my order")}
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">If anything has changed or you would rather pay another way, reply to this email and we will sort it out with you.</p>`,
    ),
    text: `Hello ${name},

Thank you for approving the proof for ${reference}. The last step is payment of ${amount}, and then we go straight to print.

Pay here: ${link}

If anything has changed or you would rather pay another way, reply to this email.`,
  };
}

/**
 * Payment received.
 *
 * Doubles as the receipt, so it names the amount and the order rather than
 * just saying thank you — this is the message someone forwards to whoever is
 * settling the account.
 */
export function paymentReceivedMail(
  to: string,
  name: string,
  reference: string,
  orderId: string,
  amountMinor: number | null,
  currency: string,
): Mail {
  const link = appUrl(`/account/orders`);
  const amount =
    amountMinor !== null ? formatMoney(amountMinor, currency) : "your payment";

  return {
    to,
    subject: `Payment received for ${reference}`,
    html: wrap(
      "Payment received, thank you",
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${esc(name)},</p>
       <p style="font-size:15px;line-height:1.6;">We have received <strong>${esc(amount)}</strong> for ${esc(reference)}. Your order is now with our printers, and we will let you know the moment it is on its way.</p>
       ${button(link, "See my order")}
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">Please keep this email as your receipt.</p>`,
    ),
    text: `Hello ${name},

We have received ${amount} for ${reference}. Your order is now with our printers and we will let you know when it is on its way.

See your order: ${link}

Please keep this email as your receipt.`,
  };
}
