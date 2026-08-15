ALTER TABLE "redemption" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_client_id_unique" ON "redemption" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_open_request_unique" ON "redemption" USING btree ("member_id","reward_id") WHERE "redemption"."status" = 'requested';