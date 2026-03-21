# MoolaBiz -- Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-21
**Author:** Generated from codebase analysis
**Branch:** `Vendure-implementation`

---

## 1. Product Vision

MoolaBiz is a SaaS platform that turns a merchant's WhatsApp number into a fully functional online store. It targets South African informal traders -- spaza shops, home bakers, braiders, clothing resellers, food sellers -- who already do business over WhatsApp but manage orders manually (screenshots, voice notes, lost messages).

**The problem:** South Africa has millions of informal sellers who take orders via WhatsApp, manually track stock in their heads, lose orders in chat threads, and have no way to accept digital payments. They earn R3K-R15K/month and cannot afford enterprise e-commerce solutions, nor do they have the technical skills to set one up.

**The solution:** MoolaBiz gives each merchant a WhatsApp bot (powered by OpenClaw + Groq AI) and a web storefront (powered by Vendure), provisioned automatically in under 10 minutes. The merchant's existing WhatsApp number becomes a 24/7 store where customers can browse products, add to cart, and pay. The merchant manages everything through WhatsApp commands or a web dashboard -- no coding, no app downloads, no tech skills required.

**Core value proposition:** "Your WhatsApp store. Always open."

---

## 2. Target User

### Primary Persona: South African Informal Trader

| Attribute | Detail |
|-----------|--------|
| **Who** | Home baker, braider, sneaker reseller, clothing boutique owner, spaza shop, food seller |
| **Age** | 22-45 |
| **Location** | South African townships and informal settlements (Johannesburg, Pretoria, Cape Town, Durban) |
| **Income** | R3,000-R15,000/month profit |
| **Tech literacy** | Can use WhatsApp fluently; limited or no experience with websites, dashboards, or e-commerce tools |
| **Current workflow** | Takes orders via WhatsApp text/voice notes; tracks stock mentally; payments via cash, EFT, or informal transfers |
| **Pain points** | Lost orders, no payment tracking, can't sell while sleeping, no professional presence, can't scale beyond personal capacity |
| **Device** | Android smartphone (primarily), some feature phones for WhatsApp |
| **Language** | English, Zulu, Xhosa, Afrikaans, Sesotho |
| **Trust model** | Word-of-mouth, community recommendations; skeptical of unfamiliar online services; needs to try before committing money |

### Why WhatsApp?
WhatsApp has 95%+ penetration in South Africa. These sellers and their customers already live on WhatsApp. Meeting them where they are eliminates the adoption barrier entirely.

---

## 3. Architecture Overview

```
                         +-----------------------+
                         |    Cloudflare DNS      |
                         | *.bot.moolabiz.shop    |
                         | *.store.moolabiz.shop  |
                         |   moolabiz.shop        |
                         +----------+------------+
                                    |
                     +--------------+--------------+
                     |   Azure B4ms VM (SA North)   |
                     |   4 vCPU, 16GB RAM           |
                     |   Coolify orchestration      |
                     +------------------------------+
                     |                              |
          +----------+----------+     +-------------+------------+
          |   Hub (Next.js 15)  |     |  Vendure Server          |
          |   moolabiz.shop     |     |  store.moolabiz.shop     |
          |   Port 3000         |     |  Port 3100               |
          |                     |     |                          |
          | - Landing page      |     | - Admin API (GraphQL)    |
          | - Signup/checkout   |     | - Shop API (GraphQL)     |
          | - Stripe billing    |     | - Multi-tenant channels  |
          | - Merchant dashboard|     | - Product catalog        |
          | - Vendure bridge API|     | - Order management       |
          | - Provisioning      |     | - Stripe payments (shop) |
          |                     |     | - Asset server           |
          | DB: PostgreSQL      |     | - Dashboard plugin       |
          | (Drizzle ORM)       |     |                          |
          +----------+----------+     | DB: PostgreSQL           |
                     |                +-------------+------------+
                     |                              |
          +----------+----------+     +-------------+------------+
          | OpenClaw Provisioner|     |  Vendure Storefront      |
          | Port 9999 (internal)|     |  {slug}.store.moolabiz   |
          | Docker socket access|     |  Next.js (shared)        |
          |                     |     |                          |
          | Deploys per-merchant|     | - Multi-tenant via       |
          | OpenClaw containers |     |   subdomain middleware   |
          +----------+----------+     | - Resolves channel token |
                     |                |   per merchant slug      |
          +----------+----------+     | - Full e-commerce UX     |
          | Per-Merchant        |     +---------------------------+
          | OpenClaw Container  |
          | (1 per merchant)    |
          |                     |
          | - WhatsApp bot      |
          |   (Baileys/QR)      |
          | - Groq LLM          |
          |   (llama-3.3-70b)   |
          | - SOUL.md persona   |
          | - Catalog skill     |
          |   (curl -> bridge)  |
          | - Profile isolation |
          +---------------------+
```

### Service Inventory

| Service | Technology | Deployed As | Purpose |
|---------|-----------|-------------|---------|
| **Hub** | Next.js 15, Drizzle, PostgreSQL | Coolify container | Landing page, signup, billing, dashboard, bridge API |
| **Vendure Server** | Vendure 3.x, PostgreSQL, Stripe Plugin | Coolify container | Headless e-commerce engine (products, orders, payments) |
| **Vendure Storefront** | Next.js (Vendure template) | Coolify container | Shared multi-tenant web storefront |
| **OpenClaw Provisioner** | Node.js 22, Docker socket | Docker container | Deploys/manages per-merchant OpenClaw bots |
| **OpenClaw (per merchant)** | OpenClaw CLI, Groq AI | Docker container (dynamic) | WhatsApp bot, AI chat, catalog commands |
| **PostgreSQL (Hub)** | PostgreSQL | Coolify managed | Merchant records, webhook events |
| **PostgreSQL (Vendure)** | PostgreSQL | Coolify managed | Products, orders, channels, assets |

### Key Integration Flows

1. **Hub -> Stripe:** Subscription checkout and webhook lifecycle
2. **Hub -> Vendure Admin API:** Channel/seller creation during provisioning
3. **Hub -> OpenClaw Provisioner:** Container deployment via HTTP
4. **OpenClaw -> Hub Vendure Bridge:** Catalog CRUD via curl commands from the bot
5. **Storefront -> Vendure Shop API:** Product browsing, cart, checkout (channel-scoped)
6. **Storefront Middleware -> Vendure/Hub:** Channel token resolution per subdomain

---

## 4. Features (What Exists Today)

### Shipped

| Feature | Description | Status |
|---------|-------------|--------|
| **Landing page** | Professional marketing site with hero, how-it-works, testimonials, FAQs, pricing cards | Shipped |
| **Multi-currency pricing** | Plans displayed in ZAR, USD, THB with currency switcher | Shipped |
| **Signup form** | Business name, email, WhatsApp number (intl format), payment provider, 4-digit PIN | Shipped |
| **Plan selection** | 4 tiers (Intro/Growth/Pro/Business) with feature comparison | Shipped |
| **Stripe checkout** | Subscription billing via Stripe, multi-currency price IDs | Shipped |
| **Merchant provisioning** | Automatic: create Vendure channel + seller, deploy OpenClaw container | Shipped |
| **Vendure multi-tenant channels** | Each merchant gets isolated channel with unique token | Shipped |
| **WhatsApp bot (OpenClaw)** | Per-merchant bot with AI persona (SOUL.md), Groq-powered | Shipped |
| **WhatsApp QR onboarding** | ASCII QR code at /onboard endpoint for WhatsApp linking | Shipped |
| **Web storefront** | Shared Next.js storefront, multi-tenant via subdomain middleware | Shipped |
| **Vendure bridge API** | REST endpoints for products/orders CRUD, authenticated via API secret | Shipped |
| **Dashboard (overview)** | Store status, plan info, WhatsApp connection status, pause/cancel/reactivate | Shipped |
| **Dashboard (products)** | Product list, add/edit/delete via Vendure Admin API | Shipped |
| **Dashboard (orders)** | Order list from Vendure | Shipped |
| **Bot catalog commands** | /add-product, /remove-product, /list-products, /orders, /set-payment-key | Shipped |
| **SOUL.md generation** | Per-merchant AI persona with strict guardrails (no off-topic, no prompt leaking) | Shipped |
| **Bot container lifecycle** | Deploy, start, stop, remove, status via provisioner API | Shipped |
| **Welcome email** | Sent via Resend after payment confirmation | Shipped |
| **Session auth (PIN)** | HMAC-based session tokens, bcrypt PIN hashing | Shipped |
| **Privacy policy** | POPIA-compliant privacy page | Shipped |
| **Health endpoint** | /api/health for container health checks | Shipped |
| **Migration script** | migrate-to-vendure.mjs for existing merchants | Shipped |
| **Webhook event logging** | Stripe webhook events stored in webhook_events table | Shipped |

### In Progress / Partially Implemented

| Feature | Description | Status |
|---------|-------------|--------|
| **Storefront checkout** | Vendure Stripe plugin configured but end-to-end customer payment flow needs testing | In Progress |
| **Multi-language bot** | SOUL.md mentions 5 languages; Groq model supports it but not formally tested | In Progress |
| **Plan change** | "Change plan -- coming soon" button exists in dashboard, not wired | Planned |
| **Settings page** | Nav tab exists, page likely minimal | In Progress |

### Planned (Not Yet Built)

| Feature | Description | Status |
|---------|-------------|--------|
| **Free tier** | Market research says essential for trust-building; not implemented | Planned |
| **Appointment booking** | Listed in Growth plan features; no implementation found | Planned |
| **AI business advisor** | Listed in Pro plan features; no implementation | Planned |
| **Daily revenue reports** | Listed in Growth plan; no implementation | Planned |
| **Advanced analytics** | Listed in Pro plan; no implementation | Planned |
| **Multiple WhatsApp numbers** | Listed in Business plan; architecture is 1:1 currently | Planned |
| **Custom integrations** | Listed in Business plan; no implementation | Planned |
| **SLA guarantee** | Listed in Business plan; no formal SLA defined | Planned |
| **Referral program** | GTM strategy includes "bring a friend = free month" | Planned |
| **Ozow payments** | Listed as payment provider option in signup but marked "coming soon" | Planned |
| **PayFast payments** | Listed as payment provider option in signup but marked "coming soon" | Planned |

---

## 5. Pricing

### Current Plan Structure

| Plan | ZAR | USD | THB | Key Features |
|------|-----|-----|-----|-------------|
| **Intro** | R49.99/mo | $2.99/mo | B99/mo | WhatsApp bot, web storefront, order taking, 1 payment provider, English + 1 language, email support |
| **Growth** (Popular) | R149/mo | $8.99/mo | B299/mo | All languages, all payment providers, appointment booking, daily revenue reports, WhatsApp support |
| **Pro** | R299/mo | $16.99/mo | B579/mo | AI business advisor, priority support, custom bot personality, advanced analytics |
| **Business** | R499/mo | $27.99/mo | B949/mo | Dedicated support, multiple WhatsApp numbers, custom integrations, SLA guarantee |

### Stripe Integration Details

- **Billing model:** Monthly recurring subscriptions
- **Payment methods:** Card only (via Stripe Checkout)
- **Currency handling:** Each plan has dedicated Stripe Price IDs per currency (ZAR, USD, THB)
- **Metadata:** merchantId and slug stored on both checkout session and subscription
- **Webhook lifecycle:** checkout.session.completed triggers provisioning
- **Cancellation:** Available from dashboard, calls Stripe to cancel subscription

### Pricing History Note

Market research (2026-03-18) recommended a restructure to R79/R199/R399 with a free tier. The current code reflects a different structure (R49.99/R149/R299/R499) that was implemented before the latest pricing research. The free tier has not been implemented.

---

## 6. User Journey

### Step 1: Discovery
Merchant discovers MoolaBiz through word-of-mouth, WhatsApp share, or community referral. They visit **moolabiz.shop**.

### Step 2: Landing Page
They see the hero ("Your WhatsApp store. Always open."), the 3-step how-it-works section, testimonials from similar businesses (home baker in Pretoria, sneaker reseller in Joburg, boutique in Cape Town), and pricing.

### Step 3: Signup Form
They click "Start selling" and fill in:
- Business name (e.g., "Mama Grace Bakes")
- Email address
- WhatsApp number (pre-filled with +27 for SA)
- Preferred payment provider (Yoco / Ozow / PayFast)
- 4-digit PIN (for dashboard login)

### Step 4: Plan Selection
They choose a plan. A currency switcher lets them view prices in ZAR, USD, or THB.

### Step 5: Stripe Checkout
Redirected to Stripe for card payment. The merchant record is created with status "pending" in the hub database.

### Step 6: Payment Success -> Provisioning
On payment success, the merchant is redirected to `/setup-complete?slug={slug}`. The provisioning flow:
1. Verify Stripe payment status
2. Create Vendure channel (isolated product catalog for this merchant)
3. Create Vendure seller (assign to channel)
4. Generate API secret
5. Deploy OpenClaw container (WhatsApp bot with SOUL.md, Groq AI, catalog skill)
6. Set merchant status to "active"
7. Send welcome email via Resend

### Step 7: WhatsApp Connection
From the dashboard, the merchant clicks "Connect WhatsApp" which opens `{slug}.bot.moolabiz.shop/onboard`. An ASCII QR code is displayed. They scan it with their WhatsApp, linking their number to the bot.

### Step 8: Add Products
The merchant adds products either:
- **Via WhatsApp:** `/add-product Chocolate Cake R85` -- the bot calls the Vendure bridge API
- **Via Dashboard:** Navigate to Products tab, click "Add Product", fill in name/price/description

### Step 9: Share & Sell
The merchant shares their store URL or WhatsApp number. Customers can:
- **WhatsApp:** Message the bot, browse products, get prices, place orders
- **Web:** Visit `{slug}.store.moolabiz.shop` for a full e-commerce experience

### Step 10: Manage
The merchant uses the dashboard at `moolabiz.shop/dashboard` to view orders, manage products, pause/reactivate/cancel their store, and monitor status.

---

## 7. Changelog / Decision Log

### Commit 0ae3a6f -- Day 1: Initial Monorepo
**Decision:** Build as a monorepo with `apps/hub` (signup) and `apps/bot` (WhatsApp bot).
- Hub: Next.js 15 for the marketing site + signup
- Bot: Next.js 15 per-merchant, deployed via Coolify
- Security hardening from the start

### Commit e9f2a01 -- Payment Gating with Yoco
**Decision:** Use Yoco for payment collection (SA-focused payment provider).
- Plan selection and checkout integration
- Webhook-based provisioning after payment

### Commit cf93e58 -- Per-Tenant Ollama
**Decision (later reversed):** Each merchant gets their own Ollama instance for AI inference.
- `http://ollama:11434` per container
- This consumed too much RAM on the B4ms VM

### Commits 89426d6, 9625ef0, 302df4f -- AI Model Churn
**Decision:** Tried multiple local LLM models before abandoning local inference entirely:
1. `llama3.2:3b` -- first choice, worked but responses leaked metadata
2. `qwen2.5:7b` -- better instruction following but too slow on CPU (10 min response times)
3. Back to `llama3.2:3b` with simplified SOUL.md
4. **Final pivot:** Abandoned Ollama entirely in favor of Groq cloud API (free, fast, llama-3.3-70b-versatile)

### Commit 1c5dad7 -- OpenClaw Architecture Pivot
**Decision:** Replace per-merchant Next.js bot apps with OpenClaw.
- **Before:** Each merchant got a full Next.js app deployed via Coolify (heavy, slow to provision, Coolify API was unreliable)
- **After:** OpenClaw CLI containers with Baileys for WhatsApp, QR-based linking, profile isolation
- OpenClaw handles WhatsApp connection natively without the WhatsApp Cloud API
- No Facebook Business verification required (major friction removal for informal traders)

### Commits 1a2f07b through cf64dd8 -- Provisioning Battles
**Decision:** Multiple attempts to get automatic provisioning working:
1. Coolify's Nixpacks build pack -- native dependency issues
2. Coolify's Dockerfile build pack -- couldn't handle Docker-in-Docker
3. Public git repo for Coolify to pull -- still failed
4. **Final solution:** Custom OpenClaw provisioner service with direct Docker socket access, bypassing Coolify entirely for bot deployment

### Commit 9c6f1fc -- Yoco to Stripe
**Decision:** Switch from Yoco to Stripe for subscription billing.
- **Why:** Yoco was one-time payment only, not recurring subscriptions. MoolaBiz needs monthly billing.
- Stripe supports ZAR, USD, and THB
- Proper webhook lifecycle for subscription management (pause, cancel, reactivate)
- Note: The `yocoCheckoutId` column in the DB schema is still named after Yoco (stores Stripe session IDs now)

### Commit 0190e65 -- OpenClaw Auto-Provisioner
**Decision:** Build a dedicated provisioner service instead of fighting Coolify's API.
- Lightweight Node.js HTTP server with Docker socket access
- Handles deploy, stop, start, remove, status, QR capture
- Auth via shared secret key
- SOUL.md and catalog skill auto-generated per merchant

### Commit 200332b -- Pricing Restructure
**Decision:** Move from 3 plans to 4 plans with multi-currency:
- Intro R49.99, Growth R149, Pro R299, Business R499
- Merchant payment key setup via `/set-payment-key` WhatsApp command
- Updated SOUL.md with full admin command set

### Commit e017268 -- Multi-Currency Pricing
**Decision:** Support ZAR, USD, and THB pricing.
- Admin dashboard with currency selection
- Per-currency Stripe Price IDs
- Currency switcher on landing page

### Commits cfe72b2, 254efb7 -- Security Audit
**Decision:** Major security hardening:
- HMAC session tokens (replacing plain cookies)
- PII protection on order endpoints
- Quantity caps on cart
- Admin field filtering
- Removed GET logout (CSRF risk)
- Rate limiting on login

### Commit 989d5d7 -- Web Catalog as Storefront
**Decision:** Rebuild the bot's web presence as a proper storefront (not just a product list).
- Each merchant gets a web catalog at their subdomain
- Full browse/cart/order experience
- Deployed via same container stack

### Commit 56a05f9 -- Vendure Implementation
**Decision:** Replace custom SQLite per-merchant product/order storage with Vendure.
- **Before:** Each bot container had its own SQLite database for products, orders, customers. Product data was siloed and hard to manage.
- **After:** Shared Vendure server with multi-tenant channels. Each merchant gets an isolated channel.
- Benefits: Professional e-commerce engine, proper inventory management, Stripe payment integration for customer checkout, shared Vendure storefront
- Hub acts as a "bridge" between the OpenClaw bots and Vendure via REST API endpoints
- Migration script (`migrate-to-vendure.mjs`) moves existing merchants to Vendure

### Commit aadb324 -- Dashboard Product Editing
**Decision:** Add inline product editing to the dashboard.
- Tap to edit name, price, category, description
- CRUD operations via Vendure Admin API through the hub bridge

### Commit cffa668 -- WhatsApp Catalog Commands via Vendure
**Decision:** Wire the OpenClaw bot's catalog skill to the Vendure bridge API.
- Bot uses curl to hit `moolabiz.shop/api/vendure-bridge/products` (and /orders, /settings)
- Authenticated via API secret (Bearer token)
- Exec approvals auto-configured so curl doesn't need manual approval in OpenClaw

---

## 8. Technical Debt & Known Issues

### High Priority

1. **`yocoCheckoutId` column naming:** The database column is still named `yocoCheckoutId` but stores Stripe session IDs. Should be renamed to `stripeCheckoutSessionId` or generic `checkoutSessionId`.

2. **No free tier implemented:** Market research identified a free tier as essential for trust-building in township word-of-mouth economy. The code has no free tier -- all plans require payment.

3. **Promised features not built:** Growth plan advertises "Appointment booking" and "Daily revenue reports"; Pro plan advertises "AI business advisor" and "Advanced analytics". None of these exist. This is false advertising that could erode trust.

4. **Ozow and PayFast "coming soon":** The signup form collects payment provider preference (Yoco/Ozow/PayFast) but only Yoco integration exists on the storefront side via Stripe. Ozow and PayFast are not integrated.

5. **Per-merchant container cost:** Each OpenClaw container uses up to 2GB RAM + 1 CPU. On a 16GB VM, this limits capacity to roughly 6-7 concurrent merchants. The Business tier is priced at R499/mo but the infrastructure cost per merchant is high.

6. **Vendure Admin API URL inconsistency:** `vendure-admin.ts` defaults to `http://localhost:3000/admin-api` while `vendure.ts` defaults to `http://localhost:3100/admin-api`. This would cause issues if environment variables are not set consistently.

### Medium Priority

7. **No plan change flow:** The "Change plan" button in the dashboard is disabled with "coming soon". There is no Stripe subscription update logic.

8. **Coolify app UUID column:** `coolifyAppUuid` in the schema is a remnant from the Coolify-based bot provisioning that was replaced by the OpenClaw provisioner. Dead column.

9. **No automated testing:** No test files visible in the codebase. No unit tests, integration tests, or end-to-end tests.

10. **Superadmin credentials at module level:** `vendure-admin.ts` throws at import time if `VENDURE_SUPERADMIN_USERNAME`/`PASSWORD` env vars are missing. This can crash the entire Hub app during build or if env vars are misconfigured.

11. **Hardcoded shipping/tax zone IDs:** `createMerchantChannel` uses `defaultShippingZoneId: "1"` and `defaultTaxZoneId: "1"`. These assume the default Vendure setup hasn't been modified.

12. **No backup strategy:** Both PostgreSQL databases (Hub and Vendure) and the per-merchant OpenClaw data (`/data/openclaw/`) have no documented backup process.

### Low Priority

13. **Testimonials are fabricated:** The landing page has testimonials from "Lindiwe M." (Pretoria), "Thabo K." (Johannesburg), "Fatima A." (Cape Town). These are clearly placeholder testimonials for a product with no real users yet.

14. **THB currency support:** Thai Baht support seems unusual for a South African product. Likely for the founder's personal use case but may confuse SA merchants.

15. **Auth token caching in vendure-admin.ts:** The 55-minute TTL cache is in-memory and resets on every deployment. Not a problem at current scale but worth noting.

16. **Settings page navigation tab exists but page implementation unknown:** The dashboard nav includes "Settings" but it's unclear what settings are configurable.

---

## 9. Launch Requirements

For a credible Monday launch, the following must be true:

### Must-Have (P0)

- [ ] **End-to-end signup flow works:** Landing page -> form -> plan selection -> Stripe checkout -> provisioning -> active store
- [ ] **WhatsApp connection works:** QR code displays, merchant can scan and link, bot responds to messages
- [ ] **Product management works:** Add/edit/delete products via dashboard AND via WhatsApp commands
- [ ] **Web storefront loads:** `{slug}.store.moolabiz.shop` shows merchant's products from Vendure
- [ ] **Vendure server is deployed and reachable:** Admin API and Shop API accessible from Hub and Storefront
- [ ] **Environment variables are set:** Stripe keys, Vendure credentials, provisioner key, Groq API key, Resend API key
- [ ] **DNS is configured:** `moolabiz.shop`, `*.bot.moolabiz.shop`, `*.store.moolabiz.shop`, `store.moolabiz.shop` all resolve correctly
- [ ] **SSL certificates are active:** All domains have valid HTTPS via Traefik/Let's Encrypt
- [ ] **Stripe webhooks are configured:** `checkout.session.completed` and subscription lifecycle events

### Should-Have (P1)

- [ ] **Remove or disclaimer unbuilt features:** Appointment booking, revenue reports, AI advisor, and analytics are listed in plan features but don't exist. Either remove them or add "Coming soon" labels.
- [ ] **Ozow/PayFast marked clearly as "coming soon":** The signup form shows them as options but they're not functional
- [ ] **Welcome email actually sends:** Verify Resend is configured and the welcome email template works
- [ ] **Dashboard products and orders load:** Vendure bridge API returns data correctly for authenticated merchants
- [ ] **Bot SOUL.md is coherent:** Test that the bot stays in character, doesn't leak prompts, handles off-topic gracefully

### Nice-to-Have (P2)

- [ ] **Mobile-responsive landing page:** Verify all sections render well on mobile
- [ ] **Error recovery on provisioning failure:** If OpenClaw deployment fails, merchant should see a clear retry option
- [ ] **Rate limiting on signup:** Prevent abuse of the checkout endpoint

---

## 10. Post-Launch Roadmap

### Week 1-2: Stabilize & Learn
- Monitor first merchant signups end-to-end
- Fix any provisioning failures that emerge in production
- Gather feedback on the WhatsApp bot quality (does it hallucinate? is it helpful?)
- Track drop-off points in the signup funnel

### Month 1: Free Tier & Core Gaps
- **Implement free tier** (Hustler plan): 50 conversations, 20 orders, MoolaBiz branding. Critical for word-of-mouth growth in townships.
- **Appointment booking** for Growth tier (braiders are the #1 target customer)
- **Plan upgrade/downgrade** flow in dashboard
- **Rename `yocoCheckoutId`** column and clean up dead schema fields

### Month 2: Growth Mechanics
- **Referral program:** "Bring a friend, get a free month" -- WhatsApp-native sharing
- **Township ambassador program:** R50-100 commission per signup, 5 ambassadors in 5 townships
- **Daily revenue reports** via WhatsApp (Growth plan feature)
- **Yoco partnership outreach** (200K+ SA merchants on Yoco)

### Month 3: Scale & Differentiate
- **Multi-tenant OpenClaw architecture:** Reduce from 1 container per merchant to shared instances for free/Intro/Growth tiers. This drops per-merchant cost from ~R150 to ~R25.
- **Ozow and PayFast integration** for merchant storefronts
- **AI business advisor** (Pro plan): Analyze sales data, suggest pricing, identify trends
- **Community radio marketing** (Ukhozi FM, Lesedi FM)

### Month 6: Platform Maturity
- **n8n integration** for merchant automations (low-stock alerts, reorder reminders)
- **Advanced analytics dashboard** (Pro plan)
- **Multiple WhatsApp numbers** (Business plan)
- **Custom bot personality** (Pro plan): Let merchants customize their bot's tone and language
- **Automated backups** for all data stores
- **Comprehensive test suite** (unit, integration, e2e)

---

## Appendix: Database Schema

### Hub PostgreSQL (Drizzle)

**merchants**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| business_name | text | Required |
| slug | text | Unique, derived from business name |
| whatsapp_number | text | Unique, intl format |
| email | text | Optional |
| payment_provider | text | yoco/ozow/payfast |
| pin | text | bcrypt hashed |
| plan | text | intro/growth/pro/business |
| status | text | pending -> provisioning -> active -> suspended -> cancelled |
| coolify_app_uuid | text | DEAD -- remnant from Coolify provisioning |
| openclaw_container_id | text | Docker container ID |
| subdomain | text | {slug}.bot.moolabiz.shop |
| yoco_checkout_id | text | MISNOMER -- stores Stripe checkout session ID |
| subscription_id | text | Stripe subscription ID |
| whatsapp_verify_token | text | Generated secret |
| whatsapp_app_secret | text | Generated secret |
| api_secret | text | Bearer token for vendure-bridge API |
| vendure_channel_id | text | Vendure channel ID |
| vendure_channel_token | text | Vendure channel token |
| created_at | timestamp | Auto |
| updated_at | timestamp | Auto |

**webhook_events**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| event_type | text | Stripe event type |
| event_id | text | Unique, idempotency key |
| payload | text | JSON stringified |
| processed | boolean | Default false |
| merchant_id | UUID (FK) | References merchants.id |
| created_at | timestamp | Auto |

---

*This document reflects the state of the MoolaBiz codebase as of 2026-03-21 on the `Vendure-implementation` branch.*
