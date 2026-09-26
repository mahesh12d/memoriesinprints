/**
 * Editorial copy for the home page, lifted from the approved design.
 *
 * It lives here rather than inline in the page so the studio can reword things
 * without touching layout — and so it's one file to hand to a copywriter.
 */

export const CASE_STUDY_STEPS = [
  {
    label: "01 · The brief",
    body: "A family shares photographs, an order of service and a reading they'd like included.",
    caption:
      "[Photograph — consultation notes and reference photographs on a desk]",
    file: "case-study-1.webp",
  },
  {
    label: "02 · The proof",
    body: "A full design proof is sent within days, ready for comments or changes.",
    caption:
      "[Photograph — design proof on screen alongside a printed test sheet]",
    file: "case-study-2.webp",
  },
  {
    label: "03 · The finished piece",
    body: "Approved, printed on 170gsm silk paper and folded by hand in the studio.",
    caption: "[Photograph — finished order of service booklets, stacked]",
    file: "case-study-3.webp",
  },
];

export const STUDIO_VALUES = [
  {
    n: "01",
    title: "Precision",
    body: "Every proof is reviewed by hand before print. No detail overlooked, no shortcut taken.",
  },
  {
    n: "02",
    title: "Sensitivity",
    body: "We understand the emotional weight of every brief. Some orders carry more than ink.",
  },
  {
    n: "03",
    title: "Inclusive",
    body: "Transparent pricing with no surprises. What you see is what you pay.",
  },
  {
    n: "04",
    title: "Dependable",
    body: "Every order arrives on time, without fail, because your date doesn't move.",
  },
];

export const TRUSTED_BY = [
  "[Funeral Home Name]",
  "[Funeral Home Name]",
  "[Wedding Venue]",
  "[Funeral Home Name]",
  "[Wedding Venue]",
];

/**
 * What clients said, in the shape `TestimonialCarousel` takes.
 *
 * The name and the role used to be one `attribution` string, which was all the
 * old marquee card needed. Split in two, the person sits on their own line
 * above the home or venue they said it from, instead of being a comma in the
 * middle of a sentence.
 *
 * Square brackets are placeholders, as everywhere else in this file: real names
 * go in once the studio has asked.
 */
export const TESTIMONIALS = [
  {
    name: "[Funeral Director Name]",
    role: "Funeral Director, [Funeral Home Name]",
    review:
      "Memories in Prints turned around our order of service booklets in under 48 hours, exactly as promised, when we needed it most.",
  },
  {
    name: "[Couple's Name]",
    role: "Wedding client",
    review:
      "Every proof felt like it had been designed just for us. Our invitations were exactly what we'd hoped for.",
  },
  {
    name: "[Funeral Director Name]",
    role: "Funeral Director, [Funeral Home Name]",
    review:
      "Clear communication from start to finish, and the finished pieces were beautifully made.",
  },
];

export const FINISHES = [
  {
    label: "170gsm Silk",
    body: "Our standard stock — smooth, substantial, never flimsy.",
    caption: "[Swatch — silk paper]",
    file: "finish-silk.webp",
  },
  {
    label: "300gsm Cover",
    body: "A heavier board for covers and keepsake pieces.",
    caption: "[Swatch — cover stock]",
    file: "finish-cover.webp",
  },
  {
    label: "Foil Detailing",
    body: "A pressed metallic accent for titles or borders.",
    caption: "[Swatch — gold foil detail]",
    file: "finish-foil.webp",
  },
  {
    label: "Letterpress",
    body: "Deep, tactile impressions for a classic finish.",
    caption: "[Swatch — letterpress texture]",
    file: "finish-letterpress.webp",
  },
  {
    label: "Recycled Stock",
    body: "A matt, sustainably sourced paper option.",
    caption: "[Swatch — recycled paper]",
    file: "finish-recycled.webp",
  },
];

export const FAQS = [
  {
    q: "How quickly can you turn an order around?",
    a: "Standard turnaround is 3–5 working days from proof approval, with a rush service available for urgent dates — just tell us when you need it.",
  },
  {
    q: "Is there a minimum order quantity?",
    a: "No minimum — order exactly what you need, whether that's a handful of memorial cards or several hundred order of service booklets.",
  },
  {
    q: "How does proofing work?",
    a: "You'll receive a digital proof to review online. Request changes or approve it — nothing goes to print until you're happy.",
  },
  {
    q: "Do you deliver outside the UK?",
    a: "Yes — proofs are approved online and we ship internationally, so distance is never a reason to compromise on the details.",
  },
  {
    q: "Can you match a design we already have?",
    a: "Usually, yes. Send us what you have with your enquiry and we'll tell you honestly what we can match and what we'd suggest changing.",
  },
  {
    q: "What happens if I spot a mistake after approving a proof?",
    a: "Tell us straight away. If it hasn't gone to print we'll correct it at no cost; if it has, we'll talk you through the options rather than leave you stuck.",
  },
  {
    q: "Do you work directly with funeral directors?",
    a: "Yes. A good part of our work comes through funeral homes, and we're set up for the timescales that involves. We're a member of the Funeral Service Association.",
  },
  {
    q: "How do I pay?",
    a: "You'll receive a written quote first. Once it's approved we'll send a secure payment link — nothing is charged before you've agreed the price.",
  },
];

export const ORDER_PROCESS = [
  {
    label: "01 · Browse or enquire",
    body: "Start from a product you like, or tell us what you have in mind and we'll suggest the right pieces.",
    caption: "[Screenshot — product listing page]",
    file: "process-1.webp",
  },
  {
    label: "02 · Receive your quote",
    body: "We confirm the details and send a written quote within one working day. Nothing is charged yet.",
    caption: "[Screenshot — quote confirmation email]",
    file: "process-2.webp",
  },
  {
    label: "03 · Approve your proof",
    body: "A full design proof arrives in your account. Comment anywhere on it, or approve it as it stands.",
    caption: "[Screenshot — proof review screen]",
    file: "process-3.webp",
  },
  {
    label: "04 · Printed and delivered",
    body: "Once approved, we print, finish by hand and ship to your date. You can follow progress in your account.",
    caption: "[Screenshot — order status in the customer account]",
    file: "process-4.webp",
  },
];

export const ARTICLES = [
  {
    slug: "choosing-paper-for-an-order-of-service",
    tag: "Paper",
    title: "Choosing Paper for an Order of Service",
    excerpt:
      "Why weight matters more than brightness, and how the fold changes what a booklet feels like in the hand.",
    date: "August 2026",
    caption: "[Photograph — paper samples fanned across a workbench]",
    file: "article-1.webp",
  },
  {
    slug: "what-to-include-in-a-funeral-booklet",
    tag: "Planning",
    title: "What to Include in a Funeral Booklet",
    excerpt:
      "A gentle checklist for families: the readings, the photographs, and the details people most often forget.",
    date: "July 2026",
    caption: "[Photograph — an open order of service booklet]",
    file: "article-2.webp",
  },
  {
    slug: "how-long-wedding-stationery-really-takes",
    tag: "Planning",
    title: "How Long Wedding Stationery Really Takes",
    excerpt:
      "Working backwards from the date, so save the dates and invitations land when they should.",
    date: "June 2026",
    caption: "[Photograph — a wedding suite laid out with envelopes]",
    file: "article-3.webp",
  },
];
