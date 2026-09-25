import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { canSeeAllOrders, requireStaff } from "@/lib/auth/guards";
import { isUuid } from "@/lib/utils";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { OrderFormSummary } from "@/components/portal/order-form-summary";

/**
 * The customer's order form, on its own.
 *
 * Opened in a second tab from the order page, so the details can sit beside
 * the artwork while it is being made instead of above it — the designer was
 * scrolling past the whole form to reach the proof, then back up to check a
 * date.
 */
export default async function StaffOrderFormPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireStaff();
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      assignedDesignerId: orders.assignedDesignerId,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId)))
    .limit(1);

  if (!order) notFound();

  // The same rule as the order page: a designer sees their own jobs only.
  if (
    !canSeeAllOrders(session.user.role) &&
    order.assignedDesignerId !== session.user.id
  ) {
    notFound();
  }

  return (
    <>
      <PortalHeader title={`Order form — ${order.reference}`} />
      <PortalBody>
        <OrderFormSummary orderId={order.id} />
      </PortalBody>
    </>
  );
}
