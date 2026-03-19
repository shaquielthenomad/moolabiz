/**
 * OpenClaw Provisioner — lightweight HTTP service that deploys OpenClaw
 * containers via the Docker socket. Replaces the broken Coolify server
 * command API approach.
 *
 * Run inside a container with Docker socket access:
 *   docker run -d --name openclaw-provisioner --network coolify \
 *     --restart unless-stopped \
 *     -v /var/run/docker.sock:/var/run/docker.sock \
 *     -v /data/openclaw:/data/openclaw \
 *     -v /root/moolabiz/scripts/openclaw-provisioner.mjs:/app/openclaw-provisioner.mjs:ro \
 *     -e PROVISIONER_KEY=<secret> \
 *     node:22 node /app/openclaw-provisioner.mjs
 */

import http from "node:http";
import { execSync } from "node:child_process";
import fs from "node:fs";

const AUTH_KEY = process.env.PROVISIONER_KEY || "moolabiz-provision-key";
const PORT = 9999;

/** Read full request body as a string. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/** Sanitise a slug to alphanumeric + hyphens only. */
function safeSlug(slug) {
  return String(slug).replace(/[^a-z0-9-]/g, "");
}

/** Send a JSON response. */
function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ─── Route handlers ────────────────────────────────────────────────

async function handleDeploy(req, res) {
  const body = await readBody(req);
  const { slug, businessName, ownerPhone } = JSON.parse(body);
  const s = safeSlug(slug);

  if (!s) {
    return json(res, 400, { error: "Invalid slug" });
  }

  // 1. Create config directory + file
  const configDir = `/data/openclaw/${s}`;
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    `${configDir}/config.json`,
    JSON.stringify({
      gateway: {
        controlUi: { dangerouslyAllowHostHeaderOriginFallback: true },
      },
      channels: {
        whatsapp: {
          dmPolicy: "open",
          allowFrom: ["*"],
        },
      },
      agents: {
        defaults: {
          model: "ollama/qwen2.5:7b",
        },
      },
      models: {
        providers: {
          ollama: {
            baseUrl: "http://ollama-shared:11434",
          },
        },
      },
    }, null, 2)
  );

  // 1b. Create workspace with SOUL.md
  const workspaceDir = `${configDir}/workspace`;
  fs.mkdirSync(workspaceDir, { recursive: true });
  
  const soulMd = `# ${businessName || slug} Shop Bot

You are the AI-powered WhatsApp assistant for ${businessName || slug}.
You handle ALL customer messages 24/7 on behalf of the owner.

## Personality
- Warm, friendly, and patient
- Speak simply — no jargon, no complicated words
- Keep messages SHORT — most customers are on data budgets
- Maximum one emoji per message
- Use the customer's language if they message in Zulu, Xhosa, Afrikaans, Sesotho, or English

## Rules
1. Greet customers warmly
2. Help them browse products and place orders
3. Share the shop link when asked: https://${s}.bot.moolabiz.shop
4. NEVER make up products or prices — only share what's in the catalog
5. ALWAYS confirm orders before processing
6. If you cannot resolve an issue, say: "Let me connect you with the shop owner"

## Admin Commands (owner only: ${ownerPhone || "owner"})
- /add-product [name] R[price] — Add a product
- /remove-product [name] — Remove a product
- /orders — View today's orders
- /set-payment-key [key] — Connect payment provider

## Shop
- Name: ${businessName || slug}
- Store: https://${s}.bot.moolabiz.shop
- Owner: ${ownerPhone || "owner"}
`;

  fs.writeFileSync(`${workspaceDir}/SOUL.md`, soulMd);

  // 2. Remove existing container (idempotent)
  try {
    execSync(`docker rm -f openclaw-${s} 2>/dev/null`);
  } catch {
    /* ignore */
  }

  // 3. Deploy new container (internal only — no Traefik labels)
  const cmd = [
    "docker run -d",
    `--name openclaw-${s}`,
    "--network coolify",
    "--restart unless-stopped",
    "--memory 2g",
    "--cpus 1",
    `-v ${configDir}:/root/.openclaw-${s}`,
    `-e NODE_OPTIONS="--max-old-space-size=1536"`,
    `-e OPENCLAW_CONFIG_PATH=/root/.openclaw-${s}/config.json`,
    "moolabiz/openclaw:latest",
    `--profile ${s} gateway --port 18789 --bind lan --allow-unconfigured`,
  ].join(" ");

  const containerId = execSync(cmd).toString().trim();
  console.log(`[provisioner] deployed openclaw-${s} => ${containerId}`);

  // Auto-trigger WhatsApp channel login after a brief startup delay
  // This primes the QR code so it's ready when the merchant visits /onboard
  setTimeout(() => {
    try {
      console.log(`[provisioner] triggering WhatsApp login for openclaw-${s}...`);
      const { execFile: ef } = require("node:child_process");
      const proc = ef(
        "docker",
        ["exec", `openclaw-${s}`, "openclaw", "--profile", s, "channels", "login", "--channel", "whatsapp"],
        { timeout: 30000 },
        () => {} // Ignore result — it times out waiting for QR scan
      );
      // Kill after 20s — the QR will have been generated by then
      setTimeout(() => { try { proc.kill(); } catch {} }, 20000);
    } catch (err) {
      console.error(`[provisioner] auto-login trigger failed for ${s}:`, err.message);
    }
  }, 15000); // Wait 15s for OpenClaw gateway to fully start

  json(res, 200, { containerId, slug: s });
}

async function handleStop(req, res) {
  const { slug } = JSON.parse(await readBody(req));
  const s = safeSlug(slug);
  execSync(`docker stop openclaw-${s} 2>/dev/null || true`);
  console.log(`[provisioner] stopped openclaw-${s}`);
  json(res, 200, { ok: true });
}

async function handleStart(req, res) {
  const { slug } = JSON.parse(await readBody(req));
  const s = safeSlug(slug);
  execSync(`docker start openclaw-${s} 2>/dev/null || true`);
  console.log(`[provisioner] started openclaw-${s}`);
  json(res, 200, { ok: true });
}

async function handleRemove(req, res) {
  const { slug } = JSON.parse(await readBody(req));
  const s = safeSlug(slug);
  execSync(`docker rm -f openclaw-${s} 2>/dev/null || true`);
  console.log(`[provisioner] removed openclaw-${s}`);
  json(res, 200, { ok: true });
}

async function handleStatus(req, res) {
  const { slug } = JSON.parse(await readBody(req));
  const s = safeSlug(slug);
  try {
    const state = execSync(
      `docker inspect -f '{{.State.Status}}' openclaw-${s} 2>/dev/null`
    )
      .toString()
      .trim();
    json(res, 200, { slug: s, state });
  } catch {
    json(res, 200, { slug: s, state: "not_found" });
  }
}

async function handleQR(req, res) {
  const { slug } = JSON.parse(await readBody(req));
  const s = safeSlug(slug);

  // Check if already connected
  try {
    const statusOut = execSync(
      `docker exec openclaw-${s} openclaw --profile ${s} channels list 2>&1`,
      { timeout: 10000 }
    ).toString();
    // Check for ACTUAL linked state — "not linked" contains "linked" so we must exclude it
    if (statusOut.includes("linked") && !statusOut.includes("not linked")) {
      return json(res, 200, { connected: true, qr: null });
    }
  } catch { /* not connected */ }

  // Run channels login with a timeout — it blocks waiting for scan
  // We capture the QR from stdout before killing the process
  try {
    let output = "";
    try {
      output = execSync(
        `docker exec openclaw-${s} openclaw --profile ${s} channels login --channel whatsapp 2>&1`,
        { timeout: 12000 }
      ).toString();
    } catch (err) {
      // execSync throws on timeout or non-zero exit — capture output from all possible locations
      output = err.stdout?.toString() || err.output?.[1]?.toString() || err.stderr?.toString() || err.message || "";
      console.log(`[provisioner] QR capture: got ${output.length} chars from error output`);
    }

    // Extract QR lines (ASCII art with block characters)
    const qrLines = output.split("\n").filter(
      (line) => line.includes("▄") || line.includes("█") || line.includes("▀")
    );

    if (qrLines.length > 5) {
      const qrAscii = qrLines.join("\n");
      return json(res, 200, { connected: false, qr: qrAscii, type: "ascii" });
    }

    return json(res, 200, { connected: false, qr: null, message: "QR not ready yet" });
  } catch (err) {
    console.error(`[provisioner] QR fetch failed for ${s}:`, err.message);
    return json(res, 200, { connected: false, qr: null, error: err.message });
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
