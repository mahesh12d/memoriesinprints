/**
 * An image slot that shows the real photograph when there is one.
 *
 * The studio's own photography isn't in yet, so anything without a picture
 * still renders as a labelled placeholder carrying the caption from the
 * approved design. Once a photograph is uploaded against a product or a
 * portfolio piece, passing its `src` here is all that's needed.
 */
export function ImagePlaceholder({
  caption,
  src,
  className = "",
  tone = "light",
}: {
  caption: string;
  /** A resolved image URL. Falls back to the placeholder when absent. */
  src?: string | null;
  className?: string;
  tone?: "light" | "dark";
}) {
  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={caption}
        className={`block object-cover ${className}`}
      />
    );
  }

  const toneClasses =
    tone === "dark"
      ? "bg-blue-deep text-white/50"
      : "bg-line-soft text-ink-pale";

  return (
    <div
      role="img"
      aria-label={caption}
      className={`flex items-center justify-center overflow-hidden p-6 ${toneClasses} ${className}`}
    >
      <span className="max-w-[34ch] text-center text-[11px] leading-relaxed">
        {caption}
      </span>
    </div>
  );
}
