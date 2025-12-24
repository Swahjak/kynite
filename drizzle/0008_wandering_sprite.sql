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
--> statement-breakpoint
CREATE TABLE "active_timers" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"template_id" text,
	"title" text NOT NULL,
	"description" text,
	"assigned_to_id" text,
	"category" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"star_reward" integer DEFAULT 0 NOT NULL,
	"alert_mode" text NOT NULL,
	"cooldown_seconds" integer,
	"status" text DEFAULT 'running' NOT NULL,
	"remaining_seconds" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	"paused_at" timestamp,
	"completed_at" timestamp,
	"started_by_id" text,
	"confirmed_by_id" text,
	"owner_device_id" text,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timer_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'chore' NOT NULL,
	"duration_seconds" integer NOT NULL,
	"star_reward" integer DEFAULT 0 NOT NULL,
	"control_mode" text DEFAULT 'anyone' NOT NULL,
	"alert_mode" text DEFAULT 'completion' NOT NULL,
	"cooldown_seconds" integer,
	"show_as_quick_action" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_template_id_timer_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."timer_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_assigned_to_id_family_members_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_started_by_id_family_members_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_confirmed_by_id_family_members_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_templates" ADD CONSTRAINT "timer_templates_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;