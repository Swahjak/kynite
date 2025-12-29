CREATE TABLE "reward_chart_completions" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_chart_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"chart_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"emoji" text NOT NULL,
	"star_target" integer NOT NULL,
	"stars_current" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"achieved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_chart_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chart_id" text NOT NULL,
	"content" text NOT NULL,
	"author_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_chart_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"chart_id" text NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"icon_color" text NOT NULL,
	"star_value" integer DEFAULT 1 NOT NULL,
	"days_of_week" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_charts" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"member_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reward_chart_completions" ADD CONSTRAINT "reward_chart_completions_task_id_reward_chart_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."reward_chart_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_chart_goals" ADD CONSTRAINT "reward_chart_goals_chart_id_reward_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."reward_charts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_chart_messages" ADD CONSTRAINT "reward_chart_messages_chart_id_reward_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."reward_charts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_chart_messages" ADD CONSTRAINT "reward_chart_messages_author_id_family_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_chart_tasks" ADD CONSTRAINT "reward_chart_tasks_chart_id_reward_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."reward_charts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_charts" ADD CONSTRAINT "reward_charts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_charts" ADD CONSTRAINT "reward_charts_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;