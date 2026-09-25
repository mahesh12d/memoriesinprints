"use client";

import { useActionState, useState } from "react";
import { submitEnquiryAction } from "@/lib/enquiries/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/catalogue";

/**
 * Who is asking, and the one extra thing each is asked.
 *
 * A funeral director wants trade terms, a celebrant wants to know about
 * commission, and a family wants neither put in front of them at the worst
 * week of their life.
 */
const USER_TYPES = [
  {
    value: "funeral_director",
    label: "Funeral Director",
    note: "For funeral directors placing regular orders, we’re happy to discuss pricing that works for you.",
  },
  {
    value: "celebrant",
    label: "Celebrant",
    note: "We’re open to commission-based collaborations and would be delighted to discuss working together.",
  },
  { value: "client", label: "Client", note: null },
] as const;

export function QuoteForm({
  defaults,
}: {
  defaults: {
    name: string;
    email: string;
    phone: string;
    category: string;
    subject: string;
  };
}) {
  const [state, formAction] = useActionState(
    submitEnquiryAction,
    emptyFormState,
  );
  const [category, setCategory] = useState(defaults.category);
  const [userType, setUserType] = useState<string>("client");

  const note = USER_TYPES.find((one) => one.value === userType)?.note ?? null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormMessage state={state} />

      {/*
        One category on offer, so it travels as a hidden value rather than a
        row of chips with nothing to choose between. Put a second category
        back in CATEGORIES and the chips return.
      */}
      {CATEGORIES.length === 1 ? (
        <input type="hidden" name="category" value={CATEGORIES[0]} />
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-[13px] font-semibold text-ink-soft">
            Project type
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORIES.map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-full border px-5 py-2.5 text-[13px] font-semibold transition-colors ${
                  category === value
                    ? "border-band bg-band text-white"
                    : "border-line bg-card text-ink-soft hover:border-brand"
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={value}
                  checked={category === value}
                  onChange={() => setCategory(value)}
                  className="sr-only"
                />
                {CATEGORY_LABEL[value]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[13px] font-semibold text-ink-soft">
          User type
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {USER_TYPES.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full border px-5 py-2.5 text-[13px] font-semibold transition-colors ${
                userType === option.value
                  ? "border-band bg-band text-white"
                  : "border-line bg-card text-ink-soft hover:border-brand"
              }`}
            >
              <input
                type="radio"
                name="userType"
                value={option.value}
                checked={userType === option.value}
                onChange={() => setUserType(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {state.errors?.userType && (
          <p className="text-xs font-medium text-alert">
            {state.errors.userType}
          </p>
        )}

        {/*
          Said here rather than asked for. Trade terms and commission are a
          conversation, not a form field — putting a box in front of someone
          invites them to negotiate before the studio has seen the job.
        */}
        {note && (
          <p className="rounded-[4px] bg-brand-tint px-[14px] py-3 text-[13px] leading-relaxed text-ink-soft">
            {note}
          </p>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Full name"
          name="name"
          defaultValue={defaults.name}
          autoComplete="name"
          required
          error={state.errors?.name}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={defaults.email}
          autoComplete="email"
          required
          error={state.errors?.email}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Phone (optional)"
          name="phone"
          type="tel"
          defaultValue={defaults.phone}
          autoComplete="tel"
          error={state.errors?.phone}
        />
        <Field
          label="Date needed by"
          name="eventDate"
          type="date"
          error={state.errors?.eventDate}
        />
        <Field
          label="Estimated quantity"
          name="estimatedQuantity"
          type="number"
          min={1}
          error={state.errors?.estimatedQuantity}
        />
      </div>

      <Field
        label="What do you need?"
        name="subject"
        defaultValue={defaults.subject}
        placeholder="Order of service, 80 copies"
        required
        error={state.errors?.subject}
      />

      <Field label="Project details" name="message" error={state.errors?.message}>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          aria-invalid={state.errors?.message ? true : undefined}
          placeholder="Tell us about the service or occasion, any wording or photographs you'd like included, and the date you're working towards."
          className={`w-full rounded-[3px] border bg-card px-[15px] py-[13px] font-sans text-sm text-blue placeholder:text-placeholder ${
            state.errors?.message ? "border-alert" : "border-field-line"
          }`}
        />
      </Field>

      <p className="text-[12px] leading-relaxed text-ink-quiet">
        We use your details only to answer this enquiry.
      </p>

      <SubmitButton className="self-start" pendingLabel="Sending…">
        Send request
      </SubmitButton>
    </form>
  );
}
