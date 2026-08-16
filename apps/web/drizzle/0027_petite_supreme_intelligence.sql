CREATE TABLE "weather_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family" ADD COLUMN "weather_latitude" double precision;--> statement-breakpoint
ALTER TABLE "family" ADD COLUMN "weather_longitude" double precision;--> statement-breakpoint
ALTER TABLE "family" ADD COLUMN "weather_location_label" text;--> statement-breakpoint
ALTER TABLE "weather_snapshot" ADD CONSTRAINT "weather_snapshot_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weather_snapshot_family_unique" ON "weather_snapshot" USING btree ("family_id");