import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  authorizeUrl,
  googleConfigured,
  NEXT_COOKIE,
  randomToken,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/** The state and verifier only need to survive the trip to Google and back. */
const TEN_MINUTES = 60 * 10;

/**
 * Starts Google sign-in.
 *
 * The state and PKCE verifier are kept in httpOnly cookies rather than in the
 * URL or in memory: they have to survive a round trip through Google and come
 * back to whichever server instance happens to handle the callback.
 */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google-unavailable", request.url),
    );
  }

  const state = randomToken();
  const verifier = randomToken();

  // Only a path on this site, never an absolute URL — otherwise this becomes
  // an open redirect that borrows the site's credibility.
  const requested = new URL(request.url).searchParams.get("next") ?? "";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "";

  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TEN_MINUTES,
  };

  store.set(STATE_COOKIE, state, options);
  store.set(VERIFIER_COOKIE, verifier, options);
  store.set(NEXT_COOKIE, next, options);

  return NextResponse.redirect(authorizeUrl(state, verifier));
}
