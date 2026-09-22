import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Whether a route segment can be an id at all.
 *
 * Route params arrive as arbitrary strings. Handing one straight to a uuid
 * column makes Postgres raise, which Next turns into a 500 — so /orders/new
 * returned a server error instead of "no such order". Checked before the
 * query, every one of these is an honest 404.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
