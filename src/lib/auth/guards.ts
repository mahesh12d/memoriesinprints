import "server-only";

import { redirect } from "next/navigation";
import { getSession, type ActiveSession } from "./session";
import type { UserRole } from "@/db/schema";

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

/** Admin runs off its own cookie, so this never accepts a customer session. */
export async function requireAdmin(): Promise<ActiveSession> {
  const session = await getSession("admin");
  if (!session) redirect("/admin/login");
  if (session.user.role !== "admin") redirect("/admin/login");
  return session;
}
