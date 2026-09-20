"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityEvents, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { fail, type FormState } from "@/lib/auth/form-state";
import { emailField } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { issueToken } from "@/lib/auth/tokens";
import { revokeAllSessions } from "@/lib/auth/session";
import { sendMail } from "@/lib/mail/mailer";
import { resetPasswordMail } from "@/lib/mail/templates";
import { canChangeRole, canDisable, type UserRole } from "./user-rules";

const ROLES = ["customer", "designer", "proofreader", "admin"] as const;

/** Enabled administrators. Used by the rules that stop a lock-out. */
async function adminCount(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isDisabled, false)));

  return row?.value ?? 0;
}

export async function setUserRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const parsed = z
    .object({ userId: z.string().uuid(), role: z.enum(ROLES) })
    .safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
    });

  if (!parsed.success) return fail("That role isn't one we recognise.");

  const [target] = await db
    .select({ id: users.id, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);

  if (!target) return fail("That account no longer exists.");

  const verdict = canChangeRole({
    targetId: target.id,
    currentRole: target.role as UserRole,
    nextRole: parsed.data.role,
    actorId: session.user.id,
    adminCount: await adminCount(),
  });

  if (!verdict.allowed) return fail(verdict.reason);

  await db
    .update(users)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(users.id, target.id));

  // The role decides which portal they land in and what the guards allow, so
  // their existing sessions are ended rather than left holding the old one.
  await revokeAllSessions(target.id);

  await db.insert(activityEvents).values({
    actorId: session.user.id,
    type: "role_changed",
    summary: `${target.name} is now ${parsed.data.role}`,
  });

  revalidatePath("/admin/users");

  return {
    ok: true,
    message: `${target.name} is now ${parsed.data.role}. They'll need to sign in again.`,
  };
}

export async function setUserDisabledAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const disable = formData.get("disable") === "true";

  if (!z.string().uuid().safeParse(userId).success) {
    return fail("That account isn't one we recognise.");
  }

  const [target] = await db
    .select({ id: users.id, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) return fail("That account no longer exists.");

  const verdict = canDisable({
    targetId: target.id,
    targetRole: target.role as UserRole,
    actorId: session.user.id,
    adminCount: await adminCount(),
    disable,
  });

  if (!verdict.allowed) return fail(verdict.reason);

  await db
    .update(users)
    .set({ isDisabled: disable, updatedAt: new Date() })
    .where(eq(users.id, target.id));

  if (disable) await revokeAllSessions(target.id);

  await db.insert(activityEvents).values({
    actorId: session.user.id,
    type: disable ? "account_suspended" : "account_restored",
    summary: `${target.name}'s account was ${disable ? "suspended" : "restored"}`,
  });

  revalidatePath("/admin/users");

  return {
    ok: true,
    message: disable
      ? `${target.name} can no longer sign in.`
      : `${target.name} can sign in again.`,
  };
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(120),
  email: emailField,
  role: z.enum(ROLES),
});

/**
 * Creates a staff account and emails them a link to set their own password.
 *
 * No password is ever chosen on their behalf and sent to them: the account is
 * created with a random one nobody knows, and the reset link is what lets them
 * in. The address is marked verified because an administrator vouched for it.
 */
export async function inviteUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That invitation didn't send.");
  }

  const { name, email, role } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return fail("Somebody already has an account with that address.");
  }

  const [created] = await db
    .insert(users)
    .values({
      name,
      email,
      role,
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });

  const token = await issueToken(created.id, "password_reset");
  await sendMail(resetPasswordMail(email, name, token));

  await db.insert(activityEvents).values({
    actorId: session.user.id,
    type: "user_invited",
    summary: `${name} was invited as ${role}`,
  });

  revalidatePath("/admin/users");

  return {
    ok: true,
    message: `${name} has been sent a link to set their password.`,
  };
}
