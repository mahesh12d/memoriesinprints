"use client";

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
        <input
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-[3px] border bg-white px-[15px] py-[13px] text-sm text-blue placeholder:text-placeholder ${
            error ? "border-alert" : "border-field-line"
          }`}
          {...props}
        />
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
