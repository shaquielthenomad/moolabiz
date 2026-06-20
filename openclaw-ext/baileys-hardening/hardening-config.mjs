/**
 * baileys-hardening/hardening-config.mjs
 *
 * Helper that augments a per-merchant WhatsApp account config with every
 * hardening knob that OpenClaw's whatsapp channel config ACTUALLY exposes.
 *
 * VERIFIED SOURCES
 * ─────────────────────────────────────────────────────────────────────
 * Config fields (WhatsAppAccountConfig / WhatsAppSharedConfig):
 *   openclaw/src/config/types.whatsapp.ts
 *
 * Socket timing fields (read from cfg.web?.whatsapp by resolveWhatsAppSocketTiming):
 *   openclaw/extensions/whatsapp/src/socket-timing.ts  lines 52–70
 *   Defaults: keepAliveIntervalMs=25000, connectTimeoutMs=60000,
 *             defaultQueryTimeoutMs=60000
 *
 * markOnlineOnConnect=false: hard-coded in createWaSocket, NOT a config knob.
 *   openclaw/extensions/whatsapp/src/session.ts  line 181
 *   There is NO "markOnline" field in WhatsAppConfig or WhatsAppAccountConfig.
 *
 * Proxy support: env-variable ONLY (HTTPS_PROXY / https_proxy / HTTP_PROXY).
 *   session.ts resolveEnvProxyAgent() / resolveEnvFetchDispatcher() read from
 *   process.env at socket-creation time.  There is NO proxy/agent/fetchAgent
 *   field in WhatsAppConfig.  See README for the Docker --env approach.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE DOES
 *   applyBaileysHardening(accountCfg) merges config-level hardening into
 *   whatever the provisioner writes under channels.whatsapp.accounts[slug].
 *
 * WHAT THIS FILE DOES NOT DO
 *   - Proxy injection (env-variable only — handled at container level).
 *   - Enforce warm-up / pacing / daily caps (operational layer, not config).
 */

// ─── Policy constants ────────────────────────────────────────────────────────

/**
 * Number of calendar days for the SIM warm-up phase.
 * Day 1–3: max 20 msgs/day, human-only test conversations.
 * Day 4–7: bot sends up to 30 msgs/day, friendly conversations only.
 * Day 8–14: ramp to DAILY_CAP_WARMUP.
 * Day 15+: full DAILY_CAP_STEADY applies.
 */
export const WARMUP_DAYS = 14;

/**
 * Maximum outbound bot-initiated messages per 24-hour window during warm-up.
 * Keep well below WhatsApp's undisclosed threshold (~50 for new numbers).
 */
export const DAILY_CAP_WARMUP = 30;

/**
 * Maximum outbound bot-initiated messages per 24-hour window after warm-up.
 * Stays conservative — reply-to-inbound messages do NOT count against this cap,
 * only bot-initiated (proactive) sends do.
 */
export const DAILY_CAP_STEADY = 80;

/**
 * Minimum inter-message delay in milliseconds for outbound sends.
 * Simulates human typing pause; prevents burst detection.
 * 3 000 ms = 3 seconds minimum gap between consecutive outbound messages
 * to the SAME recipient within one session.
 */
export const MIN_INTER_MESSAGE_DELAY_MS = 3_000;

/**
 * Maximum inter-message delay in milliseconds for outbound sends.
 * Randomise between MIN and MAX per message for human-like variance.
 * 8 000 ms = 8 seconds maximum.
 */
export const MAX_INTER_MESSAGE_DELAY_MS = 8_000;

/**
 * Debounce window for batching rapid inbound bursts from the same sender.
 * Verified config field: WhatsAppSharedConfig.debounceMs
 * (openclaw/src/config/types.whatsapp.ts line 107)
 *
 * Setting this to 1 500 ms means the bot won't attempt a reply until the
 * sender has been quiet for 1.5 s — prevents splitting a reply across
 * several re-triggers and generating spammy-looking response traffic.
 */
export const INBOUND_DEBOUNCE_MS = 1_500;

// ─── Socket timing hardening ─────────────────────────────────────────────────
//
// These three values are read by resolveWhatsAppSocketTiming()
// (socket-timing.ts:52–70) from cfg.web?.whatsapp (legacy) OR from the
// per-account overrides passed into createWaSocket.
//
// IMPORTANT: the socket-timing resolver reads cfg.web?.whatsapp (a legacy
// flat config path), NOT from channels.whatsapp.accounts[id].  The only
// way to apply them per-account today is through the WhatsAppSocketTimingOptions
// passed programmatically; there is no JSON config field at the account level
// for these.  Document them here for completeness and for when a future
// OpenClaw version adds per-account timing.
//
// Defaults from DEFAULT_WHATSAPP_SOCKET_TIMING (socket-timing.ts:30–34):
//   keepAliveIntervalMs:      25 000
//   connectTimeoutMs:         60 000
//   defaultQueryTimeoutMs:    60 000
//
// Hardened values: slightly longer keepAlive to avoid overly frequent pings
// that look bot-like on a mobile proxy; connect/query timeouts extended to
// survive higher-latency residential proxies.

export const HARDENED_SOCKET_TIMING = {
  keepAliveIntervalMs: 30_000,       // was 25 000 — fewer keepAlive pings per hour
  connectTimeoutMs: 90_000,          // was 60 000 — tolerate slow residential proxy
  defaultQueryTimeoutMs: 90_000,     // was 60 000 — tolerate slow residential proxy
};

// ─── Config-level hardening (fields that ACTUALLY exist in WhatsAppAccountConfig) ──

/**
 * applyBaileysHardening(accountCfg)
 *
 * Takes an existing per-account WhatsApp config object (the object written
 * under channels.whatsapp.accounts[slug] in config.json) and returns a new
 * object with all verifiable hardening fields merged in.
 *
 * Only fields confirmed to exist in WhatsAppSharedConfig or WhatsAppAccountConfig
 * (types.whatsapp.ts) are set here.
 *
 * @param {object} accountCfg - Existing account config (may be empty {}).
 * @returns {object} Hardened account config ready to merge into config.json.
 */
export function applyBaileysHardening(accountCfg = {}) {
  return {
    ...accountCfg,

    // ── Presence / online signal ─────────────────────────────────────────────
    // markOnlineOnConnect is HARD-CODED to false inside createWaSocket
    // (session.ts:181).  There is no config field for it; this is already safe
    // by default.  No action needed here.

    // ── Reaction noise reduction ─────────────────────────────────────────────
    // reactionLevel: verified field — WhatsAppSharedConfig.reactionLevel
    // "off" means zero reaction sends, removing one category of bot-like signal.
    // Use "ack" if the merchant specifically wants the eyes-emoji ACK.
    reactionLevel: accountCfg.reactionLevel ?? "off",

    // ── ACK reaction (eyes emoji) ─────────────────────────────────────────────
    // ackReaction: verified field — WhatsAppSharedConfig.ackReaction
    // Disable by default; ACK reactions are an additional send event per message.
    ackReaction: accountCfg.ackReaction ?? {
      emoji: "",      // empty = disabled
      direct: false,
      group: "never",
    },

    // ── Inbound debounce ─────────────────────────────────────────────────────
    // debounceMs: verified field — WhatsAppSharedConfig.debounceMs (line 107)
    // Batches rapid multi-message bursts so the bot replies once rather than
    // generating N reply events in quick succession.
    debounceMs: accountCfg.debounceMs ?? INBOUND_DEBOUNCE_MS,

    // ── Read receipts ─────────────────────────────────────────────────────────
    // sendReadReceipts: verified field — WhatsAppConfigCore.sendReadReceipts
    // Keeping this true (default) is SAFER — bots that never send read receipts
    // look suspicious.  Override to false only if the merchant specifically
    // requests privacy mode.
    sendReadReceipts: accountCfg.sendReadReceipts ?? true,

    // ── Text chunking ─────────────────────────────────────────────────────────
    // textChunkLimit: verified field — WhatsAppSharedConfig.textChunkLimit
    // Shorter chunks (~400 chars) paired with MIN/MAX_INTER_MESSAGE_DELAY_MS
    // create multi-bubble replies that look more human.  Only relevant for
    // very long responses; the pacing delay must be implemented in the send
    // loop (see README — not a config field).
    textChunkLimit: accountCfg.textChunkLimit ?? 400,

    // ── NOTE: fields NOT available in OpenClaw WhatsApp config ──────────────
    // The following are NOT in types.whatsapp.ts and must NOT be set here:
    //   proxy, agent, fetchAgent   → env-variable only (HTTPS_PROXY)
    //   markOnline                 → hard-coded false in session.ts
    //   rateLimitPerMinute         → no such field exists
    //   sendDelay / typingDelay    → no such field exists
  };
}

/**
 * buildHardenedAccountsBlock(slugs)
 *
 * Convenience wrapper: given an array of merchant slugs that all share one
 * OpenClaw profile (multi-account mode), returns the full accounts object
 * ready to spread into channels.whatsapp.
 *
 * Typical provisioner usage:
 *
 *   import { buildHardenedAccountsBlock } from "./openclaw-ext/baileys-hardening/hardening-config.mjs";
 *   const accounts = buildHardenedAccountsBlock([slug]);
 *   // then write  { channels: { whatsapp: { dmPolicy: "open", ...accounts } } }
 *
 * @param {string[]} slugs
 * @returns {{ accounts: Record<string, object> }}
 */
export function buildHardenedAccountsBlock(slugs) {
  const accounts = {};
  for (const slug of slugs) {
    accounts[slug] = applyBaileysHardening({
      name: slug,
      enabled: true,
    });
  }
  return { accounts };
}
