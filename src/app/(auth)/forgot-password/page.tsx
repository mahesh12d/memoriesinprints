import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password — Memories in Prints",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset Your Password"
      intro="We'll email you a link to choose a new one."
      footer={
        <Link href="/login" className="font-semibold text-accent-text">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
