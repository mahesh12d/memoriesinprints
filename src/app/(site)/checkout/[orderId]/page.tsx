import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/pricing/money";
import { Section } from "@/components/site/section";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

export default async function CheckoutOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ provider?: string; stub?: string }>;
}) {
  const session = await requireUser();
  const { orderId } = await params;
  const { provider, stub } = await searchParams;

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) notFound();

  const [attempt] = await db
    .select({
      provider: payments.provider,
      providerOrderId: payments.providerOrderId,
      status: payments.status,
    })
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .limit(1);

  const isStub = stub === "1";

  return (
    <Section>
      <div className="mx-auto flex max-w-[60ch] flex-col gap-6 py-6">
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">
            Order {order.reference}
          </span>
          <h1 className="text-[32px] leading-tight">
            {order.paymentStatus === "paid"
              ? "Paid — thank you"
              : "Your order is placed"}
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {order.totalMinor !== null
              ? `Total ${formatMoney(order.totalMinor, order.currency)}.`
              : ""}{" "}
            You can follow it from your account, and we&rsquo;ll email you the
            moment your proof is ready to review.
          </p>
        </div>

        {isStub && (
          <div className="rounded-md border border-pending-deep/25 bg-pending-tint p-6">
            <h2 className="font-display text-lg">Payment isn&rsquo;t live yet</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              The order has been recorded and is sitting as awaiting payment.
              The {provider === "paypal" ? "PayPal" : "Razorpay"} keys
              haven&rsquo;t been added to this environment, so there was no
              payment sheet to open.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
              Add the keys to <code>.env</code> and this same journey opens the
              real payment sheet — nothing else needs changing.
            </p>
          </div>
        )}

        {attempt && (
          <dl className="rounded-md border border-line bg-white p-6 text-[13px]">
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-muted">Method</dt>
              <dd className="font-semibold">{attempt.provider}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-muted">Provider reference</dt>
              <dd className="font-mono text-[12px]">
                {attempt.providerOrderId}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-muted">Payment status</dt>
              <dd className="font-semibold">{attempt.status}</dd>
            </div>
          </dl>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/account/orders"
            className="rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
          >
            See my orders
          </Link>
          <Link
            href="/products"
            className="rounded-[2px] border border-field-line px-7 py-3.5 text-sm font-semibold text-ink-soft hover:bg-surface-grey"
          >
            Keep browsing
          </Link>
        </div>
      </div>
    </Section>
  );
}
