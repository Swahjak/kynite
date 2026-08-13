ALTER TABLE "calendar" ADD COLUMN "owner_member_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_owner_member_id_member_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- M23 data repair, part 1: give every already-linked calendar its member.
--
-- `owner_member_id` (above) is written by discovery from Google's own
-- `primary`/`accessRole: 'owner'` answer, and discovery only runs when an
-- account is linked or re-linked. Every calendar linked before this migration
-- would therefore keep attributing to nobody until its owner re-authorised,
-- which is not a thing anybody does.
--
-- `access_role` is not persisted, so the closest fact this migration can read
-- is `writable` (`accessRole` of `owner` *or* `writer`, recorded at discovery).
-- It is deliberately the looser predicate: the row it can get wrong is a
-- colleague's diary the account holder has *write* access to, which is rare,
-- attributes to a real member of this household rather than to a stranger, and
-- is corrected on the very next calendar-list pass — where `accessRole` is
-- available and the conflict update overwrites this value. A holiday feed or a
-- read-only shared diary is `reader`, so it stays null, which is the case that
-- actually matters.
UPDATE "calendar" AS c
SET "owner_member_id" = ga."owner_member_id"
FROM "google_account" AS ga
WHERE ga."id" = c."google_account_id"
  AND c."owner_member_id" IS NULL
  AND (c."is_primary" OR c."writable");
--> statement-breakpoint
-- M23 data repair, part 2: attribute the events that are already stored.
--
-- Same reasoning as `0013`, and the same shape: incremental sync is
-- incremental, so an event imported last month and untouched since would never
-- be revisited and would sit in the shared "Iedereen" block forever. `0013`
-- did this for primary calendars only — the very restriction M23 removes — so
-- this statement is its complement, over the calendars that just acquired an
-- owner and were skipped then.
--
-- It cannot overwrite anybody's choice: the predicate demands `owner_member_id
-- IS NULL` *and* an empty `attendee_member_ids`, which together mean "nobody
-- has ever attributed this row" (the invariant `store.ts`'s upsert enforces on
-- every pass). Native events (`calendar_id IS NULL`) and soft-deleted rows are
-- untouched. `version`/`updated_at` move with the write because every reader
-- treats them as the change signal (§4).
--
-- Known imprecision, inherited from `0013`: an event whose Google organizer is
-- a *different* family member than the calendar's owner gets the calendar's
-- owner here. It self-heals the next time the event changes.
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
