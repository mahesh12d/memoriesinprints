"use client";

import React from "react";

export interface ImageAutoSliderProps {
  /** Array of image objects with src and alt text */
  images?: { src: string; alt: string }[];
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
  images = DEFAULT_IMAGES,
  speed = 25,
  pauseOnHover = true,
  className = "",
}: ImageAutoSliderProps) {
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
          {duplicated.map((image, index) => (
            <div
              key={index}
              className="mip-slide-item flex-shrink-0 w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-lg overflow-hidden border border-line-soft"
            >
              <img
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Default images — curated print/stationery themed stock photos      */
/* ------------------------------------------------------------------ */
const DEFAULT_IMAGES = [
  {
    src: "https://cdn.21st.dev/assets/mirror/0b/0b2eee3635f20ec932fa27ae8db24eb760045aee6dd53c6cd05b01799761b6fb.jpg",
    alt: "Elegant printed stationery design 1",
  },
  {
    src: "https://cdn.21st.dev/assets/mirror/a0/a0e1a6affa10f9d1304e1ec7a0a074efa2e5befddbe5f55ec1674ca4606a7272.jpg",
    alt: "Elegant printed stationery design 2",
  },
  {
    src: "https://cdn.21st.dev/assets/mirror/c5/c50a953b2534eeb024de5eb84901abda556e6a8faa74bb6c13983557f14f02e2.jpg",
    alt: "Elegant printed stationery design 3",
  },
  {
    src: "https://cdn.21st.dev/assets/mirror/2c/2c3bda48c0009be1f143cfed1b28a012de388bcd39d662df550ec1d28966b864.jpg",
    alt: "Elegant printed stationery design 4",
  },
  {
    src: "https://cdn.21st.dev/assets/mirror/df/df5b37ca7d83d93ddbece6430932d006f89d70704f4cf14c91bc724b9653ec9f.jpg",
    alt: "Elegant printed stationery design 5",
  },
  {
    src: "https://cdn.21st.dev/assets/mirror/fe/fe0e5e4058e6fc722507077aa70c1e0fd48ee254ab0bae5512902dc6729ff155.jpg",
    alt: "Elegant printed stationery design 6",
  },
  {
    src: "https://cdn.21st.dev/assets/mirror/6f/6ff6818c9f0e9b6b28eb7f16f650538626b00cf3b10c36eac6840d280c799636.jpg",
    alt: "Elegant printed stationery design 7",
  },
  {
    src: "https://cdn.21st.dev/assets/mirror/97/971ee8523c7efc71ed5323f0b7c386b7b09dde6af9bae9bedd7288ca7a787b40.jpg",
    alt: "Elegant printed stationery design 8",
  },
];
