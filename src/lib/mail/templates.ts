import { appUrl, type Mail } from "./mailer";

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
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${name},</p>
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
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${name},</p>
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
      `<p style="font-size:15px;line-height:1.6;margin:0;">Hello ${name},</p>
       <p style="font-size:15px;line-height:1.6;">Your password has just been changed and every other signed-in device has been signed out.</p>
       <p style="font-size:13px;line-height:1.6;color:#6b6560;">If this wasn't you, please contact the studio straight away.</p>`,
    ),
    text: `Hello ${name},\n\nYour password was changed and other devices were signed out. If this wasn't you, contact the studio straight away.`,
  };
}
