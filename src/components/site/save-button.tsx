import { toggleSavedItemAction } from "@/lib/saved/actions";
import { HeartIcon } from "@/components/portal/icons";

/**
 * A plain form post rather than a client component: saving works with
 * JavaScript switched off, and the button's state comes from the page it is
 * rendered on rather than being held twice.
 */
export function SaveButton({
  productId,
  productName,
  isSaved,
  returnTo,
  variant = "overlay",
}: {
  productId: string;
  productName: string;
  isSaved: boolean;
  /** Where to come back to after signing in. */
  returnTo: string;
  variant?: "overlay" | "inline";
}) {
  const label = isSaved
    ? `Remove ${productName} from your saved items`
    : `Save ${productName} for later`;

  if (variant === "inline") {
    return (
      <form action={toggleSavedItemAction}>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          aria-label={label}
          className={`inline-flex items-center gap-2 rounded-[2px] border px-5 py-3 text-[13px] font-semibold transition-colors ${
            isSaved
              ? "border-brand-deep bg-brand-tint text-brand-deep"
              : "border-field-line text-ink-muted hover:bg-surface-grey"
          }`}
        >
          <HeartIcon />
          {isSaved ? "Saved" : "Save this"}
        </button>
      </form>
    );
  }

  return (
    <form action={toggleSavedItemAction} className="absolute right-3 top-3 z-10">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={`flex size-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
          isSaved
            ? "border-brand-deep bg-brand text-on-accent"
            : "border-line bg-white text-ink-muted hover:text-blue"
        }`}
      >
        <HeartIcon />
      </button>
    </form>
  );
}
