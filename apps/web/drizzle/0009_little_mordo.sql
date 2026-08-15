CREATE TABLE "member_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"invited_by_member_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_invited_by_member_id_member_id_fk" FOREIGN KEY ("invited_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_claimed_by_user_id_user_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_invite_token_hash_unique" ON "member_invite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "member_invite_family_id_idx" ON "member_invite" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_invite_live_member_unique" ON "member_invite" USING btree ("member_id") WHERE "member_invite"."claimed_at" is null and "member_invite"."revoked_at" is null;