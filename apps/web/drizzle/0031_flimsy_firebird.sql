ALTER TABLE "timer" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "timer" ADD COLUMN "paused_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "timer" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "timer" ADD CONSTRAINT "timer_paused_seconds_non_negative" CHECK ("timer"."paused_seconds" >= 0);