import Link from "next/link";
import type { ReactNode } from "react";

export function Section({
  children,
  className = "",
  tone = "ivory",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "ivory" | "white" | "night" | "warm";
  id?: string;
}) {
  const tones = {
    ivory: "bg-ivory",
    white: "bg-white",
    night: "bg-night text-ivory",
    warm: "bg-ivory-deep",
  };

  return (
    <section id={id} className={`${tones[tone]} ${className}`}>
      <div className="mx-auto max-w-[1200px] px-6 py-20 sm:px-10">
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  action,
  tone = "dark",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  action?: { href: string; label: string };
  tone?: "dark" | "light";
}) {
  const introColour = tone === "light" ? "text-ivory/65" : "text-ink-muted";
  const eyebrowColour = tone === "light" ? "text-gold" : "text-warm";

  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
      <div className="flex max-w-[60ch] flex-col gap-3">
        {eyebrow && (
          <span
            className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${eyebrowColour}`}
          >
            {eyebrow}
          </span>
        )}
        <h2 className="text-[32px] leading-tight sm:text-[38px]">{title}</h2>
        {intro && (
          <p className={`text-[15px] leading-relaxed ${introColour}`}>
            {intro}
          </p>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className={`text-[13px] font-semibold ${
            tone === "light" ? "text-gold" : "text-warm"
          }`}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Breadcrumb({
  trail,
}: {
  trail: { href?: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-2 text-[13px] text-ink-faint">
        {trail.map((crumb, index) => (
          <li key={crumb.label} className="flex items-center gap-2">
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-charcoal">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-ink-muted">{crumb.label}</span>
            )}
            {index < trail.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function CtaBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <Section tone="night">
      <div className="flex flex-col items-center gap-5 text-center">
        <h2 className="max-w-[24ch] text-[32px] leading-tight">{title}</h2>
        <p className="max-w-[56ch] text-[15px] leading-relaxed text-ivory/65">
          {body}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link
            href={primary.href}
            className="rounded-[2px] bg-ivory px-7 py-3.5 text-sm font-semibold text-charcoal hover:bg-white"
          >
            {primary.label}
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              className="rounded-[2px] border border-white/25 px-7 py-3.5 text-sm font-semibold text-ivory hover:border-white/50"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </Section>
  );
}
