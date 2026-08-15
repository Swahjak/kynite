CREATE TABLE "ics_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"url" text NOT NULL,
	"etag" text,
	"last_modified" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "source_uid" text;--> statement-breakpoint
ALTER TABLE "ics_subscription" ADD CONSTRAINT "ics_subscription_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ics_subscription" ADD CONSTRAINT "ics_subscription_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ics_subscription_calendar_unique" ON "ics_subscription" USING btree ("calendar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ics_subscription_family_url_unique" ON "ics_subscription" USING btree ("family_id","url");--> statement-breakpoint
CREATE INDEX "ics_subscription_family_id_idx" ON "ics_subscription" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_calendar_source_uid_unique" ON "event" USING btree ("calendar_id","source_uid");