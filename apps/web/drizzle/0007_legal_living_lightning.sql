CREATE TABLE "device_pairing_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_pairing_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"device_name" text NOT NULL,
	"kind" "device_kind" DEFAULT 'hub' NOT NULL,
	"created_by_member_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_pairing_code" ADD CONSTRAINT "device_pairing_code_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairing_code" ADD CONSTRAINT "device_pairing_code_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairing_code" ADD CONSTRAINT "device_pairing_code_consumed_by_device_id_device_id_fk" FOREIGN KEY ("consumed_by_device_id") REFERENCES "public"."device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_pairing_attempt_client_idx" ON "device_pairing_attempt" USING btree ("client_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_pairing_code_hash_unclaimed_unique" ON "device_pairing_code" USING btree ("code_hash") WHERE consumed_at is null;--> statement-breakpoint
CREATE INDEX "device_pairing_code_family_id_idx" ON "device_pairing_code" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "device_pairing_code_expires_at_idx" ON "device_pairing_code" USING btree ("expires_at");