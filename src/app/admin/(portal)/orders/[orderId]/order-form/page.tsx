import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { isUuid } from "@/lib/utils";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { OrderFormSummary } from "@/components/portal/order-form-summary";

/** The customer's order form on its own, opened from the order page. */
export default async function AdminOrderFormPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireAdmin();
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();

  const [order] = await db
    .select({ id: orders.id, reference: orders.reference })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) notFound();

  return (
    <>
      <PortalHeader title={`Order form — ${order.reference}`} />
      <PortalBody>
        <OrderFormSummary orderId={order.id} />
      </PortalBody>
    </>
  );
}
