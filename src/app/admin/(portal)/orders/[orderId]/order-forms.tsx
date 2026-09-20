"use client";

import { useActionState } from "react";
import {
  recordPaymentAction,
  updateOrderAction,
} from "@/lib/admin/order-actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { ORDER_STATUS } from "@/lib/admin/labels";
import { FormMessage, SelectField, SubmitButton } from "@/components/ui/form";

const fieldClass =
  "w-full rounded-[3px] border border-field-line bg-white px-3 py-2.5 text-sm";

export type OrderFormValues = {
  status: string;
  assignedDesignerId: string | null;
  paperStock: string | null;
  finish: string | null;
  printMethod: string | null;
  productionNotes: string | null;
  internalNotes: string | null;
};

export function OrderDetailForm({
  orderId,
  values,
  designers,
}: {
  orderId: string;
  values: OrderFormValues;
  designers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(updateOrderAction, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="order-status"
          label="Status"
          name="status"
          defaultValue={values.status}
        >
          {Object.entries(ORDER_STATUS).map(([value, label]) => (
            <option key={value} value={value}>
              {label.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="order-designer"
          label="Designer"
          name="assignedDesignerId"
          defaultValue={values.assignedDesignerId ?? ""}
        >
          <option value="">Unassigned</option>
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
            defaultValue={values.paperStock ?? ""}
            placeholder="170gsm silk"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">Finish</span>
          <input
            name="finish"
            defaultValue={values.finish ?? ""}
            placeholder="Matt lamination"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Print method
          </span>
          <input
            name="printMethod"
            defaultValue={values.printMethod ?? ""}
            placeholder="Digital, saddle-stitched"
            className={fieldClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          Production notes
        </span>
        <textarea
          name="productionNotes"
          rows={3}
          defaultValue={values.productionNotes ?? ""}
          placeholder="Trim to 148×210. Photograph supplied by the family, do not crop."
          className={`${fieldClass} font-sans`}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          Internal notes
        </span>
        <textarea
          name="internalNotes"
          rows={2}
          defaultValue={values.internalNotes ?? ""}
          className={`${fieldClass} font-sans`}
        />
        <span className="text-[12px] text-ink-quiet">
          Only staff see these. The customer never does.
        </span>
      </label>

      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save the order
      </SubmitButton>
    </form>
  );
}

export function RecordPaymentForm({
  orderId,
  suggestedAmount,
}: {
  orderId: string;
  suggestedAmount: number | null;
}) {
  const [state, formAction] = useActionState(
    recordPaymentAction,
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          Amount received
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
              suggestedAmount === null ? "" : (suggestedAmount / 100).toFixed(2)
            }
            className="w-40 rounded-[3px] border border-field-line bg-white px-3 py-2.5 text-sm"
          />
        </div>
      </label>

      <SelectField
        id="payment-provider"
        label="Taken through"
        name="provider"
        defaultValue="razorpay"
      >
        <option value="razorpay">Razorpay</option>
        <option value="paypal">PayPal</option>
      </SelectField>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          Their reference
        </span>
        <input
          name="providerPaymentId"
          placeholder="pay_ABC123 or a bank reference"
          className={fieldClass}
        />
      </label>

      <SubmitButton className="self-start" variant="secondary" pendingLabel="Recording…">
        Record the payment
      </SubmitButton>
    </form>
  );
}
