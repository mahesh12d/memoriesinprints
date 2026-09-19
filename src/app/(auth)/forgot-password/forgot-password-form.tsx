"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[22px]">
      <FormMessage state={state} />

      {!state.ok && (
        <>
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={state.errors?.email}
          />
          <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
        </>
      )}
    </form>
  );
}
