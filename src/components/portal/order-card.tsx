import Link from "next/link";
import { OrderProgress } from "./order-progress";
import { StatusPill, type PillTone } from "./status-pill";
import { NewChip } from "./unseen";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";

type OrderStatus =
  | "awaiting_price"
  | "awaiting_payment"
  | "awaiting_proof"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

type ProofStatus =
  /*
    Never reaches a customer's screen — their queries only take versions that
    have been sent to them — but the column can hold it, so the type says so
    rather than making the page lie to the compiler about what it fetched.
  */
  | "draft"
  | "awaiting_proofreading"
  | "returned_to_designer"
  | "awaiting_customer"
  | "approved"
  | "changes_requested";

export type OrderCardItem = {
  label: string;
  href: string | null;
  quantity: number;
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * One order, as its own card.
 *
 * Previously these were rows in a single bordered box, separated only by a
 * hairline. With a six-step progress line inside each one there was nothing to
 * say where one order ended and the next began — the page read as one long
 * stream. Each order now has its own border and sits in its own space, and the
 * ones waiting on the customer carry a coloured edge so they are findable
 * without reading anything.
 */
export function OrderCard({
  reference,
  placedAt,
  description,
  items,
  orderedFor,
  status,
  proofStatus,
  totalMinor,
  currency,
  href,
  proofHref,
  payHref,
  orderFormHref,
  formSubmitted = true,
  needsYou,
  unseen = false,
  statusLabel,
  statusTone,
  paymentLabel,
  paymentTone,
}: {
  reference: string;
  placedAt: Date;
  description: string;
  items: OrderCardItem[];
  orderedFor: string | null;
  status: OrderStatus;
  proofStatus: ProofStatus | null;
  totalMinor: number | null;
  currency: string;
  href?: string;
  proofHref: string | null;
  payHref: string | null;
  /** Set while the order form is still outstanding, so it can be finished. */
  orderFormHref?: string | null;
  formSubmitted?: boolean;
  needsYou: boolean;
  /**
   * Something has happened on this order since the customer last opened it.
   *
   * Separate from needsYou, which is about whose move it is: a proof can be with
   * the studio and still have news on it. A customer with several orders open
   * wants both answers, and they are not the same answer.
   */
  unseen?: boolean;
  statusLabel: string;
  statusTone: PillTone;
  paymentLabel: string;
  paymentTone: PillTone;
}) {
  return (
    <li
      data-search={`${reference} ${description} ${orderedFor ?? ""}`}
      className={`overflow-hidden rounded-md border bg-card ${
        needsYou ? "border-l-[3px] border-l-brand border-line" : "border-line"
      }`}
    >
      {/*
        Open when something is needed or something has changed, shut otherwise.
        Six progress steps on every order at once is what made the list
        unreadable — but an order that has just moved is one worth unfolding.
      */}
      <details open={needsYou || unseen} className="group">
        <summary className="cursor-pointer px-6 py-4 marker:text-ink-quiet hover:bg-surface-grey">
          <span className="ml-1 inline-flex w-[calc(100%-2rem)] flex-wrap items-center justify-between gap-4 align-middle">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {description}
                </span>
                {unseen && <NewChip />}
              </span>
              <span className="text-xs text-ink-quiet">
                {reference} · placed {dateFormat.format(placedAt)}
                {orderedFor ? ` · for ${orderedFor}` : ""}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-semibold">
                {totalMinor !== null
                  ? formatMoney(totalMinor, currency)
                  : QUOTED_INDIVIDUALLY}
              </span>
              <StatusPill tone={paymentTone}>{paymentLabel}</StatusPill>
              <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
            </span>
          </span>
        </summary>

        <div className="flex flex-col gap-5 border-t border-line-soft px-6 pb-5 pt-5">
          <OrderProgress
            status={status}
            proofStatus={proofStatus}
            formSubmitted={formSubmitted}
          />

          {/*
            What is actually in the order, by template number where there is
            one — that is how someone checks they ordered the right design
            without opening anything.
          */}
          {items.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {items.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="inline-flex rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-accent-text hover:bg-surface-grey"
                    >
                      {item.label} × {item.quantity}
                    </Link>
                  ) : (
                    <span className="inline-flex rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink-muted">
                      {item.label} × {item.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            {/*
              The form comes before anything else that can be done to an
              order, so its link leads.
            */}
            {orderFormHref && (
              <Link
                href={orderFormHref}
                className="rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
              >
                Fill in your order form
              </Link>
            )}

            {payHref && (
              <Link
                href={payHref}
                aria-label={`Pay for ${reference}`}
                className="rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
              >
                Pay now
              </Link>
            )}
            {proofHref && (
              <Link
                href={proofHref}
                /*
                  Every card's link reads the same, so the reference goes in
                  the label rather than the visible text, where it would just
                  repeat the line above it.
                */
                aria-label={
                  proofStatus === "awaiting_customer"
                    ? `Review your proof for ${reference}`
                    : `See the proof for ${reference}`
                }
                className="rounded-[2px] border border-field-line px-5 py-2.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-grey"
              >
                {proofStatus === "awaiting_customer"
                  ? "Review your proof"
                  : "See the proof"}
              </Link>
            )}
            {href && (
              <Link
                href={href}
                className="self-center text-[13px] font-semibold text-accent-text"
              >
                Order details
              </Link>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}
