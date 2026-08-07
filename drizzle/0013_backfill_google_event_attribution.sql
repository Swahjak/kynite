-- M18: backfill attribution onto Google-sourced events that predate it.
--
-- Attendee attribution ships in this milestone (`modules/google/domain/mapping.ts`
-- `attributeEvent`), but incremental sync is *incremental*: a sync token means
-- Google only ever hands back events that have changed since the last pass. An
-- event imported last month and untouched since would therefore never be
-- revisited, and would stay in nobody's column forever — the board would look
-- fixed for new events and permanently broken for old ones.
--
-- The alternative was clearing every calendar's `sync_token` to force one full
-- resync. This is the cheaper correct option: it is one statement, it runs
-- once, it costs no Google API calls and no rate limit, and it produces exactly
-- the value `attributeEvent` would have produced for the overwhelmingly common
-- case — an event on a parent's own calendar with no attendee list, which
-- attributes to the calendar's owner.
--
-- **Primary calendars only.** The owner fallback is a statement about a
-- person's *own* calendar, and a Google account also carries subscriptions
-- ("Nederlandse feestdagen") and colleagues' shared diaries. Attributing those
-- to the account holder would put every national holiday in one parent's person
-- column, which is worse than leaving them unattributed. Google's primary
-- calendar is identified by its id being the account's own address — the same
-- identity `0014` writes into `calendar.is_primary`, which this migration
-- cannot yet read because it runs first.
--
-- It cannot overwrite a parent's own choice. The predicate demands `owner_member_id
-- IS NULL` *and* an empty `attendee_member_ids`, which together mean "nobody has
-- ever attributed this row" — the same invariant `store.ts`'s upsert enforces on
-- every sync pass (an update only ever fills a null owner and unions attendees).
-- Native events (`calendar_id IS NULL`) are untouched: they have never been
-- through the Google path and their attribution comes from the event form.
-- Soft-deleted rows are skipped too — they are off every board, and touching
-- them would burn a version bump on data nobody can see.
--
-- `version` and `updated_at` move with the write, because every reader in the
-- app treats them as the change signal (§4): a row rewritten underneath an open
-- hub without them would render stale attribution until something else touched
-- it.
--
-- Known and accepted imprecision: an old event whose Google organizer is a
-- *different* family member than the calendar's owner gets the calendar owner
-- here rather than the organizer. That is one query away from correct and
-- self-heals the next time the event changes, which is a better trade than a
-- full resync of every calendar in every household.

UPDATE "event" AS e
SET
  "owner_member_id" = ga."owner_member_id",
  "attendee_member_ids" = ARRAY[ga."owner_member_id"],
  "version" = e."version" + 1,
  "updated_at" = now()
FROM "calendar" AS c
  JOIN "google_account" AS ga ON ga."id" = c."google_account_id"
WHERE e."calendar_id" = c."id"
  AND lower(c."google_calendar_id") = lower(ga."email")
  AND e."deleted_at" IS NULL
  AND e."owner_member_id" IS NULL
  AND cardinality(e."attendee_member_ids") = 0;
