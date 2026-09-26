"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

export interface Testimonial {
  /** Who said it. A placeholder in square brackets until the studio has consent. */
  name: string;
  /** Their role, and the home or venue they said it from. */
  role: string;
  /** The quote itself. One or two sentences — this is set large. */
  review: string;
}

export interface TestimonialCarouselProps
  extends React.HTMLAttributes<HTMLDivElement> {
  testimonials: Testimonial[];
}

/**
 * What clients said, one at a time.
 *
 * A single quote set large in the middle of the page, advanced by dragging,
 * swiping, the arrow keys or the dots underneath — rather than a row of cards
 * competing for the same glance. Nothing moves on its own: a quote from a
 * family about a funeral is not something to scroll past on a timer, and a
 * carousel that waits to be asked needs no reduced-motion escape hatch.
 *
 * Text only. No avatars and no company logos, so there is no consent to chase
 * and nothing to source before this can ship with real names in it.
 */
export const TestimonialCarousel = React.forwardRef<
  HTMLDivElement,
  TestimonialCarouselProps
>(({ className, testimonials, ...props }, ref) => {
  const [api, setApi] = React.useState<CarouselApi>();

  /*
    Which quote is showing is Embla's answer, not ours, so the dots subscribe to
    it rather than keeping a copy in state. `reInit` matters as much as `select`:
    Embla rebuilds itself on resize, and a dot row that only listens for
    deliberate moves can end up pointing at a slide that is no longer on screen.
  */
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!api) return () => {};

      api.on("select", onStoreChange);
      api.on("reInit", onStoreChange);

      return () => {
        api.off("select", onStoreChange);
        api.off("reInit", onStoreChange);
      };
    },
    [api],
  );

  const current = React.useSyncExternalStore(
    subscribe,
    () => api?.selectedScrollSnap() ?? 0,
    () => 0,
  );

  if (testimonials.length === 0) return null;

  return (
    <div ref={ref} className={cn("py-16", className)} {...props}>
      {/* 80rem, which is what `max-w-screen-xl` meant before Tailwind v4
          deprecated it. */}
      <Carousel setApi={setApi} className="mx-auto max-w-7xl px-4 lg:px-8">
        <CarouselContent>
          {testimonials.map((testimonial, i) => (
            <CarouselItem
              key={`${testimonial.name}-${i}`}
              className="flex cursor-grab flex-col items-center"
            >
              <figure className="flex flex-col items-center">
                <blockquote className="max-w-xl text-balance text-center font-display text-xl text-foreground sm:text-2xl">
                  {testimonial.review}
                </blockquote>
                <figcaption className="mt-5 text-center">
                  <span className="block font-medium text-muted-foreground">
                    {testimonial.name}
                  </span>
                  {/* The faintest line on the card, but still a measured 4.57:1
                      — `text-foreground/40` from the original lands near 2:1. */}
                  <span className="mt-1.5 block font-medium text-ink-quiet">
                    {testimonial.role}
                  </span>
                </figcaption>
              </figure>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="mt-6 flex items-center justify-center gap-2">
        {testimonials.map((testimonial, index) => (
          <button
            key={`${testimonial.name}-${index}`}
            type="button"
            className={cn(
              "size-1.5 rounded-full transition-all",
              index === current ? "bg-primary" : "bg-primary/35",
            )}
            onClick={() => api?.scrollTo(index)}
            aria-current={index === current || undefined}
            aria-label={`Go to testimonial ${index + 1} of ${testimonials.length}`}
          />
        ))}
      </div>
    </div>
  );
});

TestimonialCarousel.displayName = "TestimonialCarousel";
