CREATE TABLE "child_upgrade_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"child_user_id" text NOT NULL,
	"token" text NOT NULL,
	"created_by_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "child_upgrade_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "child_upgrade_tokens" ADD CONSTRAINT "child_upgrade_tokens_child_user_id_users_id_fk" FOREIGN KEY ("child_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_upgrade_tokens" ADD CONSTRAINT "child_upgrade_tokens_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;