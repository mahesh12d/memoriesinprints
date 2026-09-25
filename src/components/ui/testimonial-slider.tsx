"use client";

import React from "react";

export type Testimonial = {
  text: string;
  attribution: string;
};

/**
 * What clients said, moving past.
 *
 * The same mechanism as the design strip — CSS keyframes, duplicated once for
 * a seamless loop — rather than a second carousel implementation. Three quotes
 * in a static row read as a page nobody updates; the same three moving read as
 * a stream of them.
 *
 * It stops for a pointer, for the keyboard, and for anyone who has asked their
 * system for less motion, for the same reasons the design strip does.
 */
export function TestimonialSlider({
  quotes,
  speed = 45,
}: {
  quotes: Testimonial[];
  /** Seconds for one full pass. Slower than the pictures: this is read. */
  speed?: number;
}) {
  if (quotes.length === 0) return null;

  // Below this a loop is visibly the same card coming round again.
  const marquee = quotes.length >= 3;
  const track = marquee ? [...quotes, ...quotes] : quotes;

  return (
    <>
      <style>{`
        @keyframes mip-quote-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .mip-quote-rail {
          overflow: hidden;
          mask: linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%);
          -webkit-mask: linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%);
        }

        .mip-quote-track--moving {
          animation: mip-quote-scroll ${speed}s linear infinite;
        }

        .mip-quote-rail:hover .mip-quote-track--moving,
        .mip-quote-rail:focus-within .mip-quote-track--moving {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .mip-quote-track--moving { animation: none; }
          .mip-quote-rail { overflow-x: auto; scroll-snap-type: x mandatory; }
          .mip-quote-card { scroll-snap-align: start; }
        }
      `}</style>

      <div className="mip-quote-rail w-full">
        <ul
          className={`flex gap-6 ${
            marquee
              ? "mip-quote-track mip-quote-track--moving w-max"
              : "flex-wrap justify-center"
          }`}
        >
          {track.map((quote, index) => (
            <li
              key={index}
              /*
                The second half of the loop is the same quotes again, so it is
                hidden from screen readers rather than read out twice.
              */
              aria-hidden={index >= quotes.length || undefined}
              className="mip-quote-card flex w-[320px] shrink-0 flex-col gap-5 rounded-md border border-line bg-card p-8 sm:w-[380px]"
            >
              <span
                aria-hidden="true"
                className="font-display text-[40px] leading-none text-brand/40"
              >
                &ldquo;
              </span>
              <blockquote className="font-display text-[19px] leading-[1.5]">
                {quote.text}
              </blockquote>
              <cite className="mt-auto text-[13px] not-italic text-ink-quiet">
                &mdash; {quote.attribution}
              </cite>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
