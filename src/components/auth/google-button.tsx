import Link from "next/link";

/**
 * Starts Google sign-in.
 *
 * A link rather than a button, because it is a plain navigation to a route
 * that redirects onward — no JavaScript, and it works from a middle-click or
 * a keyboard exactly as any other link does.
 *
 * One control for signing in and signing up: Google does not distinguish
 * between them, and offering two buttons that do the same thing only makes
 * someone wonder which one they need.
 */
export function GoogleButton({
  next,
  label = "Continue with Google",
}: {
  next?: string;
  label?: string;
}) {
  const href = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";

  return (
    <Link
      href={href}
      className="flex w-full items-center justify-center gap-3 rounded-[3px] border border-field-line bg-card px-5 py-3.5 text-sm font-semibold text-ink-soft transition-colors hover:border-brand hover:text-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* Google's mark, which their brand terms require be used unaltered. */}
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        />
        <path
          fill="#FBBC05"
          d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
        />
        <path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        />
      </svg>
      {label}
    </Link>
  );
}

/** A labelled rule between the Google button and the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[12px] text-ink-quiet">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/**
 * Explains what went wrong when Google sends someone back without a session.
 *
 * Note what "admin-uses-own-login" does NOT say. It used to read
 * "Administrators sign in through the admin portal", which told anyone who
 * tried that an admin portal exists and confirmed that a particular address
 * belongs to an administrator — a free account-enumeration oracle on the
 * public login page. It now reads exactly like an ordinary failure. The key is
 * kept distinct so the server log still says which case it was.
 */
export const GOOGLE_ERRORS: Record<string, string> = {
  "google-unavailable":
    "Google sign-in isn't set up yet. Please use your email and password.",
  "google-cancelled": "Google sign-in was cancelled. Nothing has changed.",
  "google-failed":
    "We couldn't complete Google sign-in. Please try again, or use your email and password.",
  "google-unverified":
    "Google hasn't verified that email address, so we can't use it to sign you in.",
  "account-disabled":
    "That account is closed. Call the studio if you think that's wrong.",
  "admin-uses-own-login":
    "We couldn't complete Google sign-in. Please try again, or use your email and password.",
};
