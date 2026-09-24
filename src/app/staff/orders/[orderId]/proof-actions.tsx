"use client";

import { useActionState } from "react";
import {
  assignDesignerAction,
  returnProofToDesignerAction,
  sendProofToCustomerAction,
  uploadProofAction,
} from "@/lib/proofs/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/uploads";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export function UploadProofForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(uploadProofAction, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          Proof pages
        </span>
        <input
          type="file"
          name="file"
          accept="image/*"
          multiple
          required
          className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm file:mr-3 file:rounded-[2px] file:border-0 file:bg-surface-grey file:px-3 file:py-1.5 file:text-[13px] file:font-semibold"
        />
        <span className="text-[12px] leading-relaxed text-ink-quiet">
          One image per page, chosen in reading order &mdash; JPEG, PNG or
          WebP, up to {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB each.
          Export each page of the booklet separately so the customer can mark
          up any of them. The whole set becomes one new version.
        </span>
      </label>

      <SubmitButton className="self-start" pendingLabel="Uploading…">
        Upload proof
      </SubmitButton>
    </form>
  );
}

export function ProofreaderActions({ orderId }: { orderId: string }) {
  const [sendState, sendAction] = useActionState(
    sendProofToCustomerAction,
    emptyFormState,
  );
  const [returnState, returnAction] = useActionState(
    returnProofToDesignerAction,
    emptyFormState,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={sendAction} className="flex flex-col gap-3">
        <FormMessage state={sendState} />
        <input type="hidden" name="orderId" value={orderId} />
        <SubmitButton className="self-start" pendingLabel="Sending…">
          Approve and send to the customer
        </SubmitButton>
      </form>

      <form
        action={returnAction}
        className="flex flex-col gap-3 border-t border-line-soft pt-6"
      >
        <FormMessage state={returnState} />
        <input type="hidden" name="orderId" value={orderId} />

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Or return it to the designer, with notes
          </span>
          <textarea
            name="notes"
            rows={3}
            required
            placeholder="The date on page 2 reads 14th, it should be 4th."
            className="w-full rounded-[3px] border border-field-line bg-card px-3 py-2.5 font-sans text-sm"
          />
        </label>

        <SubmitButton
          className="self-start"
          variant="secondary"
          pendingLabel="Returning…"
        >
          Return to designer
        </SubmitButton>
      </form>
    </div>
  );
}

export function AssignDesignerForm({
  orderId,
  designers,
  currentDesignerId,
}: {
  orderId: string;
  designers: { id: string; name: string }[];
  currentDesignerId: string | null;
}) {
  const [state, formAction] = useActionState(
    assignDesignerAction,
    emptyFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">Designer</span>
        <select
          name="designerId"
          defaultValue={currentDesignerId ?? ""}
          className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm"
        >
          <option value="">Unassigned</option>
          {designers.map((designer) => (
            <option key={designer.id} value={designer.id}>
              {designer.name}
            </option>
          ))}
        </select>
      </label>

      <SubmitButton
        className="self-start"
        variant="secondary"
        pendingLabel="Saving…"
      >
        Save assignment
      </SubmitButton>
    </form>
  );
}
