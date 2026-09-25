/**
 * The pieces an email template needs, kept out of mailer.ts.
 *
 * mailer.ts carries the "server-only" guard because it holds API keys and
 * reaches the network. That guard also makes it unimportable outside Next, so
 * anything it exports drags the templates down with it — and the templates are
 * pure string building that a test, or a one-off script, should be able to
 * render without a running app.
 */

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function appUrl(pathname: string): string {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return `${base}${pathname}`;
}
