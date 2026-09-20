import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { verifyEmailAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";
import { ResendButton } from "./resend-button";

export const metadata: Metadata = {
  title: "Confirm your email — Memories in Prints",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession("site");

  // Arriving from the email link.
  if (params.token) {
    const verified = await verifyEmailAction(params.token);

    return (
      <AuthCard
        title={verified ? "Email confirmed" : "That link didn't work"}
        intro={
          verified
            ? "Thank you — your address is confirmed."
            : "The link has expired or has already been used."
        }
      >
        {verified ? (
          <Link
            href={session ? "/account" : "/login"}
            className="rounded-[2px] bg-brand px-6 py-[14px] text-center text-sm font-semibold text-on-accent"
          >
            {session ? "Go to my account" : "Sign in"}
          </Link>
        ) : session ? (
          <ResendButton />
        ) : (
          <Link
            href="/login"
            className="rounded-[2px] bg-brand px-6 py-[14px] text-center text-sm font-semibold text-on-accent"
          >
            Sign in to send a new link
          </Link>
        )}
      </AuthCard>
    );
  }

  if (session?.user.emailVerifiedAt) {
    return (
      <AuthCard
        title="Email already confirmed"
        intro="Nothing more to do here."
      >
        <Link
          href="/account"
          className="rounded-[2px] bg-brand px-6 py-[14px] text-center text-sm font-semibold text-on-accent"
        >
          Go to my account
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Confirm your email"
      intro={
        params.sent
          ? "We've sent you a link. Open it to confirm your address."
          : "Please confirm your email address to continue."
      }
      footer="Check your spam folder if it hasn't arrived within a few minutes."
    >
      {session ? (
        <ResendButton />
      ) : (
        <Link
          href="/login"
          className="rounded-[2px] bg-brand px-6 py-[14px] text-center text-sm font-semibold text-on-accent"
        >
          Sign in
        </Link>
      )}
    </AuthCard>
  );
}
