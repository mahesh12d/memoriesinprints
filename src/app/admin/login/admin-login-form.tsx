"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLoginAction, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-[22px]">
      <FormMessage state={state} />

      <Field
        label="Admin email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.errors?.email}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors?.password}
      />

      <SubmitButton pendingLabel="Signing in…" className="bg-night-deep">
        Sign in
      </SubmitButton>
    </form>
  );
}
