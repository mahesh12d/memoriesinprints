"use client";

import { useState } from "react";
import { AuthWelcomeModal } from "@/components/ui/onboarding-welcome-screen";

/**
 * Replaces the plain "Login / Signup" link with a button that opens
 * the welcome-screen modal popup. When the user is already logged in,
 * the parent simply renders a normal <Link> instead of this component.
 */
export function LoginPopupTrigger({ label }: { label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-ink-soft hover:text-blue"
      >
        {label}
      </button>

      <AuthWelcomeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
