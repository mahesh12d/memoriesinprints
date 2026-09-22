"use client";

import { useEffect, useRef, useState } from "react";
import { pinFromClick, type Pin } from "@/lib/proofs/pins";
import { renderPdfFirstPage } from "@/lib/proofs/render-pdf";

export type ProofComment = {
  id: string;
  body: string;
  xPct: number;
  yPct: number;
  pinNumber: number;
  authorName: string;
  isMine: boolean;
};

/**
 * The proof itself, with comments pinned to it.
 *
 * A PDF is rendered in the browser rather than converted on the server, so
 * there's one stored file and the artwork the customer marks up is the
 * artwork the studio sent. Pins sit in a layer over the top, positioned as
 * percentages, so they hold wherever the page is resized.
 */
export function ProofCanvas({
  fileUrl,
  isPdf,
  comments,
  readOnly,
  pending,
  onPlace,
  activeCommentId,
  onSelectComment,
}: {
  fileUrl: string;
  isPdf: boolean;
  comments: ProofComment[];
  readOnly: boolean;
  pending: Pin | null;
  onPlace: (pin: Pin | null) => void;
  activeCommentId: string | null;
  onSelectComment: (id: string | null) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!isPdf);

  /** Renders the first page of a PDF onto the canvas. */
  useEffect(() => {
    if (!isPdf) return;

    let cancelled = false;

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        await renderPdfFirstPage(
          fileUrl,
          canvas,
          surfaceRef.current?.clientWidth ?? 900,
        );

        if (!cancelled) setLoaded(true);
      } catch (error) {
        console.error("[proof] could not render pdf", error);
        if (!cancelled) {
          setPdfError(
            "We couldn't display this proof here. Download it to view it.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, isPdf]);

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

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={surfaceRef}
        onClick={handleClick}
        className={`relative overflow-hidden rounded-md border border-line bg-card ${
          readOnly ? "" : "cursor-crosshair"
        }`}
      >
        {isPdf ? (
          <>
            <canvas ref={canvasRef} className="block w-full" />
            {!loaded && !pdfError && (
              <p className="p-16 text-center text-sm text-ink-muted">
                Opening your proof…
              </p>
            )}
            {pdfError && (
              <p className="p-16 text-center text-sm text-alert">{pdfError}</p>
            )}
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={fileUrl}
            alt="Your proof"
            className="block w-full"
            onLoad={() => setLoaded(true)}
          />
        )}

        {/* Existing comments */}
        {comments.map((comment) => (
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

        {/* The pin being placed right now */}
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
        </p>
      )}
    </div>
  );
}
