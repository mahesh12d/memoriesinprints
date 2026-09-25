"use client";

import React from "react";
import Link from "next/link";

export interface SlideImage {
  src: string;
  alt: string;
  /** Shown over the piece on hover, so a tile is not anonymous artwork. */
  title?: string;
  /** A second line under it — the studio's catalogue number, usually. */
  meta?: string;
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
 * The studio's own work, moving past.
 *
 * Driven by CSS keyframes rather than a carousel library: it is a strip of
 * pictures, and a dependency that ships its own state machine to do this is a
 * dependency to keep current for no gain.
 *
 * Three things it will not do. It will not scroll for someone who has asked
 * their system for less motion — an infinite marquee with no way to stop it is
 * the thing that rule exists for. It will not move while the pointer or the
 * keyboard is inside it. And with only a handful of pieces it does not loop at
 * all, because duplicating three covers to fill a track reads as the same
 * three covers going round rather than as a portfolio.
 */
export function ImageAutoSlider({
  images,
  speed = 30,
  pauseOnHover = true,
  className = "",
}: ImageAutoSliderProps) {
  // Nothing to scroll: better to render nothing than an empty moving strip.
  if (images.length === 0) return null;

  /** Below this, a still row beats a loop that visibly repeats itself. */
  const marquee = images.length >= 4;
  const track = marquee ? [...images, ...images] : images;

  return (
    <>
      {/* Scoped CSS — avoids global style collisions */}
      <style>{`
        @keyframes mip-scroll-right {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .mip-scroll-container {
          overflow: hidden;
          mask: linear-gradient(
            90deg,
            transparent 0%,
            black 7%,
            black 93%,
            transparent 100%
          );
          -webkit-mask: linear-gradient(
            90deg,
            transparent 0%,
            black 7%,
            black 93%,
            transparent 100%
          );
        }

        .mip-scroll-track--moving {
          animation: mip-scroll-right ${speed}s linear infinite;
        }

        ${pauseOnHover
          ? `.mip-scroll-container:hover .mip-scroll-track--moving,
               .mip-scroll-container:focus-within .mip-scroll-track--moving {
                 animation-play-state: paused;
               }`
          : ""
        }

        .mip-slide-item {
          transition:
            transform 0.4s ease,
            box-shadow 0.4s ease;
        }

        .mip-slide-link:hover .mip-slide-item,
        .mip-slide-link:focus-visible .mip-slide-item {
          transform: translateY(-6px);
          box-shadow: 0 18px 40px -22px rgba(70, 88, 98, 0.65);
        }

        .mip-slide-art {
          transition: transform 0.7s ease;
        }

        .mip-slide-link:hover .mip-slide-art,
        .mip-slide-link:focus-visible .mip-slide-art {
          transform: scale(1.06);
        }

        .mip-slide-caption {
          opacity: 0;
          transform: translateY(6px);
          transition:
            opacity 0.35s ease,
            transform 0.35s ease;
        }

        .mip-slide-link:hover .mip-slide-caption,
        .mip-slide-link:focus-visible .mip-slide-caption {
          opacity: 1;
          transform: translateY(0);
        }

        /*
          Reduced motion: the strip stops and becomes something you push with
          a finger or an arrow key, which is the same content without anything
          moving on its own.
        */
        @media (prefers-reduced-motion: reduce) {
          .mip-scroll-track--moving {
            animation: none;
          }

          .mip-scroll-container {
            overflow-x: auto;
            scroll-snap-type: x mandatory;
          }

          .mip-slide-link {
            scroll-snap-align: start;
          }

          .mip-slide-item,
          .mip-slide-art,
          .mip-slide-caption {
            transition: none;
          }

          .mip-slide-link:hover .mip-slide-item,
          .mip-slide-link:hover .mip-slide-art {
            transform: none;
          }
        }
      `}</style>

      <div className={`mip-scroll-container w-full ${className}`}>
        <div
          className={`flex gap-5 ${marquee
            ? "mip-scroll-track mip-scroll-track--moving w-max"
            : "flex-wrap justify-center"
            }`}
        >
          {track.map((image, index) => {
            /*
              Portrait, matching the studio's own template.

              These were square, and object-cover crops to fill: a 1142x1600
              page squeezed into a square lost about a seventh off the top and
              bottom — which is where the heading, the name and the dates are.
              The tile is the shape of the paper.
            */
            const tile = (
              <div className="mip-slide-item relative aspect-[1142/1600] w-44 flex-shrink-0 overflow-hidden rounded-xl bg-surface-grey ring-1 ring-line-soft sm:w-48 md:w-56 lg:w-60">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="mip-slide-art h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />

                {/*
                  The piece's name, on the piece. A strip of unlabelled covers
                  is a mood board; with the title and the catalogue number on
                  it, it is something a funeral director can point at and ask
                  for by number.
                */}
                {image.title && (
                  <span className="mip-slide-caption pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-4 pb-3.5 pt-12">
                    <span className="text-[13px] font-semibold leading-snug text-white">
                      {image.title}
                    </span>
                    {image.meta && (
                      <span className="text-[11px] text-white/70">
                        {image.meta}
                      </span>
                    )}
                  </span>
                )}
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
                className="mip-slide-link flex-shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {tile}
              </Link>
            ) : (
              <div
                key={index}
                aria-hidden={isDuplicate || undefined}
                className="mip-slide-link flex-shrink-0"
              >
                {tile}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
