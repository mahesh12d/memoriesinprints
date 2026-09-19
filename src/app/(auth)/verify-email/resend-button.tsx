"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export function ResendButton() {
  const [state, formAction] = useActionState(
    async () => resendVerificationAction(),
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Sending…">
        Send me a new link
      </SubmitButton>
    </form>
  );
}
