"use client";

import { useState, useTransition } from "react";
import type { Pin } from "@/lib/proofs/pins";
import {
  addProofCommentAction,
  decideProofAction,
  deleteProofCommentAction,
} from "@/lib/proofs/actions";
import { emptyFormState, type FormState } from "@/lib/auth/form-state";
import { FormMessage } from "@/components/ui/form";
import { ProofCanvas, type ProofComment } from "./proof-canvas";

export function ProofReviewer({
  proofVersionId,
  fileUrl,
  downloadUrl,
  isPdf,
  comments,
  status,
  versionNumber,
}: {
  proofVersionId: string;
  fileUrl: string;
  downloadUrl: string;
  isPdf: boolean;
  comments: ProofComment[];
  status: string;
  versionNumber: number;
}) {
  const [pending, setPending] = useState<Pin | null>(null);
  const [draft, setDraft] = useState("");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(emptyFormState);
  const [busy, startTransition] = useTransition();

  const decided = status === "approved" || status === "changes_requested";
  const readOnly = decided;

  function submitComment() {
    if (!pending || !draft.trim()) return;

    const formData = new FormData();
    formData.set("proofVersionId", proofVersionId);
    formData.set("body", draft);
    formData.set("xPct", String(pending.xPct));
    formData.set("yPct", String(pending.yPct));

    startTransition(async () => {
      const result = await addProofCommentAction(emptyFormState, formData);
      setState(result);
      if (result.ok) {
        setPending(null);
        setDraft("");
      }
    });
  }

  function decide(decision: "approve" | "changes") {
    const formData = new FormData();
    formData.set("proofVersionId", proofVersionId);
    formData.set("decision", decision);

    startTransition(async () => {
      setState(await decideProofAction(emptyFormState, formData));
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
      <ProofCanvas
        fileUrl={fileUrl}
        isPdf={isPdf}
        comments={comments}
        readOnly={readOnly}
        pending={pending}
        onPlace={setPending}
        activeCommentId={activeCommentId}
        onSelectComment={setActiveCommentId}
      />

      <aside className="flex h-fit flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-md border border-line bg-card p-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
            Version {versionNumber}
          </span>
          <h2 className="font-display text-lg">
            {status === "approved"
              ? "You approved this proof"
              : status === "changes_requested"
                ? "Changes requested"
                : "Your proof is ready"}
          </h2>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            {decided
              ? status === "approved"
                ? "Nothing more to do — we've started printing."
                : "The studio has your comments and will send a new version."
              : "Check the wording, the dates and the spellings. Click anywhere on the proof to point at something."}
          </p>
          <a
            href={downloadUrl}
            className="mt-1 w-fit text-[13px] font-semibold text-accent-text"
          >
            Download the file
          </a>
        </div>

        <FormMessage state={state} />

        {/* Writing a comment */}
        {pending && !readOnly && (
          <div className="flex flex-col gap-3 rounded-md border border-blue/30 bg-blue-tint p-5">
            <h3 className="text-[13px] font-semibold text-ink-soft">
              What should change here?
            </h3>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              autoFocus
              placeholder="The middle initial should be J, not T."
              className="w-full rounded-[3px] border border-field-line bg-card px-3 py-2.5 font-sans text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitComment}
                disabled={busy || !draft.trim()}
                className="rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent disabled:opacity-60"
              >
                {busy ? "Adding…" : "Add comment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setDraft("");
                }}
                className="rounded-[2px] border border-field-line px-5 py-2.5 text-[13px] font-semibold text-ink-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* The comments so far */}
        <div className="overflow-hidden rounded-md border border-line bg-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h3 className="font-display text-[15px]">
              Comments ({comments.length})
            </h3>
          </div>

          {comments.length === 0 ? (
            <p className="px-5 py-6 text-[13px] leading-relaxed text-ink-muted">
              {readOnly
                ? "No comments were left on this version."
                : "Nothing marked yet. If everything reads correctly, approve it below."}
            </p>
          ) : (
            <ul>
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className={`flex gap-3 border-b border-line-soft px-5 py-4 last:border-b-0 ${
                    activeCommentId === comment.id ? "bg-blue-tint" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCommentId(
                        activeCommentId === comment.id ? null : comment.id,
                      )
                    }
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-on-accent"
                    aria-label={`Show comment ${comment.pinNumber} on the proof`}
                  >
                    {comment.pinNumber}
                  </button>

                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-[14px] leading-relaxed">{comment.body}</p>
                    <span className="text-[12px] text-ink-quiet">
                      {comment.authorName}
                    </span>

                    {comment.isMine && !readOnly && (
                      <form action={deleteProofCommentAction} className="mt-1">
                        <input
                          type="hidden"
                          name="commentId"
                          value={comment.id}
                        />
                        <button
                          type="submit"
                          className="text-[12px] font-semibold text-ink-quiet hover:text-alert"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* The decision */}
        {!decided && (
          <div className="flex flex-col gap-3 rounded-md border border-line bg-card p-6">
            <h3 className="font-display text-[15px]">Ready to decide?</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Nothing is printed until you approve. If something isn&rsquo;t
              right, mark it on the proof and send it back — there&rsquo;s no
              charge for changes.
            </p>
            <div className="mt-1 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => decide("approve")}
                disabled={busy}
                className="rounded-[2px] bg-brand px-6 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white disabled:opacity-60"
              >
                Approve this proof
              </button>
              <button
                type="button"
                onClick={() => decide("changes")}
                disabled={busy}
                className="rounded-[2px] border border-field-line px-6 py-3.5 text-sm font-semibold text-ink-soft hover:bg-surface-grey disabled:opacity-60"
              >
                Request changes
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
