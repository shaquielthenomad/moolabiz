## Learned User Preferences
- User does not want Cursor internal artifacts (like `.cursor/` state files) discussed or tracked unless specifically asked.
- User expects documentation/architecture explanations to match the current implementation and will correct outdated or mismatched details.
- When requesting terminal work, user prefers exact copy-pastable commands.

## Learned Workspace Facts
- This repo is a monorepo with `apps/hub` (merchant onboarding, billing, admin dashboard) and `apps/bot` (per-merchant shop experience with OpenClaw onboarding and order flows).
- Merchants are provisioned on payment success and receive a dedicated store subdomain under `*.bot.moolabiz.shop` with an `/onboard` QR flow for WhatsApp linking.
