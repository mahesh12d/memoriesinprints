import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import {
  AuthDivider,
  GOOGLE_ERRORS,
  GoogleButton,
} from "@/components/auth/google-button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Memories in Prints" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : undefined;

  return (
    <AuthCard
      title="Sign In"
      intro="Track your orders, review proofs and manage your details."
    >
      {params.reset && (
        <p
          role="status"
          className="rounded-[4px] bg-good-tint px-[14px] py-3 text-[13px] leading-relaxed text-good-deep"
        >
          Your password has been changed. Please sign in with your new password.
        </p>
      )}

      {params.error && GOOGLE_ERRORS[params.error] && (
        <p
          role="alert"
          className="rounded-[4px] bg-alert-tint px-[14px] py-3 text-[13px] leading-relaxed text-alert"
        >
          {GOOGLE_ERRORS[params.error]}
        </p>
      )}

      <GoogleButton next={next} />
      <AuthDivider />

      <LoginForm next={next} />
    </AuthCard>
  );
}
