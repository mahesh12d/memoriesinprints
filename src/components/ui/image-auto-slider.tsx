"use client";

import React from "react";
import Link from "next/link";

export interface SlideImage {
  src: string;
  alt: string;
  /** Where the piece lives, when it is one of the studio's own. */
  href?: string;
}

export interface ImageAutoSliderProps {
  /** The pieces to show. Required: there is no stock fallback any more. */
  images: SlideImage[];
  /** Animation duration in seconds (lower = faster). Default 25 */
  speed?: number;
  /** Pause on hover. Default true */
  pauseOnHover?: boolean;
  /** Additional className for the outer wrapper */
  className?: string;
}

/**
 * Infinitely-scrolling image strip, driven entirely by CSS keyframes.
 * Images are duplicated once so the loop joins seamlessly.
 */
export function ImageAutoSlider({
  images,
  speed = 25,
  pauseOnHover = true,
  className = "",
}: ImageAutoSliderProps) {
  // Nothing to scroll: better to render nothing than an empty moving strip.
  if (images.length === 0) return null;

  // Duplicate for seamless loop
  const duplicated = [...images, ...images];

  return (
    <>
      {/* Scoped CSS — avoids global style collisions */}
      <style>{`
        @keyframes mip-scroll-right {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .mip-scroll-track {
          animation: mip-scroll-right ${speed}s linear infinite;
        }

        ${
          pauseOnHover
            ? `.mip-scroll-container:hover .mip-scroll-track { animation-play-state: paused; }`
            : ""
        }

        .mip-scroll-container {
          mask: linear-gradient(
            90deg,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
          -webkit-mask: linear-gradient(
            90deg,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
        }

        .mip-slide-item {
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }

        .mip-slide-item:hover {
          transform: scale(1.04);
          box-shadow: 0 8px 32px rgba(70, 88, 98, 0.18);
        }
      `}</style>

      <div
        className={`mip-scroll-container w-full overflow-hidden ${className}`}
      >
        <div className="mip-scroll-track flex w-max gap-5">
          {duplicated.map((image, index) => {
            /*
              Portrait, matching the studio's own template.

              These were square, and object-cover crops to fill: a 1142x1600
              page squeezed into a square lost about a seventh off the top and
              bottom — which is where the heading, the name and the dates are.
              The tile is the shape of the paper.
            */
            const tile = (
              <div className="mip-slide-item aspect-[1142/1600] w-44 flex-shrink-0 overflow-hidden rounded-lg border border-line-soft sm:w-48 md:w-56 lg:w-60">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            );

            /*
              The duplicate half of the loop is hidden from screen readers and
              taken out of the tab order: it is the same pieces again, and
              tabbing through everything twice is worse than not at all.
            */
            const isDuplicate = index >= images.length;

            return image.href ? (
              <Link
                key={index}
                href={image.href}
                aria-hidden={isDuplicate || undefined}
                tabIndex={isDuplicate ? -1 : undefined}
                className="flex-shrink-0"
              >
                {tile}
              </Link>
            ) : (
              <div key={index} aria-hidden={isDuplicate || undefined}>
                {tile}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
