"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(
    changePasswordAction,
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex max-w-[420px] flex-col gap-5">
      <FormMessage state={state} />

      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors?.currentPassword}
      />

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

      <SubmitButton className="self-start" pendingLabel="Saving…">
        Change password
      </SubmitButton>
    </form>
  );
}
