CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"slug" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"payment_provider" text NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL, -- DRIFT: schema.ts uses 'solopreneur'; existing rows with 'starter' were migrated via SQL on 2026-03-29
	"status" text DEFAULT 'pending' NOT NULL,
	"coolify_app_uuid" text,
	"subdomain" text,
	"yoco_checkout_id" text,
	"subscription_id" text,
	"whatsapp_verify_token" text,
	"whatsapp_app_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "merchants_whatsapp_number_unique" UNIQUE("whatsapp_number")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"merchant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;