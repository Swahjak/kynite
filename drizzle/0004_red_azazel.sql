CREATE TABLE "timer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid,
	"routine_id" uuid,
	"routine_step_id" uuid,
	"label" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone,
	"warning_lead_seconds" integer,
	"started_by_member_id" uuid,
	"client_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timer_duration_seconds_positive" CHECK ("timer"."duration_seconds" > 0),
	CONSTRAINT "timer_warning_lead_seconds_non_negative" CHECK ("timer"."warning_lead_seconds" is null or "timer"."warning_lead_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "timer" ADD CONSTRAINT "timer_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer" ADD CONSTRAINT "timer_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer" ADD CONSTRAINT "timer_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer" ADD CONSTRAINT "timer_routine_step_id_routine_step_id_fk" FOREIGN KEY ("routine_step_id") REFERENCES "public"."routine_step"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer" ADD CONSTRAINT "timer_started_by_member_id_member_id_fk" FOREIGN KEY ("started_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timer_family_started_idx" ON "timer" USING btree ("family_id","started_at");--> statement-breakpoint
CREATE INDEX "timer_family_running_idx" ON "timer" USING btree ("family_id","stopped_at");--> statement-breakpoint
CREATE UNIQUE INDEX "timer_client_id_unique" ON "timer" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timer_running_step_unique" ON "timer" USING btree ("routine_step_id") WHERE "timer"."stopped_at" is null;