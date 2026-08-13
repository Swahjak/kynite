-- M23: the event taxonomy, and the end of stored colour.
--
-- `event_type` goes from six developer-shaped values to the eleven a family
-- uses, and becomes the *only* thing that colours an event. Two columns die
-- with that decision, because both were competing answers to the question the
-- type now owns:
--
--   * `event.category` — the per-event colour override.
--   * `calendar_display` — the per-calendar colour a parent could pick, whose
--     only column besides the keys was that colour (visibility lives on
--     `calendar`, and stays).
--
-- The old→new mapping, in full:
--
--   | old           | new       | why |
--   | ------------- | --------- | --- |
--   | `appointment` | `other`   | the old default, and a statement about nothing — "Overig" is the honest landing place, and the new default. |
--   | `custody`     | `family`  | a custody week is the family's own arrangement; the recurrence presets that make it work are untouched (they live in `rrule`, not here). |
--   | `reward`      | `other`   | rewards have their own module and their own board; on the calendar it is just a thing on a day. |
--   | `routine`     | `other`   | same. |
--   | `birthday`    | `birthday`| the one value that survives verbatim — it now reads "Verjaardag & feest". |
--   | `other`       | `other`   | unchanged. |
--
-- Nothing is lost that a parent can see: every one of these rows rendered in
-- its calendar's colour with a generic glyph before the change, and renders in
-- "Overig" purple with the `event` glyph after it. The rows that actually want
-- a real type are the ones a parent or a calendar default will set from here
-- on (`0021` gives every calendar a default type to inherit).
--
-- The remap runs while the column is plain `text`, between the two enum types.
-- Casting straight across — which is what a generated migration does — throws
-- `invalid input value for enum event_type: "appointment"` on the first row of
-- the first household.
ALTER TABLE "calendar_display" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "calendar_display" CASCADE;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "event_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "event_type" SET DEFAULT 'other'::text;--> statement-breakpoint
UPDATE "event" SET "event_type" = CASE "event_type"
  WHEN 'custody' THEN 'family'
  WHEN 'birthday' THEN 'birthday'
  ELSE 'other'
END;--> statement-breakpoint
DROP TYPE "public"."event_type";--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('school', 'childcare', 'sport', 'music', 'play', 'health', 'family', 'birthday', 'holiday', 'work', 'other');--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "event_type" SET DEFAULT 'other'::"public"."event_type";--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "event_type" SET DATA TYPE "public"."event_type" USING "event_type"::"public"."event_type";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "category";
