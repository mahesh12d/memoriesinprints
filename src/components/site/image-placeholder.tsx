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
  fileName,
  className = "",
  tone = "light",
}: {
  caption: string;
  /** A resolved image URL. Falls back to the placeholder when absent. */
  src?: string | null;
  /**
   * The file this slot is waiting for, e.g. "hero-banner.webp".
   *
   * Shown on the empty slot so whoever is supplying the photography can open
   * the site and read which file belongs where, rather than working from a
   * list and counting sections. It disappears the moment a real image lands.
   */
  fileName?: string;
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
      ? "bg-band-deep text-white/50"
      : "bg-line-soft text-ink-pale";

  return (
    <div
      role="img"
      aria-label={caption}
      className={`flex items-center justify-center overflow-hidden p-6 ${toneClasses} ${className}`}
    >
      <span className="flex max-w-[34ch] flex-col items-center gap-2 text-center">
        {fileName && (
          <span
            className={`rounded-[3px] px-2 py-1 font-mono text-[11px] font-bold ${
              tone === "dark" ? "bg-white/15 text-white" : "bg-blue text-white"
            }`}
          >
            public/images/{fileName}
          </span>
        )}
        <span className="text-[11px] leading-relaxed">{caption}</span>
      </span>
    </div>
  );
}
