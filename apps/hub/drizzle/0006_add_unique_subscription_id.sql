CREATE UNIQUE INDEX IF NOT EXISTS "merchants_subscription_id_unique" ON "merchants" ("subscription_id") WHERE "subscription_id" IS NOT NULL;
