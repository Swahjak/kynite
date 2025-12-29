CREATE TABLE "member_primary_goals" (
	"member_id" text PRIMARY KEY NOT NULL,
	"reward_id" text NOT NULL,
	"set_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_star_balances" (
	"member_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "star_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"member_id" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"reference_id" text,
	"description" text NOT NULL,
	"awarded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_primary_goals" ADD CONSTRAINT "member_primary_goals_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_star_balances" ADD CONSTRAINT "member_star_balances_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_transactions" ADD CONSTRAINT "star_transactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_transactions" ADD CONSTRAINT "star_transactions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_transactions" ADD CONSTRAINT "star_transactions_awarded_by_id_family_members_id_fk" FOREIGN KEY ("awarded_by_id") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;