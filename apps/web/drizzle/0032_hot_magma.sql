-- M-K: the member colour system moves off the eight `--cat-*` category hues
-- onto its own six-slot palette (`docs/design/claude-design/Ledenkleuren.dc.html`,
-- `schema.ts`'s `memberColor` doc comment). `blue` keeps its name and its hue
-- (245); every other old value is remapped onto the new six slots, per the
-- user-chosen merges:
--
--   pink   -> raspberry   (335, same hue — pure rename)
--   blue   -> blue        (245, same hue — no-op, kept for completeness)
--   teal   -> petrol      (196)
--   green  -> petrol      (196 — merged: green and teal read too close to
--                          tell apart across a six-member roster, and petrol
--                          is the slot the sheet actually specimens)
--   purple -> orchid      (312)
--   yellow -> mustard     (90)
--   red    -> terracotta  (30)
--   orange -> terracotta  (30 — merged: orange free'd up as the reward-only
--                          anchor hue (~52) neighbour and terracotta is close
--                          enough in warmth that a household never had both
--                          assigned to two different people to begin with)
--
-- Column is still `text` at this point (the previous statement), so the
-- update runs before the `USING "color"::"public"."member_color"` cast further
-- down would otherwise fail on every value this enum no longer has.
ALTER TABLE "member" ALTER COLUMN "color" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "color" SET DEFAULT 'blue'::text;--> statement-breakpoint
UPDATE "member" SET "color" = CASE "color"
  WHEN 'pink' THEN 'raspberry'
  WHEN 'teal' THEN 'petrol'
  WHEN 'green' THEN 'petrol'
  WHEN 'purple' THEN 'orchid'
  WHEN 'yellow' THEN 'mustard'
  WHEN 'red' THEN 'terracotta'
  WHEN 'orange' THEN 'terracotta'
  ELSE "color"
END;--> statement-breakpoint
DROP TYPE "public"."member_color";--> statement-breakpoint
CREATE TYPE "public"."member_color" AS ENUM('raspberry', 'blue', 'petrol', 'orchid', 'mustard', 'terracotta');--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "color" SET DEFAULT 'blue'::"public"."member_color";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "color" SET DATA TYPE "public"."member_color" USING "color"::"public"."member_color";