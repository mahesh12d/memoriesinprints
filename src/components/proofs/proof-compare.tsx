"use client";

import { useEffect, useRef, useState } from "react";
import { renderPdfFirstPage } from "@/lib/proofs/render-pdf";

export type CompareVersion = {
  versionNumber: number;
  fileUrl: string;
  isPdf: boolean;
  fileName: string | null;
};

/** One proof, drawn to fill its box. PDFs render; images just load. */
function Sheet({
  version,
  label,
}: {
  version: CompareVersion;
  label: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!version.isPdf) return;
    let cancelled = false;

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        await renderPdfFirstPage(
          version.fileUrl,
          canvas,
          boxRef.current?.clientWidth ?? 700,
        );
      } catch (error) {
        console.error("[proof] could not render pdf for comparison", error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [version.fileUrl, version.isPdf]);

  return (
    <div ref={boxRef} className="h-full w-full bg-card">
      {failed ? (
        <p className="flex h-full items-center justify-center p-6 text-center text-[13px] text-ink-muted">
          This version won&rsquo;t display here. Open the file to check it.
        </p>
      ) : version.isPdf ? (
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          aria-label={label}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={version.fileUrl}
          alt={label}
          className="h-full w-full object-contain"
        />
      )}
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

      {stacked ? (
        <div className="relative aspect-[1/1.414] w-full overflow-hidden rounded-md border border-line">
          <div className="absolute inset-0">
            <Sheet version={previous} label={previousLabel} />
          </div>

          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            <Sheet version={current} label={currentLabel} />
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
            { version: previous, label: previousLabel },
            { version: current, label: currentLabel },
          ].map(({ version, label }) => (
            <figure key={version.versionNumber} className="flex flex-col gap-2">
              <div className="aspect-[1/1.414] overflow-hidden rounded-md border border-line">
                <Sheet version={version} label={label} />
              </div>
              <figcaption className="text-[12px] text-ink-quiet">
                {label}
                {version.fileName ? ` · ${version.fileName}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
