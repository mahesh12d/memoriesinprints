import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * The next order reference, e.g. "MP-1047".
 *
 * Backed by a Postgres sequence rather than max(reference) + 1. The old form
 * read the highest number in one statement and inserted in the next, so two
 * people converting enquiries at the same moment both read the same maximum
 * and both produced the same reference. A sequence issues each number to
 * exactly one caller.
 *
 * Numbers are consumed even when the surrounding transaction rolls back — that
 * is what lets a sequence run without locking. A failed order can therefore
 * leave a gap, which is the right trade: a missing MP-1048 is a curiosity, two
 * orders both called MP-1047 is a support case.
 */
export async function nextOrderReference(): Promise<string> {
  const result = await db.execute<{ value: string }>(
    sql`select nextval('order_reference_seq') as value`,
  );

  return `MP-${result.rows[0].value}`;
}
