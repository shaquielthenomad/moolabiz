import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";

export const merchants = pgTable("merchants", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").unique(),
  businessName: text("business_name").notNull(),
  slug: text("slug").notNull().unique(),
  whatsappNumber: text("whatsapp_number").notNull().unique(),
  email: text("email"),
  paymentProvider: text("payment_provider").notNull(),
  plan: text("plan").notNull().default("solopreneur"),
  status: text("status").notNull().default("pending"),
  // pending -> provisioning -> active -> suspended -> cancelled
  openclawContainerId: text("openclaw_container_id"),
  subdomain: text("subdomain"),
  stripeSessionId: text("stripe_session_id"),
  paymentSecretKey: text("payment_secret_key"),
  subscriptionId: text("subscription_id").unique(),
  whatsappVerifyToken: text("whatsapp_verify_token"),
  whatsappAppSecret: text("whatsapp_app_secret"),
  apiSecret: text("api_secret"),
  vendureChannelId: text("vendure_channel_id"),
  vendureChannelToken: text("vendure_channel_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const waitlist = pgTable("waitlist", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  businessName: text("business_name").notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: text("event_type").notNull(),
  eventId: text("event_id").notNull().unique(),
  payload: text("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  merchantId: uuid("merchant_id").references(() => merchants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
