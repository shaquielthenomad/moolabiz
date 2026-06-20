# Baileys Anti-Ban Hardening Playbook — MoolaBiz

> **Scope**: OpenClaw `whatsapp` channel (Baileys-based).
> Verified against sources on 2026-06-21.
>
> **Key source files read**:
> - `openclaw/src/config/types.whatsapp.ts` — full config surface
> - `openclaw/extensions/whatsapp/src/session.ts` — socket creation, proxy hook
> - `openclaw/extensions/whatsapp/src/socket-timing.ts` — timing defaults/resolver
> - `openclaw-analysis/A-channels-whatsapp.md` — architecture summary
> - `moolabiz-audit/repo/scripts/openclaw-provisioner.mjs` — current deploy path

---

## 0. Reality check: what can be set in config vs what cannot

This section is the most important one to read before touching anything.

### Config knobs that ACTUALLY exist (verified in `types.whatsapp.ts`)

| Field | Type | Default | Hardening value | Why |
|---|---|---|---|---|
| `reactionLevel` | `"off"\|"ack"\|"minimal"\|"extensive"` | `"minimal"` | `"off"` | Removes one class of automated send event per inbound message |
| `ackReaction.emoji` | string | `""` | `""` (disabled) | Same — ACK reacts are extra sends |
| `ackReaction.direct` | bool | `true` | `false` | Eliminate automated reactions in DMs |
| `ackReaction.group` | string | `"mentions"` | `"never"` | Same for groups |
| `debounceMs` | number | `0` | `1500` | Batches rapid bursts so the bot replies once rather than triggering N reply events |
| `sendReadReceipts` | bool | `true` | `true` (keep default) | Bots that never send read receipts look suspicious; keep on |
| `textChunkLimit` | number | `4000` | `400` | Shorter multi-bubble replies look more human when paired with send delays |

### Socket timing (read from `cfg.web?.whatsapp`, NOT per-account)

These three fields are read by `resolveWhatsAppSocketTiming()` (`socket-timing.ts:52–70`) from the top-level `cfg.web?.whatsapp` path — **not** from `channels.whatsapp.accounts[id]`. There is currently no per-account JSON field for them. Setting them in the top-level `web.whatsapp` block of `config.json` applies to all accounts on that container.

```jsonc
// config.json  (top-level, not inside channels.whatsapp)
{
  "web": {
    "whatsapp": {
      "keepAliveIntervalMs": 30000,
      "connectTimeoutMs": 90000,
      "defaultQueryTimeoutMs": 90000
    }
  }
}
```

Rationale: slightly longer keepAlive (30 s vs 25 s default) reduces keepAlive ping frequency. Extended connect/query timeouts prevent spurious reconnects on higher-latency residential proxies.

### Fields that DO NOT exist in OpenClaw's WhatsApp config

The following are **not** in `WhatsAppConfig` or `WhatsAppAccountConfig`. Do not attempt to set them; they will be silently ignored.

- `proxy`, `agent`, `fetchAgent` — **env-variable only** (see Section 2 below)
- `markOnline` / `markOnlineOnConnect` — hard-coded `false` in `session.ts:181`, cannot be overridden from config
- `rateLimitPerMinute`, `sendDelay`, `typingDelay` — do not exist anywhere in the config schema

---

## 1. Dedicated business SIM per merchant (non-negotiable)

**Never link a merchant's personal WhatsApp number to an automated bot.**

WhatsApp's ban hammer hits the phone number, not the server IP. A banned personal number loses all the merchant's existing conversations, contacts, and groups — this is unrecoverable and will immediately destroy trust.

**Requirements**:
- One physical or eSIM per merchant, registered to their business (or a business-purpose prepaid SIM).
- The SIM must be active on a real handset before linking. Link it as a Linked Device (multi-device), not as the primary device.
- After QR linking, the handset can be turned off and put away — Baileys operates as a standalone linked device.
- Do NOT reuse a number that was previously used for mass marketing, OTP bypass, or any prior ban incident.

---

## 2. Per-session residential or mobile proxy — the single highest-impact mitigation

### Why datacenter IPs get accounts banned

Baileys connects to `wss://mmg.whatsapp.net` from a server IP. WhatsApp cross-references the connecting IP against ASN/geolocation. A DigitalOcean / Hetzner / AWS IP pairing with a South African SIM is a massive anomaly signal. This is the primary driver of silent bans.

### Does OpenClaw's WhatsApp config support a proxy field?

**No.** After reading `types.whatsapp.ts` in full: there is no `proxy`, `proxyUrl`, `agent`, or `fetchAgent` field in `WhatsAppConfig` or `WhatsAppAccountConfig`.

OpenClaw's `session.ts` DOES support proxies — but only through environment variables:

```
session.ts:233–253  resolveEnvProxyAgent()   → reads HTTPS_PROXY / https_proxy / HTTP_PROXY
session.ts:256–274  resolveEnvFetchDispatcher() → same env vars for media upload fetches
```

Both paths call `createNodeProxyAgent({ mode: "env", ... })` and `createHttp1EnvHttpProxyAgent()` from the OpenClaw plugin SDK. The proxy is injected at socket creation time from `process.env`.

### How to apply a proxy — container-level environment variable

Inject `HTTPS_PROXY` at `docker run` time in the provisioner. The variable is already read by session.ts with no code changes needed.

```bash
docker run ... \
  --env HTTPS_PROXY=https://user:pass@proxy-host:port \
  moolabiz/openclaw:latest
```

For a SOCKS5 proxy (common with residential providers):

```bash
--env HTTPS_PROXY=socks5://user:pass@proxy-host:port
```

**One proxy per container** — each merchant container gets a dedicated residential or mobile proxy IP that matches the SIM's country (South Africa for ZA numbers).

Recommended provider types (in order of preference):
1. Mobile proxy (rotates on a real 4G/LTE SIM) — most human-looking ASN
2. Residential rotating proxy — acceptable, pick a ZA exit node
3. Static residential — acceptable only if the IP is stable long-term
4. Datacenter — **do not use**

### Provisioner edit needed

In `handleDeploy` (`openclaw-provisioner.mjs:185`), after the `apiSecret` and `ownerPhone` env-var injections at lines 404–406, add:

```js
// Anti-ban: inject residential proxy for WhatsApp WebSocket + media uploads.
// PROXY_URL_{SLUG} takes precedence; PROXY_URL_DEFAULT is a shared fallback.
const proxyUrl =
  process.env[`PROXY_URL_${s.toUpperCase().replace(/-/g, "_")}`] ||
  process.env.PROXY_URL_DEFAULT;
if (proxyUrl) {
  args.push("--env", `HTTPS_PROXY=${proxyUrl}`);
  args.push("--env", `https_proxy=${proxyUrl}`);  // lowercase variant also checked by session.ts
} else {
  console.warn(`[provisioner] WARNING: no proxy configured for ${s} — datacenter IP will be used`);
}
```

Set per-merchant proxy URLs in the provisioner's environment:
```
PROXY_URL_MERCHANT_SLUG=socks5://user:pass@za-mobile-proxy.example.com:1080
PROXY_URL_DEFAULT=socks5://user:pass@za-residential-pool.example.com:1080
```

---

## 3. Warm-up schedule

New Baileys sessions on fresh SIMs must be ramped up gradually. WhatsApp monitors velocity on new devices.

| Days | Daily outbound cap | Allowed traffic |
|---|---|---|
| 1–3 | 10–20 msgs | Human test conversations only; NO bot sends |
| 4–7 | 30 msgs | Bot replies to inbound; no proactive blasts |
| 8–14 | 50 msgs | Gradual ramp; mixed inbound-reply + proactive |
| 15+ | 80 msgs (see `DAILY_CAP_STEADY`) | Normal operation |

Policy constants are exported from `hardening-config.mjs`:
```js
import { WARMUP_DAYS, DAILY_CAP_WARMUP, DAILY_CAP_STEADY } from "./hardening-config.mjs";
```

The provisioner must track `linkedAt` timestamp per merchant and enforce these caps in the `handleNotify` path (or in any bulk-send loop).

---

## 4. Human-like pacing (operational discipline — not a config knob)

OpenClaw has no built-in send-delay or rate-limit config. Pacing must be implemented in the provisioner's `handleNotify` handler or any bulk-send loop.

```js
import {
  MIN_INTER_MESSAGE_DELAY_MS,
  MAX_INTER_MESSAGE_DELAY_MS,
} from "./openclaw-ext/baileys-hardening/hardening-config.mjs";

function humanDelay() {
  const range = MAX_INTER_MESSAGE_DELAY_MS - MIN_INTER_MESSAGE_DELAY_MS;
  return MIN_INTER_MESSAGE_DELAY_MS + Math.floor(Math.random() * range);
}

// In a bulk-send loop:
for (const recipient of recipients) {
  await sendWhatsApp(slug, recipient, message);
  await new Promise(r => setTimeout(r, humanDelay())); // 3–8 s random gap
}
```

Additionally:
- Never send the same message verbatim to more than ~10 recipients in sequence. Vary the text slightly (personalise with name, order reference, etc.).
- Do not send before 08:00 or after 20:00 in the merchant's timezone.
- Avoid sending on Sundays unless the merchant's business explicitly operates on Sundays.

---

## 5. Volume caps

Apply these per merchant per 24-hour rolling window:

| Phase | Inbound replies | Proactive / bulk sends |
|---|---|---|
| Warm-up (days 1–14) | Unlimited (reply to inbound) | Max `DAILY_CAP_WARMUP` = 30 |
| Steady state | Unlimited | Max `DAILY_CAP_STEADY` = 80 |

**Do not** send broadcast/bulk messages to contacts who have not messaged the bot in the last 7 days. Cold-messaging is the second highest ban trigger after datacenter IPs.

---

## 6. Signals of an impending ban

Monitor for these conditions per container. Log them as structured warnings so the hub dashboard can surface alerts.

| Signal | What it means | Action |
|---|---|---|
| `connection.update` close with status `428` | Account restricted / rate-limited | Pause all sends for 24 h; check proxy |
| `connection.update` close with status `401` | Logged out — account banned or creds invalidated | Do not re-link same number; escalate to merchant |
| Repeated `QR required` on session that was previously linked | WhatsApp revoked the linked device | Check for policy violation reports |
| `sock.sendMessage` consistently throws `WhatsAppSocketOperationTimeoutError` | Connection degraded | Switch proxy IP; restart container |
| Zero inbound messages for >24 h on an active account | Possible shadow-ban | Send a test message from a different number; check proxy health |

The disconnect handler is in `session.ts:191–221`. Status 401 already logs a clear error:
```
danger("WhatsApp session logged out. Run: openclaw channels login")
```
Wire this to a Slack/email alert in the gateway logs so MoolaBiz operations is notified within minutes.

---

## 7. What to do when a number is banned

1. Stop the container immediately: `POST /stop { slug }`.
2. Do NOT attempt to re-link the same number — repeated QR scans after a ban are flagged.
3. Acquire a new SIM (different number, different carrier if possible).
4. Deploy a new container with `POST /deploy` using the new number.
5. The merchant must re-acquire their customer contacts organically (they cannot be ported).
6. Audit what triggered the ban before re-deploying: check message volume, proxy health, and whether any content triggered spam reports.
7. If the ban was a datacenter IP issue, ensure the new container has a residential/mobile proxy before the new number is linked.

---

## 8. Config to add in `config.json` (provisioner edit)

The current provisioner writes this WhatsApp block (`openclaw-provisioner.mjs:238–242`):

```json
"whatsapp": {
  "dmPolicy": "open",
  "allowFrom": ["*"]
}
```

Replace with the hardened version:

```json
"whatsapp": {
  "dmPolicy": "open",
  "allowFrom": ["*"],
  "reactionLevel": "off",
  "ackReaction": { "emoji": "", "direct": false, "group": "never" },
  "debounceMs": 1500,
  "sendReadReceipts": true,
  "textChunkLimit": 400
},
```

And add the socket timing block at the top level (not inside `channels`):

```json
"web": {
  "whatsapp": {
    "keepAliveIntervalMs": 30000,
    "connectTimeoutMs": 90000,
    "defaultQueryTimeoutMs": 90000
  }
}
```

You can use `applyBaileysHardening({})` from `hardening-config.mjs` to generate the per-account fields programmatically instead of hardcoding them.

---

## 9. Summary of all provisioner edits required

1. **Proxy injection** (highest impact — Section 2): add `HTTPS_PROXY` env-var to `docker run` args; source the URL from `PROXY_URL_{SLUG}` or `PROXY_URL_DEFAULT`.
2. **Hardened config.json** (Section 8): update the `channels.whatsapp` block and add `web.whatsapp` socket timing.
3. **Send pacing in `handleNotify`** (Section 4): add `humanDelay()` between sends in any bulk-send loop.
4. **Daily cap enforcement** (Section 5): track `linkedAt` and message count per slug; gate `handleNotify` on `DAILY_CAP_WARMUP` / `DAILY_CAP_STEADY`.
5. **Ban signal alerting** (Section 6): parse container logs for status 401/428 disconnect events; push to hub alerts.

---

## 10. The single highest-impact mitigation

**Per-container residential or mobile proxy via `HTTPS_PROXY` environment variable.**

A South African merchant SIM connecting from a Hetzner Frankfurt ASN is the top ban signal. No amount of message pacing or config tuning overcomes a datacenter IP. OpenClaw already has the proxy hook built in (`session.ts:233`); it just needs the env var injected at `docker run` time. This one change eliminates the primary ban vector with zero code changes to OpenClaw itself.
