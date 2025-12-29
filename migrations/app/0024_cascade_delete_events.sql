ALTER TABLE "events" DROP CONSTRAINT "events_google_calendar_id_google_calendars_id_fk";
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_google_calendar_id_google_calendars_id_fk" FOREIGN KEY ("google_calendar_id") REFERENCES "public"."google_calendars"("id") ON DELETE cascade ON UPDATE no action;
