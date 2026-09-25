import "server-only";

import { redirect } from "next/navigation";
import { getSession, type ActiveSession } from "./session";
import type { UserRole } from "@/db/schema";

// Re-exported so a page can reach for one guard import rather than two.
export {
  canSeeAllOrders,
  canSeeMoney,
  canUploadProofs,
  mayOpenProof,
} from "./capabilities";

export const STAFF_ROLES: UserRole[] = ["designer", "proofreader"];

export function isStaff(role: UserRole): boolean {
  return role === "designer" || role === "proofreader";
}

/**
 * Middleware already turns anonymous visitors away, but every protected page
 * and action calls one of these too: the cookie check in middleware proves a
 * cookie exists, not that it maps to a live session with the right role.
 */
export async function requireUser(): Promise<ActiveSession> {
  const session = await getSession("site");
  if (!session) redirect("/login");
  return session;
}

/** For pages that must not be seen before the address is confirmed. */
export async function requireVerifiedUser(): Promise<ActiveSession> {
  const session = await requireUser();
  if (!session.user.emailVerifiedAt) redirect("/verify-email");
  return session;
}

export async function requireStaff(): Promise<ActiveSession> {
  const session = await getSession("site");
  if (!session) redirect("/login?next=/staff");
  if (!isStaff(session.user.role)) redirect("/account");
  return session;
}

export async function requireProofreader(): Promise<ActiveSession> {
  const session = await requireStaff();
  if (session.user.role !== "proofreader") redirect("/staff");
  return session;
}

/**
 * Whoever is logged in, in whichever portal they are logged into.
 *
 * The two cookies are deliberately not interchangeable, and every guard above
 * picks one — which is right for a page, because a page belongs to one portal.
 * A handful of things belong to all of them: the notification bell is in the
 * customer sidebar, the studio sidebar and the admin sidebar, and marking a row
 * read must work from all three. Asking for the site session alone would send an
 * admin who clicked their own bell to the customer login form.
 *
 * It grants nothing either cookie does not already grant: the caller still gets
 * one identity, and everything it can reach is still scoped to that person.
 * Where a scope genuinely matters, use the guard for it.
 */
export async function requireViewer(): Promise<ActiveSession> {
  const site = await getSession("site");
  if (site) return site;

  const admin = await getSession("admin");
  if (admin) return admin;

  redirect("/login");
}

/** Admin runs off its own cookie, so this never accepts a customer session. */
export async function requireAdmin(): Promise<ActiveSession> {
  const session = await getSession("admin");
  if (!session) redirect("/admin/login");
  if (session.user.role !== "admin") redirect("/admin/login");
  return session;
}
