CREATE TYPE "public"."event_category" AS ENUM('blue', 'purple', 'orange', 'green', 'red', 'yellow', 'pink', 'teal');--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "category" "event_category";--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "pending_sync_at" timestamp with time zone;