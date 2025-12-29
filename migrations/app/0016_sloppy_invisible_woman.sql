ALTER TABLE "sessions" ADD COLUMN "is_device" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "member_role" text;