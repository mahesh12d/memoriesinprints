"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/auth/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    emptyFormState,
  );

  return (
    <form
      action={formAction}
      className="flex max-w-[760px] flex-col gap-[22px] rounded-md border border-line bg-white p-9"
    >
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-5">
        <Field
          label="Full name"
          name="name"
          defaultValue={profile.name}
          autoComplete="name"
          required
          error={state.errors?.name}
        />
        <Field
          label="Phone"
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ""}
          autoComplete="tel"
          error={state.errors?.phone}
        />
      </div>

      <Field
        label="Email"
        name="email"
        hint="Contact the studio if you need this changed."
      >
        <input
          id="email"
          value={profile.email}
          disabled
          className="w-full rounded-[3px] border border-line bg-line-warm px-[15px] py-[13px] text-sm text-ink-muted"
        />
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field
          label="Address line 1"
          name="addressLine1"
          defaultValue={profile.addressLine1 ?? ""}
          autoComplete="address-line1"
          error={state.errors?.addressLine1}
        />
        <Field
          label="Address line 2"
          name="addressLine2"
          defaultValue={profile.addressLine2 ?? ""}
          autoComplete="address-line2"
          error={state.errors?.addressLine2}
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Field
          label="Town or city"
          name="city"
          defaultValue={profile.city ?? ""}
          autoComplete="address-level2"
          error={state.errors?.city}
        />
        <Field
          label="Postcode"
          name="postcode"
          defaultValue={profile.postcode ?? ""}
          autoComplete="postal-code"
          error={state.errors?.postcode}
        />
        <Field
          label="Country"
          name="country"
          defaultValue={profile.country ?? "United Kingdom"}
          autoComplete="country-name"
          error={state.errors?.country}
        />
      </div>

      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
