CREATE TABLE "google_calendar_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"google_calendar_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"token" text NOT NULL,
	"expiration" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_calendar_channels" ADD CONSTRAINT "google_calendar_channels_google_calendar_id_google_calendars_id_fk" FOREIGN KEY ("google_calendar_id") REFERENCES "public"."google_calendars"("id") ON DELETE cascade ON UPDATE no action;