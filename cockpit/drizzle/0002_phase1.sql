ALTER TABLE "appointments" ADD COLUMN "manage_token_enc" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "hold_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "sequence" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "waitlist_id" text;--> statement-breakpoint
ALTER TABLE "practice_settings" ADD COLUMN "site_url" text;--> statement-breakpoint
ALTER TABLE "practice_settings" ADD COLUMN "waitlist_hold_hours" smallint DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_settings" ADD COLUMN "max_future_per_email" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "ref" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "phone_hash" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "manage_token_hash" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "manage_token_enc" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "note_enc" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "offered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "source" text DEFAULT 'web' NOT NULL;--> statement-breakpoint
CREATE INDEX "appointments_hold_idx" ON "appointments" USING btree ("hold_until");--> statement-breakpoint
CREATE INDEX "messages_appointment_kind_idx" ON "messages" USING btree ("appointment_id","kind");--> statement-breakpoint
CREATE INDEX "messages_created_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_ref_idx" ON "waitlist" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist" USING btree ("status","type_id");--> statement-breakpoint
CREATE INDEX "waitlist_manage_token_idx" ON "waitlist" USING btree ("manage_token_hash");