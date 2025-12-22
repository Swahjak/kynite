CREATE TABLE "chores" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assigned_to_id" text,
	"due_date" date,
	"due_time" text,
	"recurrence" text DEFAULT 'once' NOT NULL,
	"is_urgent" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"star_reward" integer DEFAULT 10 NOT NULL,
	"completed_at" timestamp,
	"completed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_assigned_to_id_family_members_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_completed_by_id_family_members_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;