import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Google sign-in, on top of the sessions this app already issues.
 *
 * Google is used only to prove who someone is. Once it has, the person gets
 * exactly the same session cookie as a password sign-in, so every guard,
 * role check and revocation path downstream is unchanged.
 *
 * Two protections matter here and are not optional:
 *
 *   state   a random value echoed back by Google and compared against a
 *           cookie, so a link someone was tricked into following cannot
 *           complete a sign-in as the attacker's account.
 *
 *   PKCE    a secret this server keeps and only reveals when redeeming the
 *           code, so an intercepted code is useless on its own.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const STATE_COOKIE = "mip_oauth_state";
export const VERIFIER_COOKIE = "mip_oauth_verifier";
export const NEXT_COOKIE = "mip_oauth_next";

/** Long enough that guessing is hopeless, short enough to sit in a cookie. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Constant-time compare, so the state check leaks nothing through timing. */
export function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * Must match a redirect URI registered in Google Cloud Console exactly,
 * including the scheme and any port.
 */
export function redirectUri(): string {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return `${base}/api/auth/callback/google`;
}

export function authorizeUrl(state: string, verifier: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallengeFor(verifier),
    code_challenge_method: "S256",
    // Ask every time rather than silently reusing a Google session, so
    // someone on a shared computer is not signed in as the last person.
    prompt: "select_account",
  });

  return `${AUTH_ENDPOINT}?${params}`;
}

export type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

/**
 * Redeems the code and reads the identity out of the id token.
 *
 * The token arrives straight from Google's token endpoint over TLS, on a
 * request authenticated with the client secret, so its signature does not
 * need re-checking here — but the claims inside still do. An id token minted
 * for a different application would otherwise be accepted.
 */
export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<GoogleIdentity | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });

  if (!response.ok) {
    console.error("[google] token exchange failed", response.status);
    return null;
  }

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) return null;

  return readIdToken(payload.id_token);
}

function readIdToken(idToken: string): GoogleIdentity | null {
  const [, body] = idToken.split(".");
  if (!body) return null;

  let claims: {
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
  };

  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const issuerOk =
    claims.iss === "accounts.google.com" ||
    claims.iss === "https://accounts.google.com";

  // The audience check is what stops an id token issued for some other site
  // being replayed here.
  const audienceOk = claims.aud === process.env.GOOGLE_CLIENT_ID;
  const notExpired = typeof claims.exp === "number" && claims.exp * 1000 > Date.now();

  if (!issuerOk || !audienceOk || !notExpired || !claims.sub || !claims.email) {
    console.error("[google] id token rejected", {
      issuerOk,
      audienceOk,
      notExpired,
    });
    return null;
  }

  return {
    googleId: claims.sub,
    email: claims.email.trim().toLowerCase(),
    // Google sends this as a boolean or the string "true" depending on flow.
    emailVerified:
      claims.email_verified === true || claims.email_verified === "true",
    name: claims.name?.trim() || null,
  };
}
