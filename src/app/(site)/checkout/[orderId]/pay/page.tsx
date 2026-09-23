import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/pricing/money";
import { providerStatus } from "@/lib/payments/checkout";
import { Section } from "@/components/site/section";
import { isUuid } from "@/lib/utils";
import { PayForm } from "./pay-form";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

/**
 * The last step: choosing how to pay.
 *
 * Reachable only once the order is in awaiting_payment — that is, once the
 * customer has approved a proof. Anyone arriving earlier is sent back to the
 * order, because there is nothing to pay for yet, and anyone arriving after
 * paying is sent back too rather than shown a second bill.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireUser();
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      orderedFor: orders.orderedFor,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) notFound();

  // The guard is on the order's own status, not on how you got here.
  if (order.status !== "awaiting_payment" || order.paymentStatus === "paid") {
    redirect(`/checkout/${order.id}`);
  }

  const providers = await providerStatus();
  const amount =
    order.totalMinor !== null
      ? formatMoney(order.totalMinor, order.currency)
      : "";

  return (
    <Section>
      <div className="mx-auto flex max-w-[560px] flex-col gap-6 py-4">
        <div className="flex flex-col gap-2">
          <Link
            href={`/checkout/${order.id}`}
            className="w-fit text-[13px] font-semibold text-accent-text hover:underline"
          >
            ← Back to your order
          </Link>
          <h1 className="text-[30px] leading-tight">Payment</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {order.reference}
            {order.orderedFor ? ` · for ${order.orderedFor}` : ""}
          </p>
        </div>

        <div className="rounded-md border border-line bg-card p-6">
          <div className="mb-6 flex items-baseline justify-between border-b border-line-soft pb-5">
            <span className="text-[14px] text-ink-muted">Amount due</span>
            <span className="font-display text-[28px]">{amount || "—"}</span>
          </div>

          <PayForm
            orderId={order.id}
            amount={amount}
            providers={providers}
          />
        </div>
      </div>
    </Section>
  );
}
