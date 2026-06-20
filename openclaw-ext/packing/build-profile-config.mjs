// Multi-agent packing + owner/customer routing generator for MoolaBiz.
//
// Emits ONE OpenClaw profile config.json that hosts MANY merchants in a single
// process, each as a pair of agents (admin + shop) with sender-based routing and
// per-agent tool gating. This replaces "one Docker container per merchant".
//
// Verified against openclaw@2026.6.8:
//   - AgentsConfig = { defaults?, list?: AgentConfig[] }            src/config/types.agents.ts
//   - AgentConfig  = { id, name?, workspace?, model?, tools? , ... }
//   - AgentToolsConfig = { profile?, allow?, alsoAllow?, deny? }    src/config/types.tools.ts  (deny WINS)
//   - AgentBindingMatch = { channel, accountId?, peer?: { kind: ChatType, id } }
//   - ChatType = "direct" | "group" | "channel"                     src/channels/chat-type.ts  (DM = "direct")
//   - channels.whatsapp.accounts: Record<accountId, WhatsAppAccountConfig{authDir,...}>  src/config/types.whatsapp.ts
//   - top-level cfg.bindings: AgentBinding[]                         src/config/bindings.ts
//   - plugins.load.paths + plugins.entries.<id>.config              src/plugins/discovery.ts

const ADMIN_TOOLS = [
  "moolabiz_add_product",
  "moolabiz_list_products",
  "moolabiz_remove_product",
  "moolabiz_list_orders",
  "moolabiz_set_payment_key",
];
const SHOP_TOOLS = ["my_orders", "order_status"];

const AZURE_MODEL = "azure-openai/gpt-4o-mini";

/** Owner phone (+27…, 0…, 27…) -> WhatsApp DM JID used by binding match.peer.id. */
export function phoneToWhatsAppJid(phone) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
}

/**
 * Build one merchant's two agents + two bindings + WhatsApp account entry.
 * @param {{slug:string, businessName?:string, ownerPhone?:string}} m
 */
export function buildMerchantAgents(m, opts = {}) {
  const stateRoot = opts.stateRoot || "/root/.openclaw";
  const adminId = `${m.slug}-admin`;
  const shopId = `${m.slug}-shop`;
  const ownerJid = phoneToWhatsAppJid(m.ownerPhone);
  const biz = m.businessName || m.slug;

  const agents = [
    {
      id: adminId,
      name: `${biz} — Owner`,
      workspace: `${stateRoot}/workspace-${adminId}`,
      model: { primary: AZURE_MODEL },
      // Least-privilege base + only the admin tools. Deny shop tools for a clean set.
      tools: { profile: "minimal", alsoAllow: ADMIN_TOOLS, deny: SHOP_TOOLS },
    },
    {
      id: shopId,
      name: `${biz} — Shop`,
      workspace: `${stateRoot}/workspace-${shopId}`,
      model: { primary: AZURE_MODEL },
      // SECURITY: the customer agent is DENIED every admin tool (deny wins), so a
      // customer can never manage the shop even if routing were ever wrong.
      tools: { profile: "minimal", alsoAllow: SHOP_TOOLS, deny: ADMIN_TOOLS },
    },
  ];

  const bindings = [
    // Owner's DM -> admin agent. Most-specific match (peer) takes precedence.
    {
      agentId: adminId,
      comment: `${m.slug}: owner -> admin`,
      match: {
        channel: "whatsapp",
        accountId: m.slug,
        ...(ownerJid ? { peer: { kind: "direct", id: ownerJid } } : {}),
      },
    },
    // Everyone else on this merchant's WhatsApp account -> shop agent (unknown = customer).
    {
      agentId: shopId,
      comment: `${m.slug}: default -> shop`,
      match: { channel: "whatsapp", accountId: m.slug },
    },
  ];

  // One WhatsApp account (linked number) per merchant, keyed by slug.
  const whatsappAccount = {
    [m.slug]: {
      authDir: `${stateRoot}/wa-auth/${m.slug}`,
      dmPolicy: "open",
      allowFrom: ["*"],
      // selfChatMode stays false: the shop runs on a dedicated business number and
      // the owner is a separate peer (the admin binding), not the linked account.
    },
  };

  return { agents, bindings, whatsappAccount, adminId, shopId, ownerJid };
}

/**
 * Build a full packed profile config hosting `merchants` in one process.
 * NOTE: per-merchant apiSecret is NOT placed here (plugins.entries is per-profile).
 * It is written per-agent by buildAgentCredentialFiles() and read by the tools from
 * the agent workspace. See README "Per-merchant credentials".
 */
export function buildProfileConfig(merchants, opts = {}) {
  const themeDir = opts.themeDir || "/data/moolabiz-theme";
  const extRoot = opts.extRoot || "/data/moolabiz-ext";
  const catalogUrl = opts.catalogUrl || "https://moolabiz.shop/api/vendure-bridge";
  const azureBaseUrl =
    opts.azureBaseUrl ||
    "https://moolabiz-ai.openai.azure.com/openai/deployments/gpt-4o-mini";

  const list = [];
  const bindings = [];
  const accounts = {};

  for (const m of merchants) {
    const built = buildMerchantAgents(m, opts);
    list.push(...built.agents);
    bindings.push(...built.bindings);
    Object.assign(accounts, built.whatsappAccount);
  }

  return {
    gateway: {
      controlUi: { dangerouslyAllowHostHeaderOriginFallback: true, root: `${themeDir}/` },
    },
    channels: {
      whatsapp: { accounts },
    },
    models: {
      mode: "merge",
      providers: {
        "azure-openai": {
          baseUrl: azureBaseUrl,
          apiKey: "${AZURE_OPENAI_API_KEY}",
          api: "openai-completions",
          models: [
            {
              id: "gpt-4o-mini",
              name: "GPT-4o mini (Azure SA)",
              reasoning: false,
              input: ["text", "image"],
              contextWindow: 128000,
              maxTokens: 16384,
            },
          ],
        },
      },
    },
    plugins: {
      load: { paths: [`${extRoot}/moolabiz-tools`, `${extRoot}/moolabiz-shop-tools`] },
      // Per-profile defaults only (catalogUrl is shared). apiSecret is per-agent — see below.
      entries: {
        "moolabiz-tools": { config: { catalogUrl } },
        "moolabiz-shop-tools": { config: { catalogUrl } },
      },
    },
    agents: {
      defaults: { model: { primary: AZURE_MODEL }, timeoutSeconds: 300 },
      list,
    },
    bindings,
  };
}

/**
 * Per-agent credential files to write into each agent's workspace so the tools can
 * resolve the RIGHT merchant's apiSecret in a packed profile (tool reads it from
 * toolContext.workspaceDir/moolabiz.json). Each merchant's admin + shop agents share
 * that merchant's apiSecret + catalogUrl.
 * @returns {Array<{agentId:string, path:string, content:string}>}
 */
export function buildAgentCredentialFiles(merchants, opts = {}) {
  const stateRoot = opts.stateRoot || "/root/.openclaw";
  const catalogUrl = opts.catalogUrl || "https://moolabiz.shop/api/vendure-bridge";
  const files = [];
  for (const m of merchants) {
    for (const suffix of ["admin", "shop"]) {
      const agentId = `${m.slug}-${suffix}`;
      files.push({
        agentId,
        path: `${stateRoot}/workspace-${agentId}/moolabiz.json`,
        content: JSON.stringify({ catalogUrl, apiSecret: m.apiSecret || "" }, null, 2),
      });
    }
  }
  return files;
}

export const PACKING_CONSTANTS = { ADMIN_TOOLS, SHOP_TOOLS, AZURE_MODEL };
