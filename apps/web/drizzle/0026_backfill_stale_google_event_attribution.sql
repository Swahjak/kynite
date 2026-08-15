-- Backfill for events left permanently unattributed by `0013`/`0019` (M18/M23):
-- a calendar whose `owner_member_id` resolves *after* some of its events were
-- already synced. Both earlier migrations were snapshots — they repaired every
-- row that was stuck at the moment they ran, but the condition that stuck them
-- is not one-off. It recurs whenever a calendar's `owner_member_id` reads null
-- at sync time and only later becomes non-null: a member deleted and
-- re-created while their calendar keeps syncing (the FK is `onDelete: 'set
-- null'`, `modules/google/schema.ts`), or an account linked in the gap before
-- this repair became a standing part of `discoverCalendars` (see that
-- function's own comment for the code-side half of this fix). `store.ts`'s
-- `coalesce(existing, resolved)` update rule is deliberately one-directional
-- (M18) — an already-null-forever event is never revisited by an ordinary
-- sync pass unless Google itself changes it — so this is the only way back for
-- a row that got stuck before the code fix landed.
--
-- Identical shape to `0019`'s second statement, and the same reasoning: the
-- predicate demands `owner_member_id IS NULL` *and* an empty
-- `attendee_member_ids`, which together mean "nobody has ever attributed this
-- row" — never a parent's own choice. Native events and soft-deleted rows are
-- untouched.
UPDATE "event" AS e
SET
  "owner_member_id" = c."owner_member_id",
  "attendee_member_ids" = ARRAY[c."owner_member_id"],
  "version" = e."version" + 1,
  "updated_at" = now()
FROM "calendar" AS c
WHERE e."calendar_id" = c."id"
  AND c."owner_member_id" IS NOT NULL
  AND e."deleted_at" IS NULL
  AND e."owner_member_id" IS NULL
  AND cardinality(e."attendee_member_ids") = 0;
