import { requireUser } from "@/lib/auth/guards";
import { listActiveSessions } from "@/lib/auth/session";
import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/lib/auth/actions";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ChangePasswordForm } from "./change-password-form";

/** "Chrome on macOS" is friendlier than a 200-character user-agent string. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\//.test(userAgent) ? "Opera"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : "Browser";

  const platform =
    /iPhone|iPad/.test(userAgent) ? "iOS"
    : /Android/.test(userAgent) ? "Android"
    : /Mac OS X/.test(userAgent) ? "macOS"
    : /Windows/.test(userAgent) ? "Windows"
    : /Linux/.test(userAgent) ? "Linux"
    : "";

  return platform ? `${browser} on ${platform}` : browser;
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function SecurityPage() {
  const session = await requireUser();
  const activeSessions = await listActiveSessions(session.user.id, session.id);
  const otherCount = activeSessions.filter((s) => !s.isCurrent).length;

  return (
    <>
      <PortalHeader title="Security" />

      <PortalBody>
        <div className="flex max-w-[860px] flex-col gap-6">
          <section className="rounded-md border border-line bg-white p-9">
            <h2 className="text-lg">Change password</h2>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Changing it signs you out everywhere else.
            </p>
            <div className="mt-6">
              <ChangePasswordForm />
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line-soft px-7 py-5">
              <div>
                <h2 className="text-lg">Where you&rsquo;re signed in</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  {activeSessions.length} active{" "}
                  {activeSessions.length === 1 ? "session" : "sessions"}
                </p>
              </div>

              {otherCount > 0 && (
                <form action={revokeOtherSessionsAction}>
                  <button
                    type="submit"
                    className="rounded-[2px] border border-field-line px-4 py-2.5 text-[13px] font-semibold text-alert hover:bg-alert-tint"
                  >
                    Sign out {otherCount} other{" "}
                    {otherCount === 1 ? "device" : "devices"}
                  </button>
                </form>
              )}
            </div>

            <ul>
              {activeSessions.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between border-b border-line-soft px-7 py-4 last:border-b-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2.5 text-sm font-semibold">
                      {describeDevice(item.userAgent)}
                      {item.isCurrent && (
                        <span className="rounded-full bg-good-tint px-2.5 py-1 text-[11px] font-bold text-good-deep">
                          This device
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-ink-quiet">
                      {item.ipAddress ?? "Unknown location"} · last active{" "}
                      {formatter.format(item.lastSeenAt)}
                    </span>
                  </div>

                  {!item.isCurrent && (
                    <form action={revokeSessionAction}>
                      <input type="hidden" name="sessionId" value={item.id} />
                      <button
                        type="submit"
                        className="text-[13px] font-semibold text-alert hover:underline"
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PortalBody>
    </>
  );
}
