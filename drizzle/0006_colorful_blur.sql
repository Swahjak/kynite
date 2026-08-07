CREATE TABLE "reminder_dispatch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"routine_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscription" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reminder_dispatch" ADD CONSTRAINT "reminder_dispatch_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_dispatch" ADD CONSTRAINT "reminder_dispatch_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_dispatch" ADD CONSTRAINT "reminder_dispatch_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_dispatch_key_unique" ON "reminder_dispatch" USING btree ("routine_id","occurrence_date","member_id");--> statement-breakpoint
CREATE INDEX "reminder_dispatch_created_at_idx" ON "reminder_dispatch" USING btree ("created_at");