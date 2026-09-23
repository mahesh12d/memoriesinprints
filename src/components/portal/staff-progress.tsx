import { ProgressSteps } from "./progress-steps";

/**
 * Where a job has got to inside the studio.
 *
 * One component rather than three. A designer, a proofreader and an admin are
 * all looking at the same job on the same page; what differs is which stage
 * they are waiting on, and the sentence underneath names that explicitly — so
 * whoever is reading it can see at a glance whether the ball is in their court.
 *
 * The proof cycle is not a straight line: a proofreader can send artwork back,
 * and a customer can ask for changes. Both return to "Artwork", and the note
 * says which of the two happened, because "back with the designer" means very
 * different work depending on who sent it back.
 */

type OrderStatus =
  | "awaiting_price"
  | "awaiting_payment"
  | "awaiting_proof"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

type ProofStatus =
  | "awaiting_proofreading"
  | "returned_to_designer"
  | "awaiting_customer"
  | "approved"
  | "changes_requested";

const STEPS = [
  "Assigned",
  "Artwork",
  "Checked",
  "Customer",
  "Approved",
  "Printed",
] as const;

const ASSIGNED = 0;
const ARTWORK = 1;
const CHECKED = 2;
const CUSTOMER = 3;
const APPROVED = 4;
const PRINTED = 5;

type Stage = { current: number; note: string };

/** Exported for the test: the branching below is what can go quietly wrong. */
export function stage(
  status: OrderStatus,
  proofStatus: ProofStatus | null,
  hasDesigner: boolean,
  hasProof: boolean,
): Stage {
  if (status === "cancelled") {
    return { current: -1, note: "This order was cancelled." };
  }

  // The later stages of the order outrank the proof cycle: once it is printed
  // or posted, how the artwork got approved is history.
  if (status === "delivered") {
    return { current: STEPS.length, note: "Delivered." };
  }
  if (status === "shipped") {
    return { current: PRINTED, note: "Posted to the customer." };
  }
  if (status === "in_production") {
    return { current: PRINTED, note: "Paid and approved — printing." };
  }

  /**
   * Approved but not yet paid. The studio has finished its part and is waiting
   * on the customer's payment, so this stops at Approved rather than moving on
   * to Printed — nothing is printed until it is paid for.
   */
  if (status === "awaiting_payment") {
    return {
      current: APPROVED,
      note: "Approved by the customer — waiting for payment before printing.",
    };
  }

  if (!hasDesigner) {
    return {
      current: ASSIGNED,
      note: "Not yet assigned to a designer.",
    };
  }

  if (!hasProof || proofStatus === null) {
    return {
      current: ARTWORK,
      note: "Waiting for the designer to upload the first proof.",
    };
  }

  switch (proofStatus) {
    case "awaiting_proofreading":
      return {
        current: CHECKED,
        note: "With the proofreader to check.",
      };
    case "returned_to_designer":
      return {
        current: ARTWORK,
        note: "Back with the designer — the proofreader asked for changes.",
      };
    case "awaiting_customer":
      return {
        current: CUSTOMER,
        note: "Sent to the customer — waiting on their decision.",
      };
    case "changes_requested":
      return {
        current: ARTWORK,
        note: "Back with the designer — the customer asked for changes.",
      };
    case "approved":
      return {
        current: APPROVED,
        note: "Approved by the customer — waiting for payment before printing.",
      };
  }
}

export function StaffProgress({
  status,
  proofStatus = null,
  hasDesigner,
  hasProof,
}: {
  status: OrderStatus;
  proofStatus?: ProofStatus | null;
  hasDesigner: boolean;
  hasProof: boolean;
}) {
  const { current, note } = stage(status, proofStatus, hasDesigner, hasProof);

  // A cancelled job has no position on this line; showing it part-way along
  // would suggest it is still moving.
  if (current === -1) {
    return (
      <p className="text-[13px] text-alert" role="status">
        {note}
      </p>
    );
  }

  return (
    <ProgressSteps
      steps={STEPS}
      current={current}
      note={note}
      label="Job progress"
    />
  );
}
