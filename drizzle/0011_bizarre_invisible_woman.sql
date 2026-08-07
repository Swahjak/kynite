CREATE TYPE "public"."hub_view" AS ENUM('day', 'agenda');--> statement-breakpoint
CREATE TABLE "calendar_display" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"category" "event_category",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"routine_reminders" boolean DEFAULT true NOT NULL,
	"redemption_requests" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family" ADD COLUMN "hub_default_view" "hub_view" DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_display" ADD CONSTRAINT "calendar_display_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_display" ADD CONSTRAINT "calendar_display_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_display_calendar_unique" ON "calendar_display" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_display_family_id_idx" ON "calendar_display" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_member_unique" ON "notification_preference" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "notification_preference_family_id_idx" ON "notification_preference" USING btree ("family_id");