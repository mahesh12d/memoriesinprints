import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = {
  title: "Admin sign in — Memories in Prints",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <AuthCard
      dark
      badge="Admin"
      title="Admin Sign In"
      intro="Separate from customer and staff accounts."
    >
      <AdminLoginForm />
    </AuthCard>
  );
}
