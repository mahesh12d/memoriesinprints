/**
 * Shared shape for every form handled by a server action.
 *
 * This lives outside actions.ts on purpose: a "use server" module may only
 * export async functions, so the constant below can't sit beside them.
 */
export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export const emptyFormState: FormState = { ok: false };

export function fail(
  message: string,
  errors?: Record<string, string>,
): FormState {
  return { ok: false, message, errors };
}
