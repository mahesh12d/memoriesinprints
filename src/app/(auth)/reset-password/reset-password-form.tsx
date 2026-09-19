"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[22px]">
      <input type="hidden" name="token" value={token} />

      <FormMessage state={state} />

      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors?.password}
        hint="At least 10 characters."
      />

      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors?.confirmPassword}
      />

      <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
    </form>
  );
}
