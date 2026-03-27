ALTER TABLE "merchants" ADD COLUMN "clerk_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "merchants_clerk_id_unique" ON "merchants" ("clerk_id");
