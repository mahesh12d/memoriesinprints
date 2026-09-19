"use client";

import { useActionState } from "react";
import { signupAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-[22px]">
      <FormMessage state={state} />

      <Field
        label="Your name"
        name="name"
        type="text"
        autoComplete="name"
        required
        error={state.errors?.name}
      />

      <Field
        label="Email"
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
        autoComplete="new-password"
        required
        error={state.errors?.password}
        hint="At least 10 characters. A short phrase you'll remember works well."
      />

      <SubmitButton pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
