import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderForms, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { canEditOrderForm } from "@/lib/order-form/schema";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Every order form this customer has, in one place.
 *
 * Replaces the quotes section, which listed enquiries that never became
 * orders. What a funeral director actually needs to see is which jobs are
 * still missing their details, and which they have already sent — and to be
 * able to go back and correct one, because names and dates change right up to
 * the week of a service.
 */
export default async function AccountOrderFormsPage() {
  const session = await requireUser();

  const rows = await db
    .select({
      orderId: orders.id,
      reference: orders.reference,
      orderedFor: orders.orderedFor,
      orderStatus: orders.status,
      createdAt: orders.createdAt,
      formStatus: orderForms.status,
      submittedAt: orderForms.submittedAt,
      deceasedName: orderForms.deceasedName,
      funeralDate: orderForms.funeralDate,
      venueName: orderForms.venueName,
    })
    .from(orders)
    .leftJoin(orderForms, eq(orderForms.orderId, orders.id))
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt));

  const outstanding = rows.filter((row) => row.submittedAt === null).length;

  return (
    <>
      <PortalHeader title="Order Forms" />

      <PortalBody>
        {rows.length === 0 ? (
          <div className="rounded-md border border-line bg-card p-10 text-center">
            <h2 className="font-display text-lg">Nothing Here Yet</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
              When you place an order we&rsquo;ll ask for the details that go on
              it, and they&rsquo;ll be kept here so you can check or change them.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {outstanding > 0 && (
              <p className="rounded-[4px] bg-pending-tint px-[14px] py-3 text-[13px] leading-relaxed text-pending-deep">
                {outstanding === 1
                  ? "One order is waiting on its details before we can start."
                  : `${outstanding} orders are waiting on their details before we can start.`}
              </p>
            )}

            <ul className="flex flex-col gap-3">
              {rows.map((row) => {
                const sent = row.submittedAt !== null;
                const started = row.formStatus !== null;

                // The same rule the form page itself enforces, so this
                // button cannot offer an edit that page then refuses.
                const editable = canEditOrderForm(row.orderStatus);

                return (
                  <li
                    key={row.orderId}
                    className={`rounded-md border bg-card p-6 ${
                      sent ? "border-line" : "border-l-[3px] border-l-brand border-line"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">
                          {row.deceasedName ?? row.orderedFor ?? row.reference}
                        </span>
                        <span className="text-xs text-ink-quiet">
                          {row.reference} · placed{" "}
                          {dateFormat.format(row.createdAt)}
                        </span>
                      </div>

                      <StatusPill tone={sent ? "good" : "pending"}>
                        {sent ? "Sent" : started ? "Draft" : "Not started"}
                      </StatusPill>
                    </div>

                    {(row.funeralDate || row.venueName) && (
                      <dl className="mt-4 flex flex-col gap-1.5 border-t border-line-soft pt-4 text-[13px]">
                        {row.funeralDate && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-ink-muted">Service</dt>
                            <dd className="font-semibold">{row.funeralDate}</dd>
                          </div>
                        )}
                        {row.venueName && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-ink-muted">Venue</dt>
                            <dd className="font-semibold">{row.venueName}</dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {editable && (
                      <Link
                        href={`/order-form/${row.orderId}`}
                        className={`mt-4 inline-flex rounded-[2px] px-5 py-2.5 text-[13px] font-semibold ${
                          sent
                            ? "border border-field-line text-ink-soft hover:bg-surface-grey"
                            : "bg-brand text-on-accent hover:bg-brand-deep hover:text-white"
                        }`}
                      >
                        {sent
                          ? "Check or change the details"
                          : started
                            ? "Finish your order form"
                            : "Fill in your order form"}
                      </Link>
                    )}
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
