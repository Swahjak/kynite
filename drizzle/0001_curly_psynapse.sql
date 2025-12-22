CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"color" text,
	"google_calendar_id" text,
	"google_event_id" text,
	"sync_status" text DEFAULT 'synced',
	"local_updated_at" timestamp,
	"remote_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendars" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"account_id" text NOT NULL,
	"google_calendar_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"access_role" text DEFAULT 'reader' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"sync_cursor" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_google_calendar_id_google_calendars_id_fk" FOREIGN KEY ("google_calendar_id") REFERENCES "public"."google_calendars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendars" ADD CONSTRAINT "google_calendars_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendars" ADD CONSTRAINT "google_calendars_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;