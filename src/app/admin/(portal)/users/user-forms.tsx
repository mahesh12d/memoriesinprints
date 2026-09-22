"use client";

import { useActionState } from "react";
import {
  inviteUserAction,
  setUserDisabledAction,
  setUserRoleAction,
} from "@/lib/admin/user-actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { ROLE } from "@/lib/admin/labels";
import { FormMessage, SubmitButton } from "@/components/ui/form";

const fieldClass =
  "rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm";

/**
 * Role and suspension share one message area per row, so an explanation —
 * "this is the only administrator left" — lands next to the control that was
 * refused rather than at the top of the page.
 */
export function UserRow({
  userId,
  name,
  role,
  isDisabled,
  isYou,
}: {
  userId: string;
  name: string;
  role: string;
  isDisabled: boolean;
  isYou: boolean;
}) {
  const [roleState, roleAction] = useActionState(
    setUserRoleAction,
    emptyFormState,
  );
  const [disableState, disableAction] = useActionState(
    setUserDisabledAction,
    emptyFormState,
  );

  const message = roleState.message ? roleState : disableState;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <label className="sr-only" htmlFor={`role-${userId}`}>
            Role for {name}
          </label>
          <select
            id={`role-${userId}`}
            name="role"
            defaultValue={role}
            className={fieldClass}
          >
            {Object.entries(ROLE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <SubmitButton variant="secondary" pendingLabel="…">
            Save
          </SubmitButton>
        </form>

        <form action={disableAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="disable" value={String(!isDisabled)} />
          <button
            type="submit"
            disabled={isYou && !isDisabled}
            title={
              isYou && !isDisabled ? "You can't suspend your own account." : undefined
            }
            className={`rounded-[2px] border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40 ${
              isDisabled
                ? "border-field-line text-ink-muted hover:bg-surface-grey"
                : "border-alert text-alert hover:bg-alert-tint"
            }`}
          >
            {isDisabled ? "Restore" : "Suspend"}
          </button>
        </form>
      </div>

      {message.message && (
        <div className="max-w-[46ch] self-end">
          <FormMessage state={message} />
        </div>
      )}
    </div>
  );
}

export function InviteForm() {
  const [state, formAction] = useActionState(inviteUserAction, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />

      {/*
        Each control is associated by id rather than by wrapping, because a
        wrapped <label> round a <select> takes its name from everything inside
        it — the option text included — which makes the field impossible to
        address by its label.
      */}
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1.5fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="invite-name"
            className="text-[13px] font-semibold text-ink-soft"
          >
            Name
          </label>
          <input id="invite-name" name="name" required className={fieldClass} />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="invite-email"
            className="text-[13px] font-semibold text-ink-soft"
          >
            Email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="invite-role"
            className="text-[13px] font-semibold text-ink-soft"
          >
            Role
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="designer"
            className={fieldClass}
          >
            {Object.entries(ROLE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton pendingLabel="Sending…">Send the invitation</SubmitButton>
      </div>
    </form>
  );
}
