/**
 * OpenClaw Provisioner — lightweight HTTP service that deploys OpenClaw
 * containers via the Docker socket. Replaces the broken Coolify server
 * command API approach.
 *
 * Each container gets:
 *   - Traefik labels so the control UI is accessible at {slug}.bot.moolabiz.shop
 *   - The MoolaBiz theme (with Easy Mode overlay) mounted read-only
 *   - controlUi.root set to the theme directory in the OpenClaw config
 *   - The moolabiz/openclaw image which includes the WhatsApp plugin
 *
 * WhatsApp QR flow: The merchant visits {slug}.bot.moolabiz.shop where the
 * Easy Mode overlay handles QR natively via the gateway's WebSocket protocol
 * (web.login.start → qrDataUrl → web.login.wait). The /qr endpoint only
 * returns connection status for the Hub dashboard to poll.
 *
 * Run inside a container with Docker socket access:
 *   docker run -d --name openclaw-provisioner --network coolify \
 *     --restart unless-stopped \
 *     -v /var/run/docker.sock:/var/run/docker.sock \
 *     -v /data/openclaw:/data/openclaw \
 *     -v /data/moolabiz-theme:/data/moolabiz-theme:ro \
 *     -v /root/moolabiz/scripts/openclaw-provisioner.mjs:/app/openclaw-provisioner.mjs:ro \
 *     -e PROVISIONER_KEY=<secret> \
 *     node:22 node /app/openclaw-provisioner.mjs
 */

import http from "node:http";
import { execFileSync, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Directory containing the MoolaBiz merchant templates (SOUL.md, IDENTITY.md, etc.) */
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || "/data/moolabiz-templates";

/** Directory containing the MoolaBiz control UI theme */
const THEME_DIR = "/data/moolabiz-theme";

/** Azure OpenAI config */
const AZURE_OPENAI_BASE_URL = process.env.AZURE_OPENAI_BASE_URL || "https://moolabiz-ai.openai.azure.com/openai/deployments/gpt-4o-mini";
const AZURE_MODEL_ID = "gpt-4o-mini";

/** Truncate a string to a maximum length. */
function truncate(str, max) {
  return typeof str === "string" && str.length > max ? str.slice(0, max) : (str || "");
}

/** Auto-pick a signature emoji based on business type. */
function emojiForBusinessType(type) {
  const map = {
    food: "\uD83C\uDF54",       // 🍔
    restaurant: "\uD83C\uDF7D", // 🍽
    salon: "\u2702\uFE0F",      // ✂️
    beauty: "\uD83D\uDC85",     // 💅
    retail: "\uD83D\uDED2",     // 🛒
    fashion: "\uD83D\uDC57",    // 👗
    tech: "\uD83D\uDCBB",       // 💻
    services: "\uD83D\uDEE0",   // 🛠
    freelance: "\uD83C\uDFA8",  // 🎨
    fitness: "\uD83C\uDFCB",    // 🏋
    general: "\uD83D\uDCBC",    // 💼
  };
  return map[(type || "general").toLowerCase()] || map.general;
}

/**
 * Read all merchant template files and render them with the given variables.
 * Returns an array of { filename, content } objects.
 */
function renderTemplates(vars) {
  const templateFiles = [
    "SOUL.md", "BOOTSTRAP.md", "IDENTITY.md", "USER.md",
    "TOOLS.md", "AGENTS.md", "HEARTBEAT.md", "VENDURE_INTEGRATION.md"
  ];

  const rendered = [];
  for (const filename of templateFiles) {
    const filePath = path.join(TEMPLATES_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`[provisioner] template not found, skipping: ${filePath}`);
      continue;
    }
    let content = fs.readFileSync(filePath, "utf-8");
    // Replace all {{VAR}} placeholders with actual values
    for (const [key, value] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, value);
    }
    rendered.push({ filename, content });
  }
  return rendered;
}

/** Promise wrapper for execFile with a timeout. Returns { stdout, stderr }. No shell. */
function execFileAsync(file, args, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const killTimer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already dead */ }
    }, timeoutMs + 2000);
    const child = execFile(file, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      clearTimeout(killTimer);
      if (err) {
        resolve({ stdout: stdout || "", stderr: stderr || "", err });
      } else {
        resolve({ stdout, stderr, err: null });
      }
    });
  });
}

const AUTH_KEY = process.env.PROVISIONER_KEY;
if (!AUTH_KEY) {
  console.error("[openclaw-provisioner] PROVISIONER_KEY env var is required");
  process.exit(1);
}
if (!process.env.AZURE_OPENAI_API_KEY) {
  console.warn("[openclaw-provisioner] WARNING: AZURE_OPENAI_API_KEY not set — deployed containers will fail LLM calls");
}
const PORT = 9999;

/**
 * Simple in-memory cache: slug → { connected: bool, expiresAt: ms }
 * When a slug is confirmed connected we cache it for 2 minutes so
 * the 5s poll from the onboard page doesn't hammer `channels list`.
 * When confirmed NOT connected we cache for 30s.
 */
const connectedCache = new Map();

/** Read full request body as a string. */
function readBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/** Parse JSON body safely. Returns [data, null] on success or sends 400 and returns [null, true]. */
async function parseBody(req, res) {
  try {
    return [JSON.parse(await readBody(req)), null];
  } catch {
    json(res, 400, { error: "Invalid JSON body" });
    return [null, true];
  }
}

/** Sanitise a slug to alphanumeric + hyphens only. */
function safeSlug(slug) {
  return String(slug).replace(/[^a-z0-9-]/g, "");
}

/** Validate that a slug matches the expected pattern. Throws on invalid input. */
function sanitizeSlug(slug) {
  const s = safeSlug(slug);
  if (!s || !/^[a-z0-9-]+$/.test(s)) {
    throw new Error(`Invalid slug: ${JSON.stringify(slug)}`);
  }
  return s;
}

/** Send a JSON response. */
function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ─── Route handlers ────────────────────────────────────────────────

/** Return Docker memory and CPU limits based on the merchant's plan. */
function resourcesForPlan(plan) {
  if (plan === "business") {
    return { memory: "2g", cpus: "1" };
  }
  // Default (solopreneur or unknown): 1 GB RAM, 0.5 CPU
  return { memory: "1g", cpus: "0.5" };
}

async function handleDeploy(req, res) {
  const [body, err] = await parseBody(req, res);
  if (err) return;
  const {
    slug, businessName, ownerPhone, apiSecret, vendureChannelToken,
    // Optional fields the Hub can pass from signup data
    ownerName, businessType, timezone, paymentMethods, deliveryOptions,
    businessHours, faqs,
    // Plan determines container resource limits
    plan,
  } = body;
  let s;
  try {
    s = sanitizeSlug(slug);
  } catch {
    return json(res, 400, { error: "Invalid slug" });
  }

  const catalogUrl = `https://moolabiz.shop/api/vendure-bridge`;
  const resolvedBusinessType = businessType || "general";

  // Build template variable map
  const templateVars = {
    BUSINESS_NAME: truncate(businessName || slug, 100),
    OWNER_NAME: truncate(ownerName || businessName || slug, 100),
    OWNER_PHONE: truncate(ownerPhone || "", 20),
    BUSINESS_TYPE: resolvedBusinessType,
    BOT_NAME: `${businessName || slug}'s Bot`,
    EMOJI: emojiForBusinessType(resolvedBusinessType),
    TIMEZONE: timezone || "Africa/Johannesburg",
    SIGNUP_DATE: new Date().toISOString().split("T")[0],
    PREFERRED_LANGUAGE: "en",
    PAYMENT_METHODS: truncate(paymentMethods || "Cash, EFT", 200),
    DELIVERY_OPTIONS: truncate(deliveryOptions || "Collection", 200),
    BUSINESS_HOURS: truncate(businessHours || "Mon-Fri 08:00-17:00", 200),
    FAQS: truncate(faqs || "", 1000),
    BIZSLUG: s,
    BUSINESS_SLUG: s,
    BOT_PHONE: "",  // Not known at deploy time — filled post-WhatsApp-link
  };

  // 1. Create config directory + file
  const configDir = `/data/openclaw/${s}`;
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    `${configDir}/config.json`,
    JSON.stringify({
      gateway: {
        controlUi: {
          dangerouslyAllowHostHeaderOriginFallback: true,
          root: `${THEME_DIR}/`,
        },
      },
      channels: {
        whatsapp: {
          dmPolicy: "open",
          allowFrom: ["*"],
        },
      },
      agents: {
        defaults: {
          model: { primary: `azure-openai/${AZURE_MODEL_ID}` },
          timeoutSeconds: 300,
          workspace: `/root/.openclaw-${s}/workspace`,
        },
      },
      models: {
        mode: "merge",
        providers: {
          "azure-openai": {
            baseUrl: AZURE_OPENAI_BASE_URL,
            apiKey: "${AZURE_OPENAI_API_KEY}",
            api: "openai-completions",
            models: [
              { id: AZURE_MODEL_ID, name: "GPT-4o mini (Azure SA)", reasoning: false, input: ["text", "image"], contextWindow: 128000, maxTokens: 16384 }
            ],
          },
        },
      },
    }, null, 2)
  );

  // 1b. Create workspace and render merchant templates
  const workspaceDir = `${configDir}/workspace`;
  fs.mkdirSync(workspaceDir, { recursive: true });

  const renderedTemplates = renderTemplates(templateVars);
  for (const { filename, content } of renderedTemplates) {
    fs.writeFileSync(`${workspaceDir}/${filename}`, content);
    console.log(`[provisioner] wrote template ${filename} for ${s}`);
  }

  // 1c. Create moolabiz-catalog skill
  const skillDir = `${configDir}/skills/moolabiz-catalog`;
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(`${skillDir}/SKILL.md`, `---
name: moolabiz-catalog
description: "Manage the MoolaBiz web catalog via Vendure: add/remove products, list products, view orders, and configure payment settings. Use when the merchant (owner) sends admin commands like /add-product, /remove-product, /list-products, /orders, or /set-payment-key. Also use when the owner asks in natural language to add, remove, or list products, view orders, or set up payments."
metadata: { "openclaw": { "emoji": "\\uD83D\\uDED2", "requires": { "bins": ["curl"], "env": ["CATALOG_URL", "API_SECRET"] } } }
---

# MoolaBiz Catalog Skill

Manage the merchant's web catalog via the Vendure-backed bridge API.

## Environment

- \`CATALOG_URL\` -- e.g. \`${catalogUrl}\` (the vendure-bridge endpoint)
- \`API_SECRET\` -- Bearer token for merchant authentication

## Commands

### /add-product [name] R[price]

Parse name and price. Convert Rand to cents: R45 = 4500, R99.50 = 9950.

\`\`\`bash
curl -s -X POST "\${CATALOG_URL}/products" -H "Content-Type: application/json" -H "Authorization: Bearer \${API_SECRET}" -d '{"name":"PRODUCT_NAME","price":PRICE_IN_CENTS,"category":"General"}'
\`\`\`

On success: "Added [name] at R[price] to your catalog!"

### /remove-product [name]

First list products to find the ID, then delete:

\`\`\`bash
curl -s "\${CATALOG_URL}/products" -H "Authorization: Bearer \${API_SECRET}"
curl -s -X DELETE "\${CATALOG_URL}/products/PRODUCT_ID" -H "Authorization: Bearer \${API_SECRET}"
\`\`\`

On success: "Removed [name] from your catalog."

### /list-products or /products

\`\`\`bash
curl -s "\${CATALOG_URL}/products" -H "Authorization: Bearer \${API_SECRET}"
\`\`\`

Format as a readable list with names and prices in Rand.

### /orders

\`\`\`bash
curl -s "\${CATALOG_URL}/orders" -H "Authorization: Bearer \${API_SECRET}"
\`\`\`

Format orders with customer name, items, total.

### /set-payment-key [key]

\`\`\`bash
curl -s -X POST "\${CATALOG_URL}/settings" -H "Content-Type: application/json" -H "Authorization: Bearer \${API_SECRET}" -d '{"paymentSecretKey":"KEY_VALUE"}'
\`\`\`

On success: "Payment key saved! Customers can now pay online."

## Rules

1. Convert Rand to cents: R45 = 4500
2. On API error, tell the owner in simple terms
3. Always confirm success from the API response
4. Never reveal API_SECRET in messages
5. Only the shop owner can use these commands
`);

  // 1d. Create exec-approvals to allow curl without manual approval
  const execApprovalsDir = `${configDir}/exec-approvals`;
  fs.mkdirSync(execApprovalsDir, { recursive: true });
  fs.writeFileSync(`${execApprovalsDir}/exec-approvals.json`, JSON.stringify({
    version: 1,
    socket: {},
    defaults: {},
    agents: {
      "*": {
        allowlist: [
          { pattern: `/usr/bin/curl*${catalogUrl}*`, lastUsedAt: Date.now() }
        ]
      }
    }
  }, null, 2));

  // 2. Remove existing container (idempotent)
  try {
    execFileSync("docker", ["rm", "-f", `openclaw-${s}`], { stdio: "ignore" });
  } catch {
    /* ignore */
  }

  // 3. Deploy new container with Traefik labels for Easy Mode control UI
  //    The MoolaBiz theme (with inject.js / Easy Mode overlay) is mounted
  //    at THEME_DIR and referenced by controlUi.root in the config above.
  //    The merchant visits {slug}.bot.moolabiz.shop to scan the QR code
  //    natively via the WebSocket protocol — no ASCII QR parsing needed.
  const traefikHost = `${s}.bot.moolabiz.shop`;
  const { memory, cpus } = resourcesForPlan(plan);
  console.log(`[provisioner] plan="${plan || "solopreneur"}" => memory=${memory}, cpus=${cpus}`);
  const args = [
    "run", "-d",
    "--name", `openclaw-${s}`,
    "--network", "coolify",
    "--restart", "unless-stopped",
    "--memory", memory,
    "--cpus", cpus,
    // Traefik labels — expose the gateway control UI at {slug}.bot.moolabiz.shop
    "--label", `traefik.enable=true`,
    "--label", `traefik.http.routers.openclaw-${s}.rule=Host(\`${traefikHost}\`)`,
    "--label", `traefik.http.routers.openclaw-${s}.entrypoints=https`,
    "--label", `traefik.http.routers.openclaw-${s}.tls=true`,
    "--label", `traefik.http.routers.openclaw-${s}.tls.certresolver=letsencrypt`,
    "--label", `traefik.http.services.openclaw-${s}.loadbalancer.server.port=18789`,
    // Volumes — mount config, theme, and exec-approvals
    "-v", `${configDir}:/root/.openclaw-${s}`,
    "-v", `${THEME_DIR}:${THEME_DIR}:ro`,
    "-v", `${execApprovalsDir}/exec-approvals.json:/root/.openclaw/exec-approvals.json`,
    "--env", `NODE_OPTIONS=--max-old-space-size=1536`,
    "--env", `OPENCLAW_CONFIG_PATH=/root/.openclaw-${s}/config.json`,
    "--env", `CATALOG_URL=${catalogUrl}`,
  ];
  if (apiSecret) args.push("--env", `API_SECRET=${apiSecret}`);
  if (ownerPhone) args.push("--env", `OWNER_PHONE=${ownerPhone}`);
  if (process.env.AZURE_OPENAI_API_KEY) args.push("--env", `AZURE_OPENAI_API_KEY=${process.env.AZURE_OPENAI_API_KEY}`);
  args.push("moolabiz/openclaw:latest");
  args.push("--profile", s, "gateway", "--port", "18789", "--bind", "loopback", "--allow-unconfigured");

  const containerId = execFileSync("docker", args, { encoding: "utf-8", timeout: 30000 }).trim();
  console.log(`[provisioner] deployed openclaw-${s} => ${containerId}`);

  // Copy custom workspace files to OpenClaw's actual workspace path
  // OpenClaw reads from /root/.openclaw/workspace-{slug}/ not /root/.openclaw-{slug}/workspace/
  setTimeout(() => {
    try {
      const container = `openclaw-${s}`;
      execFileSync("docker", ["exec", container, "mkdir", "-p", `/root/.openclaw/workspace-${s}/skills`], { timeout: 10000 });
      execFileSync("docker", ["exec", container, "sh", "-c",
        `cp /root/.openclaw-${s}/workspace/*.md /root/.openclaw/workspace-${s}/`], { timeout: 10000 });
      try {
        execFileSync("docker", ["exec", container, "sh", "-c",
          `cp -r /root/.openclaw-${s}/workspace/skills/* /root/.openclaw/workspace-${s}/skills/`], { timeout: 10000 });
      } catch { /* skills dir may not exist */ }
      console.log(`[provisioner] copied workspace files for ${s}`);
    } catch(e) { console.error(`[provisioner] workspace copy failed:`, e.message); }
  }, 5000);

  json(res, 200, { containerId, slug: s, controlUi: `https://${traefikHost}` });
}

async function handleStop(req, res) {
  const [body, err] = await parseBody(req, res);
  if (err) return;
  const { slug } = body;
  const s = sanitizeSlug(slug);
  try {
    execFileSync("docker", ["stop", `openclaw-${s}`], { stdio: "ignore" });
  } catch { /* container may not exist */ }
  console.log(`[provisioner] stopped openclaw-${s}`);
  json(res, 200, { ok: true });
}

async function handleStart(req, res) {
  const [body, err] = await parseBody(req, res);
  if (err) return;
  const { slug } = body;
  const s = sanitizeSlug(slug);
  try {
    execFileSync("docker", ["start", `openclaw-${s}`], { stdio: "ignore" });
  } catch { /* container may not exist */ }
  console.log(`[provisioner] started openclaw-${s}`);
  json(res, 200, { ok: true });
}

async function handleRemove(req, res) {
  const [body, err] = await parseBody(req, res);
  if (err) return;
  const { slug } = body;
  const s = sanitizeSlug(slug);
  try {
    execFileSync("docker", ["rm", "-f", `openclaw-${s}`], { stdio: "ignore" });
  } catch { /* container may not exist */ }
  connectedCache.delete(s);
  console.log(`[provisioner] removed openclaw-${s}`);
  json(res, 200, { ok: true });
}

async function handleStatus(req, res) {
  const [body, err] = await parseBody(req, res);
  if (err) return;
  const { slug } = body;
  const s = sanitizeSlug(slug);
  try {
    const state = execFileSync(
      "docker",
      ["inspect", "-f", "{{.State.Status}}", `openclaw-${s}`],
      { encoding: "utf-8" }
    ).trim();
    json(res, 200, { slug: s, state });
  } catch {
    json(res, 200, { slug: s, state: "not_found" });
  }
}

/**
 * handleQR — simplified to just check WhatsApp connection status.
 *
 * The actual QR code rendering is handled entirely by the Easy Mode overlay
 * in the control UI at {slug}.bot.moolabiz.shop. The overlay uses the
 * gateway's WebSocket protocol:
 *   1. Calls web.login.start → receives payload.qrDataUrl (base64 PNG)
 *   2. Renders the QR as a native image in the branded overlay
 *   3. Calls web.login.wait → detects when scan completes
 *
 * This endpoint now only returns { connected: true/false } for the Hub
 * dashboard to poll connection status.
 */
async function handleQR(req, res) {
  const [body, err] = await parseBody(req, res);
  if (err) return;
  const { slug } = body;
  const s = sanitizeSlug(slug);

  // Fast path: check in-memory cache first
  const cached = connectedCache.get(s);
  if (cached && cached.expiresAt > Date.now()) {
    return json(res, 200, {
      connected: cached.connected,
      controlUi: `https://${s}.bot.moolabiz.shop`,
    });
  }

  // Check if WhatsApp is connected via channels list
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["exec", `openclaw-${s}`, "openclaw", "--profile", s, "channels", "list"],
      15000
    );
    const statusOut = stdout + stderr;
    // Check for ACTUAL linked state — "not linked" contains "linked" so we must exclude it
    const isConnected = statusOut.includes("linked") && !statusOut.includes("not linked");

    if (isConnected) {
      console.log(`[provisioner] ${s}: WhatsApp connected`);
      connectedCache.set(s, { connected: true, expiresAt: Date.now() + 120000 }); // 2-min cache
    } else {
      connectedCache.set(s, { connected: false, expiresAt: Date.now() + 30000 }); // 30s cache
    }

    return json(res, 200, {
      connected: isConnected,
      controlUi: `https://${s}.bot.moolabiz.shop`,
    });
  } catch {
    // Container not running or channels command failed
    return json(res, 200, {
      connected: false,
      controlUi: `https://${s}.bot.moolabiz.shop`,
    });
  }
}

// ─── Server ────────────────────────────────────────────────────────

const routes = {
  "/deploy": handleDeploy,
  "/stop": handleStop,
  "/start": handleStart,
  "/remove": handleRemove,
  "/status": handleStatus,
  "/qr": handleQR,
};

const server = http.createServer(async (req, res) => {
  // Auth check
  if (req.headers["x-auth-key"] !== AUTH_KEY) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const handler = routes[req.url];
  if (!handler) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[provisioner] ${req.url} failed:`, err.message);
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[openclaw-provisioner] listening on port ${PORT}`);
});
