-- M23: a type an untyped event can inherit.
--
-- Two halves of one rule. `event.event_type` becomes nullable — null is now
-- "this event has no type of its own", which is the honest state of every
-- event Google has ever sent us, since the API has no such field. And
-- `calendar.default_type` is the answer null resolves to, one choice per
-- calendar instead of one per event.
--
-- Resolution, in `modules/calendar/queries.ts`: the event's own type, then its
-- calendar's default, then Overig. Total, so no view handles a typeless event.
--
-- **How existing events resolve.** `0020` mapped every old value onto the new
-- taxonomy, and everything that was not `custody` or `birthday` landed on
-- `other` — the six-value enum simply had nothing finer to say. Those rows are
-- nulled below, so they stop asserting "Overig" and start inheriting instead:
-- a household that sets "Schoolagenda Mila" to School sees two hundred events
-- become school events without touching one of them. Nothing is lost, because
-- `other` was never a decision anybody made; it was the default. The two rows
-- that *were* decisions — `family` (from custody) and `birthday` — keep their
-- type and ignore the calendar entirely.
--
-- Native events created from here on always carry an explicit type: the form's
-- picker has no inherit option, because a parent looking at one event should
-- be asked what it is.
--
-- Every calendar starts at `other`, including newly linked ones. Overig is the
-- honest answer until somebody gives a better one.
ALTER TABLE "event" ALTER COLUMN "event_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "event_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "default_type" "event_type" DEFAULT 'other' NOT NULL;--> statement-breakpoint
UPDATE "event" SET "event_type" = NULL WHERE "event_type" = 'other';
