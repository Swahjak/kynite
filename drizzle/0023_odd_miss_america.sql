CREATE TYPE "public"."formatting_locale" AS ENUM('nl-NL', 'en-GB', 'en-US');--> statement-breakpoint
ALTER TABLE "family" ADD COLUMN "formatting_locale" "formatting_locale" DEFAULT 'nl-NL' NOT NULL;