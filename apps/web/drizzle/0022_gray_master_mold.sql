-- M23: the household's built-in "Gezin" calendar.
--
-- One per family, created with the family, undeletable and never private. It
-- gives "this is for all of us" a home: before it, a family dinner was an
-- event with no owner and no attendees — household-wide *by accident*, because
-- nothing had claimed it — and there was nowhere to put one on purpose.
--
-- It is a row in `calendar` rather than a table of its own, because everything
-- about it is a calendar: it holds events, it has a name, a default type, a
-- place in the settings list. What it does not have is a Google account behind
-- it, which is why the two remote columns become nullable. Every entry point
-- into the sync and push engines narrows through `isGoogleBacked()` first
-- (`modules/google/sync.ts`), so a native row is skipped rather than sent to a
-- token lookup for an account that does not exist.
--
-- `bound_calendar_id` is the optional Google binding, and it is a *pointer*
-- rather than a merge. The bound calendar keeps its own row, its own sync
-- token, its own channel and its own events, so the engine is untouched: reads
-- arrive through the existing pass and writes leave through the existing push.
-- All the pointer changes is meaning — `listEvents` marks those events
-- household-wide, so every board draws them as the family's instead of as the
-- account owner's — and unbinding is one write that takes nothing with it.
--
-- The backfill gives every existing household one. `on conflict` cannot help
-- here (the invariant is "at most one row per family with is_household", which
-- is not a unique index on any column pair), so the insert selects the
-- families that have none — which also makes it a no-op if it ever runs twice.
ALTER TABLE "calendar" ALTER COLUMN "google_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar" ALTER COLUMN "google_calendar_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "is_household" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "bound_calendar_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_bound_calendar_id_calendar_id_fk" FOREIGN KEY ("bound_calendar_id") REFERENCES "public"."calendar"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "calendar" (
  "family_id", "summary", "is_household", "default_type",
  "writable", "sync_enabled", "visibility"
)
SELECT f."id", 'Gezin', true, 'family', true, true, 'family'
  FROM "family" AS f
 WHERE NOT EXISTS (
   SELECT 1 FROM "calendar" AS c WHERE c."family_id" = f."id" AND c."is_household"
 );
