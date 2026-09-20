import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { formatPrice } from "@/lib/catalogue";
import { StatusPill, type PillTone } from "@/components/portal/status-pill";
import { CancelQuoteButton } from "./cancel-quote-button";

const STATUS_TONE: Record<string, PillTone> = {
  new: "pending",
  reviewed: "neutral",
  quoted: "pending",
  converted: "good",
  declined: "alert",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  new: "With the studio",
  reviewed: "Being reviewed",
  quoted: "Quote ready",
  converted: "Became an order",
  declined: "Declined",
  cancelled: "Cancelled",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AccountQuotesPage() {
  const session = await requireUser();

  const rows = await db
    .select({
      id: enquiries.id,
      reference: enquiries.reference,
      subject: enquiries.subject,
      status: enquiries.status,
      quotedAmountPence: enquiries.quotedAmountPence,
      createdAt: enquiries.createdAt,
    })
    .from(enquiries)
    .where(eq(enquiries.userId, session.user.id))
    .orderBy(desc(enquiries.createdAt));

  return (
    <>
      <PortalHeader title="Quotes" />

      <PortalBody>
        {rows.length === 0 ? (
          <div className="rounded-md border border-line bg-white p-10 text-center">
            <h2 className="font-display text-lg">No quote requests yet</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
              When you ask us for a quote, it appears here so you can follow
              where it&rsquo;s got to.
            </p>
            <Link
              href="/quote"
              className="mt-6 inline-flex rounded-[2px] bg-brand px-6 py-3 text-[13px] font-semibold text-on-accent"
            >
              Request a quote
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-line bg-white">
            <ul>
              {rows.map((row) => {
                const canCancel =
                  row.status === "new" ||
                  row.status === "reviewed" ||
                  row.status === "quoted";

                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-7 py-5 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-semibold">
                        {row.subject}
                      </span>
                      <span className="text-xs text-ink-quiet">
                        {row.reference} · sent{" "}
                        {dateFormat.format(row.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-5">
                      {row.quotedAmountPence !== null && (
                        <span className="text-sm font-semibold">
                          {formatPrice(row.quotedAmountPence)}
                        </span>
                      )}
                      <StatusPill tone={STATUS_TONE[row.status] ?? "neutral"}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </StatusPill>
                      {canCancel && <CancelQuoteButton enquiryId={row.id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PortalBody>
    </>
  );
}
