import { requireStaff } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";

export default async function StaffDashboardPage() {
  const session = await requireStaff();

  return (
    <>
      <PortalHeader title="Studio dashboard" />
      <PortalBody>
        <div className="rounded-md border border-line bg-white p-8">
          <h2 className="text-lg">
            Signed in as {session.user.role === "proofreader" ? "a proofreader" : "a designer"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            The work queue, proof uploads and proofreading actions arrive in the
            next build. The role gate is live: designers and proofreaders reach
            this area, customers don&rsquo;t.
          </p>
        </div>
      </PortalBody>
    </>
  );
}
