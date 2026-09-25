"use client";

import { useState } from "react";

export type CompareVersion = {
  versionNumber: number;
  /** Every page of that version, in order. */
  sheets: { key: string; url: string; name: string }[];
};

/**
 * One sheet, drawn to fill its box.
 *
 * Proofs are images, so this is an <img> and nothing more. It used to render
 * PDFs to a canvas, which could only ever compare the first page of each
 * version — on a twelve-page booklet, the one page least likely to have
 * changed.
 */
function Sheet({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-grey px-6 text-center">
        <span className="text-[12px] leading-relaxed text-ink-quiet">
          {label} has no page here — this version has fewer pages.
        </span>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-full w-full object-contain" />
    </div>
  );
}

/**
 * Two versions of the same artwork, one on top of the other, with a divider
 * you drag across them.
 *
 * Side by side, a line of type that moved two millimetres looks identical in
 * both panels. Stacked, the same shift shows the moment the divider crosses
 * it — which is the question being asked here: did the correction land, and
 * did anything else move while it did. Side by side stays available for when
 * the two files aren't the same size and stacking them would mislead.
 *
 * The divider is a range input, so it works with arrow keys and takes a focus
 * ring without any of that being rebuilt by hand.
 */
export function ProofCompare({
  previous,
  current,
}: {
  previous: CompareVersion;
  current: CompareVersion;
}) {
  const [position, setPosition] = useState(50);
  const [stacked, setStacked] = useState(true);

  /**
   * Which page is being compared.
   *
   * Both versions used to be reduced to their first sheet, so on a twelve
   * page booklet this compared the one page least likely to have changed.
   * The pages line up by position: page three against page three.
   */
  const [sheetIndex, setSheetIndex] = useState(0);
  const pageCount = Math.max(previous.sheets.length, current.sheets.length);

  const previousUrl = previous.sheets[sheetIndex]?.url ?? null;
  const currentUrl = current.sheets[sheetIndex]?.url ?? null;

  const previousLabel = `Version ${previous.versionNumber}`;
  const currentLabel = `Version ${current.versionNumber}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="max-w-[58ch] text-[13px] leading-relaxed text-ink-muted">
          {stacked
            ? `Drag the divider across the page. ${previousLabel} is on the left of it, ${currentLabel} on the right — anything that moved between them will break along the line.`
            : `${previousLabel} and ${currentLabel}, shown together.`}
        </p>
        <button
          type="button"
          onClick={() => setStacked((value) => !value)}
          className="shrink-0 rounded-[2px] border border-field-line px-4 py-2 text-[13px] font-semibold text-ink-soft hover:border-brand hover:text-blue"
        >
          {stacked ? "Show side by side" : "Stack and wipe"}
        </button>
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-quiet">
            Page
          </span>
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSheetIndex(index)}
              aria-current={index === sheetIndex ? "true" : undefined}
              className={`size-8 rounded-[3px] text-[13px] font-semibold ${
                index === sheetIndex
                  ? "bg-band text-white"
                  : "border border-line text-ink-muted hover:bg-surface-grey"
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {stacked ? (
        <div className="relative aspect-[1/1.414] w-full overflow-hidden rounded-md border border-line">
          <div className="absolute inset-0">
            <Sheet url={previousUrl} label={previousLabel} />
          </div>

          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            <Sheet url={currentUrl} label={currentLabel} />
          </div>

          {/* The seam. Purely visual — the range input below carries the interaction. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-brand"
            style={{ left: `${position}%` }}
          />

          <label className="absolute inset-0 cursor-ew-resize">
            <span className="sr-only">
              Move the divider between {previousLabel} and {currentLabel}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              className="proof-wipe h-full w-full cursor-ew-resize appearance-none bg-transparent"
            />
          </label>

          <span className="pointer-events-none absolute left-3 top-3 rounded-[2px] bg-band px-2.5 py-1 text-[11px] font-semibold text-white">
            {previousLabel}
          </span>
          <span className="pointer-events-none absolute right-3 top-3 rounded-[2px] bg-brand px-2.5 py-1 text-[11px] font-semibold text-on-accent">
            {currentLabel}
          </span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { url: previousUrl, label: previousLabel, n: previous.versionNumber },
            { url: currentUrl, label: currentLabel, n: current.versionNumber },
          ].map(({ url, label, n }) => (
            <figure key={n} className="flex flex-col gap-2">
              <div className="aspect-[1/1.414] overflow-hidden rounded-md border border-line">
                <Sheet url={url} label={label} />
              </div>
              <figcaption className="text-[12px] text-ink-quiet">
                {label}
                {pageCount > 1 ? ` · page ${sheetIndex + 1}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
