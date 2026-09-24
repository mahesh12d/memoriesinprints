import Link from "next/link";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orderForms, orders, proofVersions, savedItems } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";

export default async function AccountDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string | string[] }>;
}) {
  const session = await requireUser();
  const verified = Boolean(session.user.emailVerifiedAt);
  const userId = session.user.id;

  // Set by the order form when it redirects here, so the confirmation lands
  // in front of the order it belongs to rather than on a page of its own.
  const sentParam = (await searchParams).sent;
  const justSent = Array.isArray(sentParam) ? sentParam[0] : sentParam;

  const myOrders = await db
    .select({ id: orders.id, reference: orders.reference })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

  const orderIds = myOrders.map((row) => row.id);

  const [waiting, formsOutstanding, saved] = await Promise.all([
    orderIds.length
      ? db
          .select({
            orderId: proofVersions.orderId,
            versionNumber: proofVersions.versionNumber,
          })
          .from(proofVersions)
          .where(
            and(
              inArray(proofVersions.orderId, orderIds),
              eq(proofVersions.status, "awaiting_customer"),
            ),
          )
          .orderBy(desc(proofVersions.sentToCustomerAt))
          .limit(1)
      : Promise.resolve([]),
    // Orders whose form has not been sent — the only thing here that stops
    // the studio starting work.
    db
      .select({ value: count() })
      .from(orders)
      .leftJoin(orderForms, eq(orderForms.orderId, orders.id))
      .where(and(eq(orders.userId, userId), isNull(orderForms.submittedAt))),
    db.select({ value: count() }).from(savedItems).where(eq(savedItems.userId, userId)),
  ]);

  const proof = waiting[0]
    ? {
        ...waiting[0],
        reference:
          myOrders.find((row) => row.id === waiting[0].orderId)?.reference ?? "",
      }
    : null;

  const tiles = [
    { label: "Orders", value: myOrders.length, href: "/account/orders" },
    {
      label: "Forms to fill",
      value: formsOutstanding[0]?.value ?? 0,
      href: "/account/order-forms",
    },
    { label: "Saved items", value: saved[0]?.value ?? 0, href: "/account/saved" },
  ];

  return (
    <>
      <PortalHeader title={`Hello, ${session.user.name.split(" ")[0]}`} />

      <PortalBody>
        <div className="flex flex-col gap-6">
          {justSent && (
            <div className="rounded-md border border-good-deep/20 bg-good-tint px-5 py-4">
              <p className="text-sm font-semibold text-good-deep">
                Order form received for {justSent}.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                It is with the design team now. We will email you as soon as
                there is a proof to look at &mdash; nothing is printed until
                you have approved it.
              </p>
            </div>
          )}

          {!verified && (
            <div className="flex items-center justify-between gap-6 rounded-md border border-pending-deep/25 bg-pending-tint px-5 py-4">
              <p className="text-sm text-ink-soft">
                Please confirm your email address so we can send you proofs and
                order updates.
              </p>
              <Link
                href="/verify-email"
                className="shrink-0 text-[13px] font-semibold text-pending-deep"
              >
                Confirm now →
              </Link>
            </div>
          )}

          {/* The one thing that might actually be waiting on them. */}
          {proof ? (
            <div className="rounded-md border border-line bg-card p-8">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                Waiting for you
              </span>
              <h2 className="mt-1.5 text-lg">
                Your proof for {proof.reference} is ready to look at
              </h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
                Check the wording, the dates and the spellings. Nothing is
                printed until you approve it, and there&rsquo;s no charge for
                changes.
              </p>
              <Link
                href={`/account/orders/${proof.orderId}/proof`}
                className="mt-6 inline-flex rounded-[2px] bg-brand px-6 py-3 text-[13px] font-semibold text-on-accent"
              >
                Review version {proof.versionNumber}
              </Link>
            </div>
          ) : (
            <div className="rounded-md border border-line bg-card p-8">
              <h2 className="text-lg">Nothing needs you right now</h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
                We&rsquo;ll email you and put a note here the moment a proof is
                ready to look at.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="rounded-[2px] bg-brand px-5 py-3 text-[13px] font-semibold text-on-accent"
                >
                  Browse what we print
                </Link>
                <Link
                  href="/quote"
                  className="rounded-[2px] border border-field-line px-5 py-3 text-[13px] font-semibold text-ink-muted"
                >
                  Ask for a quote
                </Link>
              </div>
            </div>
          )}

          <div className="grid gap-[18px] sm:grid-cols-3">
            {tiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-6 transition-colors hover:border-brand-deep/40"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                  {tile.label}
                </span>
                <span className="font-display text-[27px]">{tile.value}</span>
              </Link>
            ))}
          </div>
        </div>
      </PortalBody>
    </>
  );
}
