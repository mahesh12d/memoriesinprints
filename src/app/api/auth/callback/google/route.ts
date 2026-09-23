import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth/session";
import { mergeGuestCart } from "@/lib/cart/cart";
import {
  exchangeCode,
  googleConfigured,
  NEXT_COOKIE,
  sameToken,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  type GoogleIdentity,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
}

/**
 * Where Google sends the person back to.
 *
 * Everything here is checked before anyone is signed in: the state must match
 * the cookie, the code must redeem against the PKCE verifier this server
 * kept, and the resulting identity must carry a Google-verified address.
 */
export async function GET(request: Request) {
  if (!googleConfigured()) return back(request, "google-unavailable");

  const url = new URL(request.url);
  const store = await cookies();

  const stateCookie = store.get(STATE_COOKIE)?.value ?? "";
  const verifier = store.get(VERIFIER_COOKIE)?.value ?? "";
  const next = store.get(NEXT_COOKIE)?.value ?? "";

  // Single use, whatever happens next.
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NEXT_COOKIE]) {
    store.delete(name);
  }

  // Someone who declines the Google prompt arrives here with an error.
  if (url.searchParams.get("error")) return back(request, "google-cancelled");

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!code || !state || !stateCookie || !verifier) {
    return back(request, "google-failed");
  }

  // The CSRF check. A forged callback has no matching cookie.
  if (!sameToken(state, stateCookie)) return back(request, "google-failed");

  const identity = await exchangeCode(code, verifier);
  if (!identity) return back(request, "google-failed");

  /**
   * An unverified address must never be trusted: anyone can put someone
   * else's email on an account they control, and honouring it here would
   * hand them the matching account on this site.
   */
  if (!identity.emailVerified) return back(request, "google-unverified");

  const user = await findOrCreate(identity);
  if (!user) return back(request, "google-failed");
  if (user.isDisabled) return back(request, "account-disabled");

  // Admins sign in through their own form and their own cookie. Google can
  // never mint an admin session, whatever the account's role says.
  if (user.role === "admin") return back(request, "admin-uses-own-login");

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await createSession(user.id, "site");
  await mergeGuestCart(user.id);

  const destination =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : user.role === "customer"
        ? "/account"
        : "/staff";

  return NextResponse.redirect(new URL(destination, request.url));
}

type Matched = { id: string; role: string; isDisabled: boolean };

/**
 * Finds the person behind this Google account, or makes one.
 *
 * Matching goes by Google's subject id first and the email address second,
 * because someone can change the address on their Google account and would
 * otherwise come back as a stranger.
 *
 * Linking by email is only safe because the caller has already established
 * that Google verified it.
 */
async function findOrCreate(
  identity: GoogleIdentity,
): Promise<Matched | null> {
  const [byGoogleId] = await db
    .select({ id: users.id, role: users.role, isDisabled: users.isDisabled })
    .from(users)
    .where(eq(users.googleId, identity.googleId))
    .limit(1);

  if (byGoogleId) return byGoogleId;

  const [byEmail] = await db
    .select({ id: users.id, role: users.role, isDisabled: users.isDisabled })
    .from(users)
    .where(eq(users.email, identity.email))
    .limit(1);

  if (byEmail) {
    // An existing password account, signing in with Google for the first
    // time. The password keeps working; this just adds the second way in.
    await db
      .update(users)
      .set({
        googleId: identity.googleId,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id));

    return byEmail;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: identity.email,
      name: identity.name ?? identity.email.split("@")[0],
      googleId: identity.googleId,
      // No password: this account signs in through Google. The login form
      // refuses it rather than treating a missing hash as a match.
      passwordHash: null,
      // Google has already proved the address, so there is nothing to verify.
      emailVerifiedAt: new Date(),
    })
    .returning({
      id: users.id,
      role: users.role,
      isDisabled: users.isDisabled,
    });

  return created ?? null;
}
