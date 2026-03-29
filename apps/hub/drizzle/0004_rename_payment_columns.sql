ALTER TABLE "merchants" RENAME COLUMN "yoco_checkout_id" TO "stripe_session_id";
ALTER TABLE "merchants" RENAME COLUMN "yoco_secret_key" TO "payment_secret_key";
