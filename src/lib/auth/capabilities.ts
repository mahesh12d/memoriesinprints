import type { UserRole } from "@/db/schema";

/**
 * Who may see and do what, kept out of guards.ts because that module is
 * `server-only` and these answers are wanted in components and in tests.
 *
 * Every rule here is a deliberate restriction, not an accident of the UI: the
 * pages hide what these forbid, and the server actions refuse it.
 */

/**
 * What the studio floor is allowed to know.
 *
 * Designers and proofreaders work the artwork, not the invoice, so no money
 * reaches them: no order total, no line prices, no payment amounts. Customers
 * still see what they themselves are paying, and admin sees everything.
 */
export function canSeeMoney(role: UserRole): boolean {
  return role !== "designer" && role !== "proofreader";
}

/** Only the designer draws. A proofreader checks work, never replaces it. */
export function canUploadProofs(role: UserRole): boolean {
  return role === "designer" || role === "admin";
}

/**
 * A designer sees the orders assigned to them and nothing else — not other
 * designers' jobs, and not the unassigned pool. Proofreaders and admin need
 * the whole board to route work.
 */
export function canSeeAllOrders(role: UserRole): boolean {
  return role !== "designer";
}

/**
 * Whether this person may open a given order's proof at all.
 *
 * The customer it belongs to, the designer it is assigned to, and anyone who
 * routes work. Nobody else — a designer holding a proof id for another
 * designer's job is refused, because the row behind it carries the customer's
 * name and email as well as the artwork.
 */
export function mayOpenProof(
  viewer: { id: string; role: UserRole },
  order: { ownerId: string; assignedDesignerId: string | null },
): boolean {
  if (order.ownerId === viewer.id) return true;
  if (viewer.role === "customer") return false;
  if (canSeeAllOrders(viewer.role)) return true;
  return order.assignedDesignerId === viewer.id;
}
