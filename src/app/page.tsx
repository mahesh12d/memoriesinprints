import Link from "next/link";
import { getSession } from "@/lib/auth/session";

/**
 * Temporary landing page. The real marketing site (Home, Portfolio, Products,
 * Guide, About, Quote) is the next milestone — this is here so the foundation
 * is walkable end to end.
 */
export default async function HomePage() {
  const session = await getSession("site");

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center gap-10 px-8 py-20">
      <div className="flex flex-col gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-warm">
          Foundation build
        </span>
        <h1 className="font-display text-[42px] leading-tight">
          Memories in Prints
        </h1>
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Accounts, sign-in, email confirmation and the three role-gated portals
          are wired up and running against the database. The public site and the
          order, quote and proof screens come next.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {session ? (
          <Link
            href="/account"
            className="rounded-[2px] bg-charcoal px-6 py-3.5 text-sm font-semibold text-ivory"
          >
            Go to my account
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-[2px] bg-charcoal px-6 py-3.5 text-sm font-semibold text-ivory"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-[2px] border border-field-line px-6 py-3.5 text-sm font-semibold text-ink-muted"
            >
              Create an account
            </Link>
          </>
        )}
      </div>

      <div className="border-t border-line pt-6 text-[13px] text-ink-faint">
        Studio staff sign in at{" "}
        <Link href="/login" className="font-semibold text-warm">
          /login
        </Link>{" "}
        and are taken to the studio portal. Administrators sign in separately at{" "}
        <Link href="/admin/login" className="font-semibold text-warm">
          /admin/login
        </Link>
        .
      </div>
    </main>
  );
}
