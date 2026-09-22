# Site photography

Drop the files listed below into this folder, named exactly as shown. Every
empty slot on the site prints its own filename, so you can open the page and
read which picture belongs where rather than working from this list alone.

## Format

**WebP, quality 80**, for everything except the map. It is roughly 30% smaller
than JPEG at the same visible quality and is supported by every current
browser. Export from Photoshop with *Save a Copy → WebP*, or from Affinity,
Figma and Squoosh directly.

The **"max file"** column is a budget, not a target — under it is better. The
site loads these as ordinary `<img>` tags, so what you supply is exactly what
every visitor downloads. There is no automatic resizing.

Pixel sizes are **double** the size the image is displayed at, so it stays
sharp on a retina screen. Supplying larger than this makes the page slower
without looking any better.

## Homepage

| File | Pixels | Aspect | Max file | Displayed at |
| --- | --- | --- | --- | --- |
| `hero-banner.webp` | 2560 × 1200 | see note | 350 KB | full width × 492 high |
| `studio-proofing.webp` | 1100 × 660 | 5:3 | 90 KB | 536 × 320 |
| `shipping-map.svg` | vector | — | 20 KB | 536 × 300 |
| `case-study-1.webp` | 720 × 540 | 4:3 | 50 KB | 352 × 264 |
| `case-study-2.webp` | 720 × 540 | 4:3 | 50 KB | 352 × 264 |
| `case-study-3.webp` | 720 × 540 | 4:3 | 50 KB | 352 × 264 |

**The hero is cropped differently on every screen.** It is full width with a
fixed height, so a wide monitor sees roughly 2.9:1 and a phone sees roughly
0.9:1 — almost square. Supply it at 2560 × 1200 with the subject centred and
room to spare on all four sides, and let the crop fall where it may.

## About

| File | Pixels | Aspect | Max file | Displayed at |
| --- | --- | --- | --- | --- |
| `about-founder-proof.webp` | 1100 × 700 | 11:7 | 90 KB | 536 × 340 |
| `about-founder-folding.webp` | 1100 × 700 | 11:7 | 90 KB | 536 × 340 |

## Guide

| File | Pixels | Aspect | Max file | Displayed at |
| --- | --- | --- | --- | --- |
| `process-1.webp` | 520 × 390 | 4:3 | 30 KB | 256 × 192 |
| `process-2.webp` | 520 × 390 | 4:3 | 30 KB | 256 × 192 |
| `process-3.webp` | 520 × 390 | 4:3 | 30 KB | 256 × 192 |
| `process-4.webp` | 520 × 390 | 4:3 | 30 KB | 256 × 192 |
| `finish-silk.webp` | 420 × 420 | 1:1 | 35 KB | 205 × 205 |
| `finish-cover.webp` | 420 × 420 | 1:1 | 35 KB | 205 × 205 |
| `finish-foil.webp` | 420 × 420 | 1:1 | 35 KB | 205 × 205 |
| `finish-letterpress.webp` | 420 × 420 | 1:1 | 35 KB | 205 × 205 |
| `finish-recycled.webp` | 420 × 420 | 1:1 | 35 KB | 205 × 205 |
| `article-1.webp` | 700 × 394 | 16:9 | 40 KB | 350 × 197 |
| `article-2.webp` | 700 × 394 | 16:9 | 40 KB | 350 × 197 |
| `article-3.webp` | 700 × 394 | 16:9 | 40 KB | 350 × 197 |

The four `process-*` images are **screen captures** of the ordering journey —
the product list, the quote email, the proof review screen and the order
status page — not photographs. Take them from the live site once it has real
content in it.

The five `finish-*` images show **material, not objects**: a close crop of the
paper or the finish itself, shot flat under even light, filling the square.

## What this adds up to

| Page | Images | Weight |
| --- | --- | --- |
| Homepage | 6 | ~610 KB, of which 350 KB loads before anything is scrolled |
| About | 2 | ~180 KB |
| Guide | 12 | ~415 KB |

For comparison, the median web page is about 2.2 MB. The rest of the site —
all its CSS, fonts and JavaScript — comes to well under 300 KB.

## Not in this folder

**Product and portfolio photographs are uploaded through the admin screens**,
not placed here. They live in object storage against their database row.
Supply those at 1600 × 2000 (4:5 portrait), under 5 MB.

**The homepage slider** currently shows eight stock photographs loaded from a
third party. They are placeholders from a component and should be replaced by
real portfolio work.

## Naming

Lowercase, hyphens, no spaces, no capitals. The filename in the table is the
whole name — nothing is appended or transformed.
