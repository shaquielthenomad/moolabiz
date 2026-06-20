# MoolaBiz multi-agent packing + owner/customer routing

Turns "one Docker container per merchant" (~6–7 merchants / 16GB VM) into "many
merchants per OpenClaw profile" (~hundreds / VM), and wires the owner-vs-customer
routing in the same generator — because they're the same `agents.list[]` + `bindings`
machinery.

## What this emits (verified against openclaw@2026.6.8)

`buildProfileConfig(merchants, opts)` produces one profile `config.json`:
- `agents.list[]` — **two agents per merchant**: `{slug}-admin` and `{slug}-shop`.
- `bindings[]` — `{slug}-admin` bound to the **owner's** WhatsApp DM (`match.peer = { kind: "direct", id: <ownerJID> }`), `{slug}-shop` as the **catch-all** for that account → unknown sender = customer.
- per-agent `tools` — admin: `alsoAllow` the `moolabiz-tools`; shop: `alsoAllow` only `moolabiz-shop-tools` and **`deny` all admin tools** (deny wins → structural security gate).
- `channels.whatsapp.accounts[slug]` — one linked WhatsApp number per merchant (`authDir` per account), so one process holds many numbers.
- `plugins.load.paths` for both plugins.

`router.mjs` spreads merchants across a pool of gateway processes (density + crash blast-radius), and gives the Hub a `slug -> { gatewayId, port }` map.

## Capacity math

| | Today (per-container) | Packed |
|---|---|---|
| Unit per merchant | 1 container (~1–2 GB) | 2 agents in a shared process |
| Merchants / 16GB VM | ~6–7 | ~60/process × 4–8 processes ≈ **a few hundred** |
| Cost driver | RAM per container | shared heap + one LLM connection pool |

Defaults (`router.mjs`): 60 merchants/gateway (~120 agents), gateway ports from 18789. Tune `merchantsPerGateway` against measured memory before scaling.

## Per-merchant credentials (the important consequence of packing)

`plugins.entries.<id>.config` is **per-profile**, so in a packed profile you **cannot**
put each merchant's `apiSecret` there. Resolution moves **per-agent**:

- `buildAgentCredentialFiles(merchants)` writes `{stateRoot}/workspace-{slug}-{admin|shop}/moolabiz.json` = `{ catalogUrl, apiSecret }` for each agent.
- The tools read the secret from their **agent workspace** via `toolContext.workspaceDir` / `agentDir` (both are on `OpenClawPluginToolContext`).

**Required follow-up to the tool plugins:** `moolabiz-tools` and `moolabiz-shop-tools`
currently resolve creds from plugin config or the `CATALOG_URL`/`API_SECRET` env (fine
for one-merchant-per-container). For packed mode, add a resolution step: **prefer
`{workspaceDir}/moolabiz.json`**, then fall back to config/env. Small change, flagged
here so the gate stays correct under packing.

## Integrating into `scripts/openclaw-provisioner.mjs`

Today the provisioner does `docker run` one container per merchant. Packed flow:

1. On **add merchant**: pick a gateway with spare capacity (`gatewayForNewMerchant`), append the merchant's 2 agents + 2 bindings + WhatsApp account to that gateway's profile `config.json` (regenerate via `buildProfileConfig` for that gateway's merchant list), write the two agent workspaces (render `admin.SOUL.md` → `{slug}-admin`, `shop.SOUL.md` → `{slug}-shop`) and the two `moolabiz.json` cred files, then **reload** that gateway (OpenClaw config reload) instead of starting a new container.
2. Run a small pool of gateway containers (`moolabiz-gw-0..N`), each `openclaw --profile moolabiz-gw-i gateway --port <port>`, with process supervision + health checks.
3. The Hub addresses a merchant via `buildSlugRoutingMap` (slug → gateway port) for `notify`/catalog calls.

This module is intentionally pure (no Docker calls) so it's unit-testable and the
provisioner just consumes it.

## TODO (verify on a local OpenClaw build)

- Binding precedence: confirm the most-specific binding (owner `peer`) is chosen over the account-default binding.
- `peer.id` format for WhatsApp DMs (JID `<digits>@s.whatsapp.net` vs E.164) — adjust `phoneToWhatsAppJid` if needed.
- The `"minimal"` tool profile: confirm it still lets the agent send normal chat replies (replies are not a gated tool) and excludes fs/exec from these customer-facing agents.
- Config **reload** semantics: confirm appending to `agents.list` + `bindings` + `channels.whatsapp.accounts` and reloading attaches a new merchant without restarting the whole process (and without disrupting other merchants' live WhatsApp sessions).
- Memory per agent under load → set `merchantsPerGateway` from real numbers.
- Apply the per-agent credential read in `moolabiz-tools` / `moolabiz-shop-tools` (above).
