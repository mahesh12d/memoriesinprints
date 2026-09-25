"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  children,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  children?: ReactNode;
} & Omit<ComponentProps<"input">, "name">) {
  /**
   * Password fields get an eye.
   *
   * Done here rather than per form so every one of them behaves the same —
   * signing in, signing up, resetting, and changing it in the account. It
   * starts hidden and the button says which way it is going, because the
   * state of a field of dots is not otherwise obvious.
   */
  const isPassword = props.type === "password";
  const [revealed, setRevealed] = useState(false);

  const describedBy = error
    ? `${name}-error`
    : hint
      ? `${name}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </label>

      {children ?? (
        <div className={isPassword ? "relative" : undefined}>
          <input
            id={name}
            name={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`w-full rounded-[3px] border bg-card px-[15px] py-[13px] text-sm text-blue placeholder:text-placeholder ${
              error ? "border-alert" : "border-field-line"
            } ${isPassword ? "pr-12" : ""}`}
            {...props}
            type={isPassword && revealed ? "text" : props.type}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((shown) => !shown)}
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[3px] text-ink-quiet hover:text-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="size-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {/* The stroke through it is the whole signal at this size. */}
                {revealed && <line x1="4" y1="20" x2="20" y2="4" />}
              </svg>
            </button>
          )}
        </div>
      )}

      {hint && !error && (
        <p id={`${name}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${name}-error`} className="text-xs font-medium text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { pending } = useFormStatus();

  const base =
    "rounded-[2px] px-6 py-[14px] text-sm font-semibold transition-colors disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-brand text-on-accent hover:bg-brand-deep hover:text-white"
      : "border border-field-line bg-transparent text-ink-muted hover:bg-surface-grey";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} ${styles} ${className}`}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}

/** Success and failure notices, announced to screen readers. */
export function FormMessage({
  state,
}: {
  state: { ok: boolean; message?: string };
}) {
  if (!state.message) return null;

  return (
    <p
      role="status"
      className={`rounded-[4px] px-[14px] py-3 text-[13px] leading-relaxed ${
        state.ok
          ? "bg-good-tint text-good-deep"
          : "bg-alert-tint text-alert"
      }`}
    >
      {state.message}
    </p>
  );
}

/**
 * A labelled <select>.
 *
 * A <label> wrapped round a <select> takes its accessible name from everything
 * inside it, options included — so the field announces as "Role Customer
 * Designer Proofreader Administrator". Associating by id instead keeps the
 * name to the label, which is what someone listening to the page needs.
 */
export function SelectField({
  id,
  label,
  name,
  defaultValue,
  hint,
  required,
  className = "",
  children,
}: {
  id: string;
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm"
      >
        {children}
      </select>
      {hint && <span className="text-[12px] text-ink-quiet">{hint}</span>}
    </div>
  );
}
