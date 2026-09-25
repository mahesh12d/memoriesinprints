"use client";

import { useState } from "react";
import Link from "next/link";

export type TemplateChoice = {
  number: number;
  title: string;
  slug: string;
  src: string | null;
};

/**
 * Which design goes on this product.
 *
 * Every piece the studio prints carries the same cover artwork as the order
 * of service, so a product does not need its own set of designs — it needs a
 * way to say "number 137". The picture changes under the picker, which is the
 * point: choosing a template used to mean leaving the product, opening the
 * design, going back, and trying to remember what the last one looked like.
 *
 * Nothing is submitted from here. The number travels on the enquiry or gets
 * confirmed on the order form; this is for deciding, not for ordering.
 */
export function TemplateChoicePicker({
  templates,
}: {
  templates: TemplateChoice[];
}) {
  const [number, setNumber] = useState(templates[0]?.number ?? 0);

  if (templates.length === 0) return null;

  const chosen = templates.find((one) => one.number === number) ?? templates[0];

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg">Choose a design</h2>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Printed from the same templates as the order of service, so a whole
          set matches. Pick a number to see it.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">
          Template number
        </span>
        <select
          value={number}
          onChange={(event) => setNumber(Number(event.target.value))}
          className="w-full rounded-[3px] border border-field-line bg-card px-[15px] py-[13px] font-sans text-sm text-blue"
        >
          {templates.map((one) => (
            <option key={one.number} value={one.number}>
              {one.number} — {one.title}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-4">
        <div className="aspect-[1142/1600] w-32 shrink-0 overflow-hidden rounded-[3px] border border-line bg-surface-grey">
          {chosen.src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={chosen.src}
              alt={chosen.title}
              className="h-full w-full object-cover"
              /*
                Not lazy: it is swapped by the picker above it, and a preview
                that arrives a beat after the choice is a preview nobody
                trusts.
              */
              decoding="async"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-ink-quiet">
              No photograph yet
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold leading-snug">
            {chosen.title}
          </span>
          <span className="text-[12px] text-ink-quiet">
            Template no. {chosen.number}
          </span>
          <Link
            href={`/portfolio/${chosen.slug}`}
            className="mt-auto w-fit text-[13px] font-semibold text-accent-text hover:underline"
          >
            See it full size →
          </Link>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-quiet">
        Tell us the number when you order — we confirm it on the proof before
        anything is printed.
      </p>
    </div>
  );
}
