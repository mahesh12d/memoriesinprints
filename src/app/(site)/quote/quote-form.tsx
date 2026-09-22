"use client";

import { useActionState, useState } from "react";
import { submitEnquiryAction } from "@/lib/enquiries/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/catalogue";

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

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormMessage state={state} />

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
        {state.errors?.category && (
          <p className="text-xs font-medium text-alert">
            {state.errors.category}
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
          label="Date needed by (optional)"
          name="eventDate"
          type="date"
          error={state.errors?.eventDate}
        />
        <Field
          label="Estimated quantity (optional)"
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
        We use your details only to answer this enquiry. Uploading reference
        files arrives with the next release — for now, mention them and
        we&rsquo;ll ask by email.
      </p>

      <SubmitButton className="self-start" pendingLabel="Sending…">
        Send request
      </SubmitButton>
    </form>
  );
}
