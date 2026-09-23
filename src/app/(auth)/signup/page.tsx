import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create an account — Memories in Prints",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      intro="So you can follow an order and approve proofs in your own time."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent-text">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />
      <AuthDivider />

      <SignupForm />
    </AuthCard>
  );
}
