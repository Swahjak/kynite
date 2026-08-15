ALTER TABLE "calendar" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- M18, hand-added below the generated DDL: seed the flag for calendars that
-- were discovered before it existed.
--
-- Google's primary calendar *is* the account: `calendarList` returns it with
-- `id` equal to the account's own address, which is the same identity the
-- discovery pass now writes `is_primary` from. Everything else on the account —
-- a subscribed holiday feed, a colleague's shared diary, a room — keeps the
-- column default, which is exactly the point: the account owner is a
-- participant of their own calendar and of nothing else.
UPDATE "calendar" AS c
SET "is_primary" = true
FROM "google_account" AS ga
WHERE ga."id" = c."google_account_id"
  AND lower(c."google_calendar_id") = lower(ga."email");
