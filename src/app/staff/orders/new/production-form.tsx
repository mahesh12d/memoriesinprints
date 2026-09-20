"use client";

import { useActionState } from "react";
import { createProductionOrderAction } from "@/lib/admin/production-actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { FormMessage, SelectField, SubmitButton } from "@/components/ui/form";

const fieldClass =
  "w-full rounded-[3px] border border-field-line bg-white px-3 py-2.5 text-sm";

export function ProductionOrderForm({
  customers,
  designers,
}: {
  customers: { id: string; name: string; email: string }[];
  designers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    createProductionOrderAction,
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="production-customer"
          label="Who it's for"
          name="customerId"
          required
          defaultValue=""
          className="sm:col-span-2"
          hint="They need an account first, so the proof has somewhere to go. An administrator can invite them under Users."
        >
          <option value="" disabled>
            Choose a customer…
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} — {customer.email}
            </option>
          ))}
        </SelectField>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            What we are printing
          </span>
          <input
            name="description"
            required
            placeholder="Order of service booklets, A5, 8pp"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            How many
          </span>
          <input
            name="quantity"
            type="number"
            min="1"
            required
            defaultValue={100}
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Agreed price
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">£</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="Leave empty if not settled"
              className={fieldClass}
            />
          </div>
        </label>

        <SelectField
          id="production-designer"
          label="Designer"
          name="assignedDesignerId"
          defaultValue=""
        >
          <option value="">Assign later</option>
          {designers.map((designer) => (
            <option key={designer.id} value={designer.id}>
              {designer.name}
            </option>
          ))}
        </SelectField>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Paper stock
          </span>
          <input
            name="paperStock"
            placeholder="170gsm silk"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">Finish</span>
          <input
            name="finish"
            placeholder="Folded and saddle-stitched"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Production notes
          </span>
          <textarea
            name="productionNotes"
            rows={3}
            placeholder="Service on the 14th, needs to ship by the 11th. Photograph coming from the family by email."
            className={`${fieldClass} font-sans`}
          />
        </label>
      </div>

      <SubmitButton className="self-start" pendingLabel="Raising…">
        Raise the order
      </SubmitButton>
    </form>
  );
}
