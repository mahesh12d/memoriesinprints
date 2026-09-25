import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password — Memories in Prints",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard
        title="That Link Is Incomplete"
        intro="Please use the link from your email, or ask for a new one."
      >
        <Link
          href="/forgot-password"
          className="rounded-[2px] bg-brand px-6 py-[14px] text-center text-sm font-semibold text-on-accent"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a New Password"
      intro="Signing you out of every device once it's saved."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
