"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  changePasswordSchema,
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail/mailer";
import {
  passwordChangedMail,
  resetPasswordMail,
  verifyEmailMail,
} from "@/lib/mail/templates";
import { fakeVerifyDelay, hashPassword, verifyPassword } from "./password";
import { BREACHED_MESSAGE, isBreachedPassword } from "./breached";
import { consumeToken, issueToken } from "./tokens";
import {
  createSession,
  destroySession,
  getSession,
  revokeAllSessions,
  revokeOtherSessions,
  revokeSession,
} from "./session";
import { isStaff } from "./guards";
import { mergeGuestCart } from "@/lib/cart/cart";
import { fail, type FormState } from "./form-state";
import { clientIp as clientKey } from "@/lib/client-ip";



/** Where a person lands after signing in, based on what they are. */
function homeForRole(role: string): string {
  if (role === "admin") return "/admin";
  if (isStaff(role as never)) return "/staff";
  return "/account";
}

/* -------------------------------------------------------------------------- */
/* Sign up                                                                    */
/* -------------------------------------------------------------------------- */

export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("Please check the form.", fieldErrors(parsed.error));
  }

  const limit = await rateLimit(`signup:${await clientKey()}`, LIMITS.signup(), 900);
  if (!limit.ok) {
    return fail("Too many attempts. Please try again in a few minutes.");
  }

  const { name, email, password } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    // Don't confirm that an address is registered. Tell the real owner instead.
    const token = await issueToken(existing[0].id, "email_verification");
    await sendMail(verifyEmailMail(email, name, token));
    redirect("/verify-email?sent=1");
  }

  if (await isBreachedPassword(password)) {
    return fail(BREACHED_MESSAGE, { password: BREACHED_MESSAGE });
  }

  const passwordHash = await hashPassword(password);

  const [created] = await db
    .insert(users)
    .values({ name, email, passwordHash, role: "customer" })
    .returning({ id: users.id });

  const token = await issueToken(created.id, "email_verification");
  await sendMail(verifyEmailMail(email, name, token));

  await createSession(created.id, "site");
  await mergeGuestCart(created.id);
  redirect("/verify-email?sent=1");
}

/* -------------------------------------------------------------------------- */
/* Log in / out                                                               */
/* -------------------------------------------------------------------------- */

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("Please check the form.", fieldErrors(parsed.error));
  }

  const { email, password } = parsed.data;

  const limit = await rateLimit(`login:${email}:${await clientKey()}`, LIMITS.login(), 900);
  if (!limit.ok) {
    return fail(
      `Too many sign-in attempts. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    );
  }

  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      role: users.role,
      isDisabled: users.isDisabled,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];

  if (!user) {
    await fakeVerifyDelay();
    return fail("That email and password don't match an account.");
  }

  // An account created through Google has no password. Burning the same time
  // as a real check keeps it indistinguishable from a wrong password, so this
  // can't be used to discover which accounts use Google.
  if (!user.passwordHash) {
    await fakeVerifyDelay();
    return fail("That email and password don't match an account.");
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid || user.isDisabled) {
    return fail("That email and password don't match an account.");
  }

  /**
   * Admins sign in at /admin/login only — this keeps the two systems apart.
   *
   * The refusal reads exactly like a wrong password, deliberately. Naming the
   * admin portal here announced its existence to anyone who reached this line
   * and confirmed the address belonged to an administrator. Everything above
   * goes to some trouble to keep failures indistinguishable — the fake verify
   * delay exists for precisely that reason — and this was the one line giving
   * it away.
   */
  if (user.role === "admin") {
    return fail("That email and password don't match an account.");
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await createSession(user.id, "site");
  await mergeGuestCart(user.id);

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : homeForRole(user.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession("site");
  redirect("/");
}

/* -------------------------------------------------------------------------- */
/* Admin login — separate cookie, separate entry point                        */
/* -------------------------------------------------------------------------- */

export async function adminLoginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("Please check the form.", fieldErrors(parsed.error));
  }

  const { email, password } = parsed.data;

  const limit = await rateLimit(`admin-login:${email}:${await clientKey()}`, LIMITS.adminLogin(), 900);
  if (!limit.ok) {
    return fail("Too many sign-in attempts. Please try again shortly.");
  }

  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      role: users.role,
      isDisabled: users.isDisabled,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];

  if (!user) {
    await fakeVerifyDelay();
    return fail("Those details don't match an admin account.");
  }

  if (!user.passwordHash) {
    await fakeVerifyDelay();
    return fail("Those details don't match an admin account.");
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid || user.isDisabled || user.role !== "admin") {
    return fail("Those details don't match an admin account.");
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await createSession(user.id, "admin");
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await destroySession("admin");
  redirect("/admin/login");
}

/* -------------------------------------------------------------------------- */
/* Email verification                                                         */
/* -------------------------------------------------------------------------- */

export async function verifyEmailAction(token: string): Promise<boolean> {
  const result = await consumeToken(token, "email_verification");
  if (!result) return false;

  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, result.userId));

  return true;
}

export async function resendVerificationAction(): Promise<FormState> {
  const session = await getSession("site");
  if (!session) return fail("Please sign in first.");
  if (session.user.emailVerifiedAt) {
    return { ok: true, message: "Your email address is already confirmed." };
  }

  const limit = await rateLimit(`verify-resend:${session.user.id}`, 3, 600);
  if (!limit.ok) {
    return fail("We've just sent one. Please check your inbox and spam folder.");
  }

  const token = await issueToken(session.user.id, "email_verification");
  await sendMail(verifyEmailMail(session.user.email, session.user.name, token));

  return { ok: true, message: "Confirmation email sent." };
}

/* -------------------------------------------------------------------------- */
/* Forgotten / reset / change password                                        */
/* -------------------------------------------------------------------------- */

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return fail("Please check the form.", fieldErrors(parsed.error));
  }

  const limit = await rateLimit(`forgot:${await clientKey()}`, LIMITS.forgotPassword(), 900);
  if (!limit.ok) {
    return fail("Too many requests. Please try again in a few minutes.");
  }

  const rows = await db
    .select({ id: users.id, name: users.name, isDisabled: users.isDisabled })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  const user = rows[0];

  if (user && !user.isDisabled) {
    const token = await issueToken(user.id, "password_reset");
    await sendMail(resetPasswordMail(parsed.data.email, user.name, token));
  }

  // Always the same answer, whether or not the address is registered.
  return {
    ok: true,
    message:
      "If that address has an account, a reset link is on its way. Check your spam folder if it doesn't arrive.",
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return fail("Please check the form.", fieldErrors(parsed.error));
  }

  const result = await consumeToken(parsed.data.token, "password_reset");
  if (!result) {
    return fail(
      "That reset link has expired or has already been used. Please request a new one.",
    );
  }

  if (await isBreachedPassword(parsed.data.password)) {
    return fail(BREACHED_MESSAGE, { password: BREACHED_MESSAGE });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const [user] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, result.userId))
    .returning({ email: users.email, name: users.name });

  // A reset is a recovery action: sign every device out, including this one.
  await revokeAllSessions(result.userId);

  if (user) await sendMail(passwordChangedMail(user.email, user.name));

  redirect("/login?reset=1");
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession("site");
  if (!session) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return fail("Please check the form.", fieldErrors(parsed.error));
  }

  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const valid = await verifyPassword(
    rows[0]?.passwordHash ?? "",
    parsed.data.currentPassword,
  );

  if (!valid) {
    return fail("Your current password isn't right.", {
      currentPassword: "Your current password isn't right",
    });
  }

  if (await isBreachedPassword(parsed.data.password)) {
    return fail(BREACHED_MESSAGE, { password: BREACHED_MESSAGE });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  // Keep this device, drop the rest.
  await revokeOtherSessions(session.user.id, session.id);
  await sendMail(passwordChangedMail(session.user.email, session.user.name));

  revalidatePath("/account/security");
  return {
    ok: true,
    message: "Password changed. Other devices have been signed out.",
  };
}

/* -------------------------------------------------------------------------- */
/* Sessions and profile                                                       */
/* -------------------------------------------------------------------------- */

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const session = await getSession("site");
  if (!session) redirect("/login");

  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string") return;

  if (sessionId === session.id) {
    await destroySession("site");
    redirect("/login");
  }

  await revokeSession(session.user.id, sessionId);
  revalidatePath("/account/security");
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const session = await getSession("site");
  if (!session) redirect("/login");

  await revokeOtherSessions(session.user.id, session.id);
  revalidatePath("/account/security");
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession("site");
  if (!session) redirect("/login");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    postcode: formData.get("postcode"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return fail("Please check the form.", fieldErrors(parsed.error));
  }

  const blankToNull = (value?: string) => (value?.trim() ? value.trim() : null);

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      phone: blankToNull(parsed.data.phone),
      addressLine1: blankToNull(parsed.data.addressLine1),
      addressLine2: blankToNull(parsed.data.addressLine2),
      city: blankToNull(parsed.data.city),
      postcode: blankToNull(parsed.data.postcode),
      country: blankToNull(parsed.data.country),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/account/profile");
  return { ok: true, message: "Profile saved." };
}
