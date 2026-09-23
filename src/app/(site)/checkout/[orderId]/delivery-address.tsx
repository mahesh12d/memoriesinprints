"use client";

import { useActionState, useState } from "react";
import { saveOrderAddressAction } from "@/lib/payments/checkout";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export type Address = {
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingPostcode: string | null;
  shippingCountry: string | null;
};

/**
 * Where this order is going.
 *
 * The address is copied from the account when the order is placed, because a
 * funeral director sends nearly everything to the same place. It shows as
 * plain text with a way to change it, rather than as a form — a form on every
 * order invites edits nobody needed to make, and this is usually just right.
 *
 * When there is no address it opens as a form straight away, because there is
 * nothing to confirm and something genuinely has to be filled in before the
 * parcel can go anywhere.
 */
export function DeliveryAddress({
  orderId,
  address,
  editable,
}: {
  orderId: string;
  address: Address;
  /** False once the parcel is on its way — then it is a record, not a plan. */
  editable: boolean;
}) {
  const [state, formAction] = useActionState(
    saveOrderAddressAction,
    emptyFormState,
  );

  const lines = [
    address.shippingName,
    address.shippingLine1,
    address.shippingLine2,
    address.shippingCity,
    address.shippingPostcode,
    address.shippingCountry,
  ].filter(Boolean);

  const missing = !address.shippingLine1;
  const [open, setOpen] = useState(missing);

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <address className="text-[14px] not-italic leading-relaxed text-ink-soft">
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>

        {state.ok && state.message && (
          <p className="text-[13px] font-semibold text-good-deep" role="status">
            {state.message}
          </p>
        )}

        {editable && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-fit text-[13px] font-semibold text-accent-text hover:underline"
          >
            Send this order somewhere else
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />

      {missing && (
        <p className="rounded-[4px] bg-pending-tint px-[14px] py-3 text-[13px] leading-relaxed text-pending-deep">
          We don&rsquo;t have an address for this order. Add one here and
          we&rsquo;ll save it against this order only.
        </p>
      )}

      <Field
        label="Addressed to"
        name="shippingName"
        defaultValue={address.shippingName ?? ""}
        error={state.errors?.shippingName}
        autoComplete="name"
      />
      <Field
        label="Address line 1"
        name="shippingLine1"
        defaultValue={address.shippingLine1 ?? ""}
        error={state.errors?.shippingLine1}
        autoComplete="address-line1"
      />
      <Field
        label="Address line 2"
        name="shippingLine2"
        defaultValue={address.shippingLine2 ?? ""}
        error={state.errors?.shippingLine2}
        autoComplete="address-line2"
      />
      <Field
        label="Town or city"
        name="shippingCity"
        defaultValue={address.shippingCity ?? ""}
        error={state.errors?.shippingCity}
        autoComplete="address-level2"
      />
      <Field
        label="Postcode"
        name="shippingPostcode"
        defaultValue={address.shippingPostcode ?? ""}
        error={state.errors?.shippingPostcode}
        autoComplete="postal-code"
      />
      <Field
        label="Country"
        name="shippingCountry"
        defaultValue={address.shippingCountry ?? "United Kingdom"}
        error={state.errors?.shippingCountry}
        autoComplete="country-name"
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save address</SubmitButton>
        {!missing && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[13px] font-semibold text-ink-muted hover:underline"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-quiet">
        This changes where this order goes. Your account address stays as it is.
      </p>
    </form>
  );
}
