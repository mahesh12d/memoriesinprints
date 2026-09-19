import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";

export default async function AccountDashboardPage() {
  const session = await requireUser();
  const verified = Boolean(session.user.emailVerifiedAt);

  return (
    <>
      <PortalHeader title={`Hello, ${session.user.name.split(" ")[0]}`} />

      <PortalBody>
        <div className="flex flex-col gap-6">
          {!verified && (
            <div className="flex items-center justify-between gap-6 rounded-md border border-warm/30 bg-warm-tint px-5 py-4">
              <p className="text-sm text-ink-soft">
                Please confirm your email address so we can send you proofs and
                order updates.
              </p>
              <Link
                href="/verify-email"
                className="shrink-0 text-[13px] font-semibold text-warm"
              >
                Confirm now →
              </Link>
            </div>
          )}

          <div className="rounded-md border border-line bg-white p-8">
            <h2 className="text-lg">Your account is ready</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Orders, quotes, saved items and proof reviews arrive in the next
              build. Your profile and security settings are live now.
            </p>

            <div className="mt-6 flex gap-3">
              <Link
                href="/account/profile"
                className="rounded-[2px] bg-charcoal px-5 py-3 text-[13px] font-semibold text-ivory"
              >
                Edit profile
              </Link>
              <Link
                href="/account/security"
                className="rounded-[2px] border border-field-line px-5 py-3 text-[13px] font-semibold text-ink-muted"
              >
                Security settings
              </Link>
            </div>
          </div>
        </div>
      </PortalBody>
    </>
  );
}
