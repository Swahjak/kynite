CREATE TYPE "public"."device_kind" AS ENUM('hub', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."calendar_visibility" AS ENUM('family', 'private');--> statement-breakpoint
CREATE TYPE "public"."google_account_status" AS ENUM('active', 'reauth_required');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('appointment', 'custody', 'reward', 'routine', 'birthday', 'other');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('requested', 'approved', 'denied', 'fulfilled');--> statement-breakpoint
CREATE TYPE "public"."reward_category" AS ENUM('privilege', 'experience', 'treat');--> statement-breakpoint
CREATE TYPE "public"."completion_source" AS ENUM('hub', 'mobile', 'auto');--> statement-breakpoint
CREATE TYPE "public"."star_reason" AS ENUM('routine', 'bonus', 'manual', 'surprise');--> statement-breakpoint
CREATE TYPE "public"."share_role" AS ENUM('viewer', 'contributor');--> statement-breakpoint
CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "device_kind" NOT NULL,
	"paired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"google_account_id" uuid NOT NULL,
	"google_calendar_id" text NOT NULL,
	"summary" text NOT NULL,
	"color" text,
	"visibility" "calendar_visibility" DEFAULT 'family' NOT NULL,
	"writable" boolean DEFAULT false NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_token" text,
	"synced_at" timestamp with time zone,
	"channel_id" text,
	"channel_resource_id" text,
	"channel_expiration" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"google_user_id" text NOT NULL,
	"email" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"status" "google_account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"calendar_id" uuid,
	"google_event_id" text,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"tz" text DEFAULT 'Europe/Amsterdam' NOT NULL,
	"owner_member_id" uuid,
	"attendee_member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"event_type" "event_type" DEFAULT 'appointment' NOT NULL,
	"rrule" text,
	"rdates" text[] DEFAULT '{}' NOT NULL,
	"exdates" text[] DEFAULT '{}' NOT NULL,
	"recurrence_parent_id" uuid,
	"etag" text,
	"updated_at_remote" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"cost_stars" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_member_id" uuid,
	"created_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemption_cost_stars_non_negative" CHECK ("redemption"."cost_stars" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reward" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"image_url" text,
	"cost_stars" integer NOT NULL,
	"category" "reward_category" NOT NULL,
	"available_to_member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_cost_stars_non_negative" CHECK ("reward"."cost_stars" >= 0)
);
--> statement-breakpoint
CREATE TABLE "completion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"routine_id" uuid,
	"routine_step_id" uuid,
	"event_id" uuid,
	"occurrence_date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "completion_source" NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"schedule" jsonb NOT NULL,
	"stars_per_completion" integer DEFAULT 1 NOT NULL,
	"reward_enabled" boolean DEFAULT true NOT NULL,
	"faded_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_stars_per_completion_non_negative" CHECK ("routine"."stars_per_completion" >= 0)
);
--> statement-breakpoint
CREATE TABLE "routine_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"timer_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "star_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" "star_reason" NOT NULL,
	"completion_id" uuid,
	"routine_id" uuid,
	"redemption_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "star_ledger_amount_positive" CHECK ("star_ledger"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "share_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"role" "share_role" DEFAULT 'viewer' NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"label" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"device_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_session" ADD CONSTRAINT "device_session_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar" ADD CONSTRAINT "calendar_google_account_id_google_account_id_fk" FOREIGN KEY ("google_account_id") REFERENCES "public"."google_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_account" ADD CONSTRAINT "google_account_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_account" ADD CONSTRAINT "google_account_owner_member_id_member_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_calendar_id_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_owner_member_id_member_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_recurrence_parent_id_event_id_fk" FOREIGN KEY ("recurrence_parent_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_reward_id_reward_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."reward"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_decided_by_member_id_member_id_fk" FOREIGN KEY ("decided_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_created_event_id_event_id_fk" FOREIGN KEY ("created_event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward" ADD CONSTRAINT "reward_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completion" ADD CONSTRAINT "completion_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completion" ADD CONSTRAINT "completion_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completion" ADD CONSTRAINT "completion_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completion" ADD CONSTRAINT "completion_routine_step_id_routine_step_id_fk" FOREIGN KEY ("routine_step_id") REFERENCES "public"."routine_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completion" ADD CONSTRAINT "completion_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine" ADD CONSTRAINT "routine_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine" ADD CONSTRAINT "routine_owner_member_id_member_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_step" ADD CONSTRAINT "routine_step_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_ledger" ADD CONSTRAINT "star_ledger_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_ledger" ADD CONSTRAINT "star_ledger_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_ledger" ADD CONSTRAINT "star_ledger_completion_id_completion_id_fk" FOREIGN KEY ("completion_id") REFERENCES "public"."completion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_ledger" ADD CONSTRAINT "star_ledger_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_ledger" ADD CONSTRAINT "star_ledger_redemption_id_redemption_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."redemption"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_family_id_idx" ON "device" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_session_token_hash_unique" ON "device_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "device_session_device_id_idx" ON "device_session" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_google_account_calendar_unique" ON "calendar" USING btree ("google_account_id","google_calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_family_id_idx" ON "calendar" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "calendar_channel_expiration_idx" ON "calendar" USING btree ("channel_expiration");--> statement-breakpoint
CREATE UNIQUE INDEX "google_account_family_google_user_unique" ON "google_account" USING btree ("family_id","google_user_id");--> statement-breakpoint
CREATE INDEX "google_account_family_id_idx" ON "google_account" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "event_family_starts_at_idx" ON "event" USING btree ("family_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_calendar_google_event_unique" ON "event" USING btree ("calendar_id","google_event_id");--> statement-breakpoint
CREATE INDEX "event_recurrence_parent_id_idx" ON "event" USING btree ("recurrence_parent_id");--> statement-breakpoint
CREATE INDEX "event_owner_member_id_idx" ON "event" USING btree ("owner_member_id");--> statement-breakpoint
CREATE INDEX "redemption_family_status_idx" ON "redemption" USING btree ("family_id","status");--> statement-breakpoint
CREATE INDEX "redemption_family_member_idx" ON "redemption" USING btree ("family_id","member_id");--> statement-breakpoint
CREATE INDEX "reward_family_id_idx" ON "reward" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "completion_member_step_date_unique" ON "completion" USING btree ("member_id","routine_step_id","occurrence_date");--> statement-breakpoint
CREATE UNIQUE INDEX "completion_client_id_unique" ON "completion" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "completion_family_member_date_idx" ON "completion" USING btree ("family_id","member_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "routine_family_id_idx" ON "routine" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "routine_family_owner_idx" ON "routine" USING btree ("family_id","owner_member_id");--> statement-breakpoint
CREATE INDEX "routine_step_routine_sort_idx" ON "routine_step" USING btree ("routine_id","sort_order");--> statement-breakpoint
CREATE INDEX "star_ledger_family_member_created_idx" ON "star_ledger" USING btree ("family_id","member_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_token_hash_unique" ON "share_link" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "share_link_family_id_idx" ON "share_link" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscription_endpoint_unique" ON "push_subscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscription_family_member_idx" ON "push_subscription" USING btree ("family_id","member_id");--> statement-breakpoint
CREATE INDEX "event_log_family_id_id_idx" ON "event_log" USING btree ("family_id","id");--> statement-breakpoint
CREATE INDEX "event_log_created_at_idx" ON "event_log" USING btree ("created_at");--> statement-breakpoint
CREATE VIEW "public"."member_star_balance" AS (
  select
    m.family_id as family_id,
    m.id as member_id,
    coalesce(earned.total, 0)::bigint as earned_stars,
    coalesce(spent.total, 0)::bigint as spent_stars,
    (coalesce(earned.total, 0) - coalesce(spent.total, 0))::bigint as available_stars
  from "member" m
  left join (
    select member_id, sum(amount)::bigint as total
    from "star_ledger"
    group by member_id
  ) earned on earned.member_id = m.id
  left join (
    select member_id, sum(cost_stars)::bigint as total
    from "redemption"
    where status in ('approved', 'fulfilled')
    group by member_id
  ) spent on spent.member_id = m.id
);