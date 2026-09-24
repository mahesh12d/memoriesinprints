"use client";

import { useRef, useState } from "react";
import { pinFromClick, type Pin } from "@/lib/proofs/pins";

export type ProofComment = {
  id: string;
  body: string;
  sheetIndex: number;
  xPct: number;
  yPct: number;
  pinNumber: number;
  authorName: string;
  isMine: boolean;
};

export type ProofSheet = {
  key: string;
  url: string;
  name: string;
};

/**
 * The proof, sheet by sheet, with comments pinned to it.
 *
 * Proofs are images — one per sheet, in reading order. A booklet runs to
 * sixteen pages and every one of them has to be checked, so the reviewer
 * moves between sheets here rather than being shown only the cover.
 *
 * There is no PDF rendering any more. It could only ever show the first page,
 * and it needed pdf.js plus a polyfill for browser features that only landed
 * in 2025 — on the devices a bereaved family is likely to be using, that was a
 * viewer that sometimes simply failed. An <img> cannot.
 *
 * Pins are stored as percentages of the sheet they sit on, so they hold
 * wherever the page is resized.
 */
export function ProofCanvas({
  sheets,
  comments,
  readOnly,
  pending,
  onPlace,
  activeCommentId,
  onSelectComment,
  activeSheet,
  onSelectSheet,
  seenSheets,
}: {
  sheets: ProofSheet[];
  comments: ProofComment[];
  readOnly: boolean;
  pending: Pin | null;
  onPlace: (pin: Pin | null) => void;
  activeCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  activeSheet: number;
  onSelectSheet: (index: number) => void;
  /** Which sheets have been opened, so nothing is approved unseen. */
  seenSheets: Set<number>;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  /**
   * Which sheet has finished loading, rather than a boolean.
   *
   * Two things go wrong with a flag. A cached image has already loaded by the
   * time React attaches onLoad, so the handler never fires and "Opening your
   * proof…" sits over the artwork for good. And switching sheets has to clear
   * it again, or the next one claims to be ready before it is. Keying on the
   * sheet answers both.
   */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const sheet = sheets[activeSheet] ?? sheets[0] ?? null;
  const loaded = sheet !== null && loadedKey === sheet.key;
  const onThisSheet = comments.filter(
    (comment) => comment.sheetIndex === activeSheet,
  );

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (readOnly) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pin = pinFromClick(
      { clientX: event.clientX, clientY: event.clientY },
      rect,
    );

    if (pin) {
      onSelectComment(null);
      onPlace(pin);
    }
  }

  if (!sheet) {
    return (
      <p className="rounded-md border border-line bg-card p-10 text-center text-sm text-ink-muted">
        There is nothing to look at on this proof yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        Sheet navigation, above the artwork rather than below it: on a booklet
        the first question is "how many pages am I checking", and it should be
        answered before scrolling starts.
      */}
      {sheets.length > 1 && (
        <nav
          aria-label="Proof sheets"
          className="flex flex-wrap items-center gap-2"
        >
          {sheets.map((one, index) => {
            const active = index === activeSheet;
            const pins = comments.filter(
              (comment) => comment.sheetIndex === index,
            ).length;

            return (
              <button
                key={one.key}
                type="button"
                onClick={() => onSelectSheet(index)}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-band text-white"
                    : "border border-line text-ink-muted hover:bg-surface-grey"
                }`}
              >
                <span>Page {index + 1}</span>

                {pins > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-bold ${
                      active ? "bg-white/20" : "bg-brand text-on-accent"
                    }`}
                  >
                    {pins}
                  </span>
                )}

                {/*
                  A quiet dot on anything not yet opened. It is the only way
                  someone can tell, at a glance, that there is a page they
                  have not actually looked at.
                */}
                {!seenSheets.has(index) && (
                  <span
                    aria-label="not yet viewed"
                    className={`size-1.5 rounded-full ${
                      active ? "bg-white/70" : "bg-pending-deep"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}

      <div
        ref={surfaceRef}
        onClick={handleClick}
        className={`relative overflow-hidden rounded-md border border-line bg-card ${
          readOnly ? "" : "cursor-crosshair"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={sheet.key}
          ref={(node) => {
            // Catches the image that was already in cache.
            if (node?.complete && loadedKey !== sheet.key) {
              setLoadedKey(sheet.key);
            }
          }}
          src={sheet.url}
          alt={
            sheets.length > 1
              ? `Your proof, page ${activeSheet + 1} of ${sheets.length}`
              : "Your proof"
          }
          className="block w-full"
          onLoad={() => setLoadedKey(sheet.key)}
        />

        {!loaded && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
            Opening your proof…
          </p>
        )}

        {onThisSheet.map((comment) => (
          <button
            key={comment.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectComment(
                activeCommentId === comment.id ? null : comment.id,
              );
            }}
            style={{ left: `${comment.xPct}%`, top: `${comment.yPct}%` }}
            aria-label={`Comment ${comment.pinNumber}: ${comment.body}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white text-[12px] font-bold shadow-sm transition-transform ${
              activeCommentId === comment.id
                ? "z-20 scale-110 bg-band text-white"
                : "z-10 bg-brand text-on-accent hover:scale-110"
            } flex size-7 items-center justify-center`}
          >
            {comment.pinNumber}
          </button>
        ))}

        {pending && (
          <span
            style={{ left: `${pending.xPct}%`, top: `${pending.yPct}%` }}
            className="absolute z-20 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-band text-[12px] font-bold text-white shadow-sm"
          >
            +
          </span>
        )}
      </div>

      {!readOnly && (
        <p className="text-[13px] text-ink-muted">
          Click anywhere on the proof to leave a comment at that spot.
          {sheets.length > 1 &&
            ` Page ${activeSheet + 1} of ${sheets.length}.`}
        </p>
      )}
    </div>
  );
}
