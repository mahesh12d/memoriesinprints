"use client";

import { useActionState } from "react";
import { emptyFormState, type FormState } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export type PriceRow = {
  id: string;
  /** The thing being priced, e.g. "Order of service — A5 booklet". */
  subject: string;
  /** Present only on the two negotiated tables. */
  customer?: string;
  amount: string;
  note?: string | null;
};

export type SelectOption = { value: string; label: string };

/**
 * Shared shell for the four price screens. Each screen passes its own options
 * and actions; nothing is shared between the tables themselves, so base prices
 * and negotiated overrides stay independent.
 */
export function PriceTable({
  rows,
  saveAction,
  deleteAction,
  itemOptions,
  itemLabel,
  itemName,
  customerOptions,
  emptyMessage,
}: {
  rows: PriceRow[];
  saveAction: (prev: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (formData: FormData) => Promise<void>;
  itemOptions: SelectOption[];
  itemLabel: string;
  itemName: string;
  customerOptions?: SelectOption[];
  emptyMessage: string;
}) {
  const [state, formAction] = useActionState(saveAction, emptyFormState);

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-md border border-line bg-card p-6"
      >
        <FormMessage state={state} />

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
          {customerOptions && (
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-soft">
                Customer
              </span>
              <select
                name="userId"
                required
                className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm"
              >
                <option value="">Choose…</option>
                {customerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-soft">
              {itemLabel}
            </span>
            <select
              name={itemName}
              required
              className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm"
            >
              <option value="">Choose…</option>
              {itemOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-soft">
              Amount
            </span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="1.85"
              className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-soft">
              Currency
            </span>
            <input
              name="currency"
              defaultValue="GBP"
              maxLength={3}
              required
              className="w-[92px] rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm uppercase"
            />
          </label>
        </div>

        {customerOptions && (
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-soft">
              Note (optional)
            </span>
            <input
              name="note"
              placeholder="Why this rate was agreed"
              className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm"
            />
          </label>
        )}

        <SubmitButton className="self-start" pendingLabel="Saving…">
          Save price
        </SubmitButton>
      </form>

      <div className="overflow-hidden rounded-md border border-line bg-card">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">
            {emptyMessage}
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-6 py-4 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{row.subject}</span>
                  {row.customer && (
                    <span className="text-xs text-ink-quiet">
                      {row.customer}
                    </span>
                  )}
                  {row.note && (
                    <span className="text-xs text-ink-quiet">{row.note}</span>
                  )}
                </div>

                <div className="flex items-center gap-5">
                  <span className="text-sm font-semibold">{row.amount}</span>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-[13px] font-semibold text-alert hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
