-- Add recurring event patterns table
CREATE TABLE IF NOT EXISTS "recurring_event_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"frequency" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"end_type" text NOT NULL,
	"end_count" integer,
	"end_date" timestamp,
	"generated_until" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add recurring event columns to events table
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "recurring_pattern_id" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "occurrence_date" timestamp;

-- Add foreign key constraint for recurring_pattern_id
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE constraint_name = 'events_recurring_pattern_id_recurring_event_patterns_id_fk'
	) THEN
		ALTER TABLE "events"
		ADD CONSTRAINT "events_recurring_pattern_id_recurring_event_patterns_id_fk"
		FOREIGN KEY ("recurring_pattern_id")
		REFERENCES "recurring_event_patterns"("id")
		ON DELETE CASCADE
		ON UPDATE NO ACTION;
	END IF;
END $$;

-- Add foreign key constraint for family_id in recurring_event_patterns
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE constraint_name = 'recurring_event_patterns_family_id_families_id_fk'
	) THEN
		ALTER TABLE "recurring_event_patterns"
		ADD CONSTRAINT "recurring_event_patterns_family_id_families_id_fk"
		FOREIGN KEY ("family_id")
		REFERENCES "families"("id")
		ON DELETE CASCADE
		ON UPDATE NO ACTION;
	END IF;
END $$;
