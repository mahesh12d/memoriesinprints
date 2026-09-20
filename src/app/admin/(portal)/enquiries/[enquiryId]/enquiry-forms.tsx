"use client";

import { useActionState } from "react";
import {
  convertEnquiryAction,
  quoteEnquiryAction,
  setEnquiryStatusAction,
} from "@/lib/admin/enquiry-actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { ENQUIRY_STATUS } from "@/lib/admin/labels";
import { FormMessage, SelectField, SubmitButton } from "@/components/ui/form";

export function StatusForm({
  enquiryId,
  current,
}: {
  enquiryId: string;
  current: string;
}) {
  const [state, formAction] = useActionState(
    setEnquiryStatusAction,
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="enquiryId" value={enquiryId} />

      <SelectField
        id={`enquiry-status-${enquiryId}`}
        label="Status"
        name="status"
        defaultValue={current}
      >
        {Object.entries(ENQUIRY_STATUS).map(([value, label]) => (
          <option key={value} value={value}>
            {label.label}
          </option>
        ))}
      </SelectField>

      <SubmitButton className="self-start" variant="secondary" pendingLabel="Saving…">
        Save status
      </SubmitButton>
    </form>
  );
}

export function QuoteForm({
  enquiryId,
  currentAmount,
  currentNotes,
}: {
  enquiryId: string;
  currentAmount: number | null;
  currentNotes: string | null;
}) {
  const [state, formAction] = useActionState(quoteEnquiryAction, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="enquiryId" value={enquiryId} />

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          Amount quoted
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">£</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={
              currentAmount === null ? "" : (currentAmount / 100).toFixed(2)
            }
            className="w-40 rounded-[3px] border border-field-line bg-white px-3 py-2.5 text-sm"
          />
        </div>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          What the quote covers
        </span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={currentNotes ?? ""}
          placeholder="100 order of service booklets on 170gsm silk, folded and stitched, one proof included."
          className="w-full rounded-[3px] border border-field-line bg-white px-3 py-2.5 font-sans text-sm"
        />
        <span className="text-[12px] text-ink-quiet">
          The customer sees this, so write it for them.
        </span>
      </label>

      <SubmitButton className="self-start" pendingLabel="Sending…">
        {currentAmount === null ? "Send the quote" : "Update the quote"}
      </SubmitButton>
    </form>
  );
}

export function ConvertForm({
  enquiryId,
  disabledReason,
}: {
  enquiryId: string;
  disabledReason: string | null;
}) {
  const [state, formAction] = useActionState(
    convertEnquiryAction,
    emptyFormState,
  );

  if (disabledReason) {
    return <p className="text-[13px] text-ink-muted">{disabledReason}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <SubmitButton className="self-start" pendingLabel="Raising…">
        Raise an order from this
      </SubmitButton>
    </form>
  );
}
