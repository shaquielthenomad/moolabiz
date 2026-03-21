-- Add columns that exist in schema.ts but were not included in earlier migrations.
-- Using IF NOT EXISTS so this is safe to re-run against a DB that is already
-- partially up-to-date (e.g. a dev instance where columns were added manually).

ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "pin" text;
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "api_secret" text;
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "vendure_channel_id" text;
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "vendure_channel_token" text;
