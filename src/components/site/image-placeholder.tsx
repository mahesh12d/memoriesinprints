/**
 * The studio's photography isn't in yet, so every image slot renders as a
 * labelled placeholder carrying the caption from the approved design. Swapping
 * one for a real photograph is a one-line change at the call site.
 */
export function ImagePlaceholder({
  caption,
  className = "",
  tone = "light",
}: {
  caption: string;
  className?: string;
  tone?: "light" | "dark";
}) {
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
