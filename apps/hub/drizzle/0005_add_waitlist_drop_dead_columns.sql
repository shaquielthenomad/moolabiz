-- Add waitlist table
CREATE TABLE IF NOT EXISTS "waitlist" (
  "id" text PRIMARY KEY NOT NULL,
  "business_name" text NOT NULL,
  "whatsapp_number" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Drop columns removed from schema but still present in DB
ALTER TABLE "merchants" DROP COLUMN IF EXISTS "pin";
ALTER TABLE "merchants" DROP COLUMN IF EXISTS "coolify_app_uuid";
