"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-[22px]">
      {next && <input type="hidden" name="next" value={next} />}

      <FormMessage state={state} />

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
        autoComplete="current-password"
        required
        error={state.errors?.password}
      />

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>

      <div className="flex justify-between text-[13px]">
        <Link href="/forgot-password" className="font-semibold text-warm">
          Forgotten your password?
        </Link>
        <Link href="/signup" className="font-semibold text-warm">
          Create an account
        </Link>
      </div>
    </form>
  );
}
