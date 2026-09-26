# Testimonial Carousel — Integration Guide

Component: `TestimonialCarousel` (shadcn-style, built on the shadcn `Carousel` primitive).
This version **skips the company logo and the reviewer's avatar image** — text-only cards.

---

## 1. Prerequisites Check

Before copying any files, confirm the project has:

- **Next.js / React + TypeScript** project
- **Tailwind CSS** configured
- **shadcn/ui** initialized (`components.json` present)

If any of these are missing, set them up first:

```bash
# If shadcn/ui isn't initialized yet
npx shadcn@latest init

# If Tailwind isn't installed
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# If TypeScript isn't set up
npm install -D typescript @types/react @types/node
```

### Default component path

shadcn's default path for UI components is `@/components/ui`. Check `components.json` for the `aliases.ui` value.

If your project's default path is **not** `/components/ui`, still create that folder convention (or match whatever your `components.json` specifies) — it matters because:
- shadcn's CLI-generated primitives (`carousel`, `button`, `card`, etc.) all import each other via `@/components/ui/...` paths.
- Keeping every primitive in one predictable folder avoids broken imports and duplicate/conflicting versions of the same component later.

---

## 2. Install Dependencies

```bash
npm install lucide-react embla-carousel-react @radix-ui/react-slot class-variance-authority
```

---

## 3. Add Dependency Primitives

These are required by the carousel and aren't included by default — add them via the shadcn CLI (preferred) or paste manually.

```bash
npx shadcn@latest add carousel button card
```

If adding manually, create these three files under `/components/ui/`:
- `carousel.tsx`
- `button.tsx`
- `card.tsx`

(Standard shadcn implementations — no changes needed for this use case.)

---

## 4. Add the Testimonial Carousel Component

Create `/components/ui/testimonial-carousel.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

interface Testimonial {
  name: string;
  role: string;
  review: string;
}

interface TestimonialCarouselProps
  extends React.HTMLAttributes<HTMLDivElement> {
  testimonials: Testimonial[];
}

export const TestimonialCarousel = React.forwardRef<
  HTMLDivElement,
  TestimonialCarouselProps
>(({ className, testimonials, ...props }, ref) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <div ref={ref} className={cn("py-16", className)} {...props}>
      <Carousel setApi={setApi} className="max-w-screen-xl mx-auto px-4 lg:px-8">
        <CarouselContent>
          {testimonials.map((testimonial, i) => (
            <CarouselItem
              key={`${testimonial.name}-${i}`}
              className="flex flex-col items-center cursor-grab"
            >
              <p className="max-w-xl text-balance text-center text-xl sm:text-2xl text-foreground">
                {testimonial.review}
              </p>
              <h5 className="mt-5 font-medium text-muted-foreground">
                {testimonial.name}
              </h5>
              <h5 className="mt-1.5 font-medium text-foreground/40">
                {testimonial.role}
              </h5>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              className={cn(
                "size-1.5 rounded-full transition-all",
                index === current ? "bg-primary" : "bg-primary/35"
              )}
              onClick={() => api?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

TestimonialCarousel.displayName = "TestimonialCarousel";
```

**Changes from the original:**
- Removed `next/image` import (no longer used).
- Removed `company`, `avatar`, `companyLogoPath`, `avatarPath` fields/props.
- Removed the logo `<Image>` block and the avatar `<Image>` block from each slide.

---

## 5. Demo Usage

Create `/components/demo/testimonial-carousel-demo.tsx` (or drop inline wherever needed):

```tsx
"use client";

import { TestimonialCarousel } from "@/components/ui/testimonial-carousel";

const testimonials = [
  {
    name: "Nick Parsons",
    role: "Director of Marketing, Clerk",
    review: "our team saved countless hours after switching to webtics",
  },
  {
    name: "Thomas Paul Mann",
    role: "CEO, Raycast",
    review: "from data chaos to clarity - webtics delivers immediate results.",
  },
  {
    name: "Guillermo Rauch",
    role: "CEO, Vercel",
    review:
      "webtics delivers powerful insights that turn complex data into actionable decisions",
  },
];

export function TestimonialCarouselDemo() {
  return <TestimonialCarousel testimonials={testimonials} />;
}
```

---

## 6. Integration Notes

- **Props/state:** Only `testimonials: { name, role, review }[]` is required now — no image paths to configure.
- **No image assets needed:** since logos and avatars are skipped, there's nothing to source from Unsplash or elsewhere for this component.
- **Icons:** not required for this component (no arrows/logos rendered); `lucide-react` is still needed transitively because the `carousel.tsx`/`button.tsx` primitives use it for prev/next arrow icons if you choose to add `CarouselPrevious`/`CarouselNext` controls later.
- **Responsive behavior:** unchanged — one testimonial per slide, dot navigation below, horizontal drag/swipe via Embla.
- **Placement:** typically used as a marketing/landing-page section (e.g., between a features section and a pricing/CTA section).

---

## 7. Steps Checklist

- [ ] Confirm shadcn/Tailwind/TypeScript setup
- [ ] Install npm dependencies
- [ ] Add `carousel`, `button`, `card` primitives via shadcn CLI
- [ ] Add `testimonial-carousel.tsx` (logo/avatar-free version above) to `/components/ui`
- [ ] Add demo usage with your own testimonial copy
- [ ] Drop `<TestimonialCarouselDemo />` into the target page
