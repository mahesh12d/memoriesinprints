"use client";

import { useState } from "react";
import { cancelEnquiryAction } from "@/lib/enquiries/cancel";

export function CancelQuoteButton({ enquiryId }: { enquiryId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[13px] font-semibold text-ink-faint hover:text-rose-deep"
      >
        Cancel
      </button>
    );
  }

  return (
    <form action={cancelEnquiryAction} className="flex items-center gap-3">
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <span className="text-[12px] text-ink-muted">Cancel this request?</span>
      <button
        type="submit"
        className="text-[13px] font-semibold text-rose-deep hover:underline"
      >
        Yes, cancel
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[13px] font-semibold text-ink-faint hover:text-charcoal"
      >
        Keep
      </button>
    </form>
  );
}
