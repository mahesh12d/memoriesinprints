import { ProgressSteps } from "./progress-steps";

/**
 * Where an order has got to, for the person who placed it.
 *
 * The steps are read from the order's own status rather than kept separately,
 * so this cannot drift out of step with what the studio sees.
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
  /*
    Never reaches a customer's screen — their queries only take versions that
    have been sent to them — but the column can hold it, so the type says so
    rather than making the page lie to the compiler about what it fetched.
  */
  | "draft"
  | "awaiting_proofreading"
  | "returned_to_designer"
  | "awaiting_customer"
  | "approved"
  | "changes_requested";

const STEPS = [
  "Details",
  "Design",
  "Proof",
  "Payment",
  "Printing",
  "Delivered",
] as const;

/**
 * Which step is in progress for a given status. "Placed" is index 0 and is
 * always behind us — the order exists, so it happened.
 *
 * The proof comes before payment: a new order starts at awaiting_proof owing
 * nothing, and only reaches awaiting_payment once the customer has approved
 * what they are being asked to pay for.
 */
const CURRENT_STEP: Record<Exclude<OrderStatus, "cancelled">, number> = {
  awaiting_price: 1,
  awaiting_proof: 1,
  awaiting_payment: 3,
  in_production: 4,
  shipped: 4,
  // Past the last index, so every step reads as done.
  delivered: STEPS.length,
};


/**
 * Whether this order is still waiting on its form before anything can start.
 *
 * Not simply "the form has not been sent". An order whose proof has reached
 * the customer, or that is already being printed, plainly got its details
 * some other way — usually over the phone with the studio. Treating those as
 * outstanding put a delivered order on step one and offered a "fill in your
 * order form" button next to a finished job.
 */
export function awaitingOrderForm(
  status: OrderStatus,
  proofStatus: ProofStatus | null | undefined,
  formSubmitted: boolean,
): boolean {
  if (formSubmitted || status === "cancelled") return false;
  if (proofStatus) return false;
  return CURRENT_STEP[status] <= 1;
}

/**
 * One plain sentence about what is happening now, and whether anything is
 * needed from the customer. For someone arranging a funeral this matters more
 * than the diagram above it, so it is not optional decoration.
 */
function currentNote(
  status: OrderStatus,
  proofStatus?: ProofStatus | null,
): string {
  switch (status) {
    case "awaiting_price":
      return "We are preparing your price and will be in touch.";
    case "awaiting_payment":
      return "Approved — payment is all that's left before we print.";
    case "awaiting_proof":
      if (proofStatus === "awaiting_customer") {
        return "Your proof is ready for you to look over.";
      }
      if (proofStatus === "changes_requested") {
        return "We are making the changes you asked for.";
      }
      return "Your designer is working on it.";
    case "in_production":
      return "Approved and being printed.";
    case "shipped":
      return "On its way to you.";
    case "delivered":
      return "Delivered.";
    case "cancelled":
      return "This order was cancelled.";
  }
}


export function OrderProgress({
  status,
  proofStatus,
  formSubmitted = true,
}: {
  status: OrderStatus;
  proofStatus?: ProofStatus | null;
  /**
   * Whether the order form has been sent. Derived from its submittedAt rather
   * than from a new order status: the form already records when it went, and
   * a second place to say the same thing is a second place to get it wrong.
   */
  formSubmitted?: boolean;
}) {
  const note = currentNote(status, proofStatus);

  /**
   * A cancelled order has no position on this line — showing it part-way along
   * would suggest it is still moving. It gets the sentence on its own.
   */
  if (status === "cancelled") {
    return (
      <p className="text-[13px] text-alert" role="status">
        {note}
      </p>
    );
  }

  /**
   * Nothing moves until the details are in. A designer cannot draw an order
   * of service without the name and the date, so an order still waiting on
   * its form sits on the first step.
   */
  if (awaitingOrderForm(status, proofStatus, formSubmitted)) {
    return (
      <ProgressSteps
        steps={STEPS}
        current={0}
        note="We need a few details before we can start — your order form is waiting."
        label="Order progress"
      />
    );
  }

  return (
    <ProgressSteps
      steps={STEPS}
      current={CURRENT_STEP[status]}
      note={note}
      label="Order progress"
    />
  );
}
