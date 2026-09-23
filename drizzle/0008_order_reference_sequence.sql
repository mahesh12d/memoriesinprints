-- Order references used to be "max(reference) + 1", read in one statement and
-- written in the next. Two admins converting enquiries at the same moment both
-- read the same maximum and both produced MP-1047.
--
-- A sequence hands out each number exactly once, to one caller, without a lock
-- and without a read-modify-write.

CREATE SEQUENCE IF NOT EXISTS order_reference_seq AS bigint MINVALUE 1001;

-- Start above whatever is already in the table, so the first number the
-- sequence issues cannot collide with an existing reference. setval marks the
-- value as used, so the next nextval() returns max + 1.
--
-- '[^0-9]' rather than '\D': identical meaning, and no backslash to survive
-- three layers of escaping on the way to Postgres.
SELECT setval(
  'order_reference_seq',
  GREATEST(
    1000,
    (
      SELECT coalesce(
        max(nullif(regexp_replace(reference, '[^0-9]', '', 'g'), '')::bigint),
        1000
      )
      FROM orders
    )
  )
);
