/**
 * OpenClaw provisioning — each merchant gets their own OpenClaw instance
 * running `openclaw gateway` with a unique --profile for isolation.
 *
 * Deployed as Docker containers via Coolify's server command API.
 * Each container runs on the coolify network with Traefik labels
 * for routing /onboard to the OpenClaw web UI (QR code page).
 */

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} is not set`);
  return val;
}

function getCoolifyConfig() {
  return {
    apiUrl: getEnv("COOLIFY_API_URL"),
    apiToken: getEnv("COOLIFY_API_TOKEN"),
    serverUuid: getEnv("COOLIFY_SERVER_UUID"),
  };
}

async function executeOnServer(command: string): Promise<string> {
  const cfg = getCoolifyConfig();
  const res = await fetch(
    `${cfg.apiUrl}/api/v1/servers/${cfg.serverUuid}/command`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ command }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[openclaw] Server command failed (${res.status}):`, body);
    throw new Error(`Server command failed: HTTP ${res.status}`);
  }

  return res.text();
}

/**
 * Deploy an OpenClaw container for a merchant.
 * Each merchant gets their own isolated OpenClaw instance with:
 * - Unique profile (--profile {slug})
 * - Own WhatsApp session storage
 * - Traefik routing for /onboard QR page
 */
export async function deployOpenClaw(opts: {
  slug: string;
  businessName: string;
  ownerPhone: string;
  paymentProvider: string;
}): Promise<{ containerId: string }> {
  const slug = opts.slug.replace(/[^a-z0-9-]/g, "");

  const cmd = `
set -e

# Remove existing container if any
docker rm -f "openclaw-${slug}" 2>/dev/null || true

# Run OpenClaw gateway for this merchant
CONTAINER_ID=$(docker run -d \\
  --name "openclaw-${slug}" \\
  --network coolify \\
  --restart unless-stopped \\
  --memory 256m \\
  --cpus 0.25 \\
  -v "openclaw-${slug}-data:/root/.openclaw-${slug}" \\
  -e OLLAMA_BASE_URL=http://ollama-shared:11434 \\
  -l "traefik.enable=true" \\
  -l "traefik.http.routers.oc-${slug}.rule=Host(\\\`${slug}.bot.moolabiz.shop\\\`) && PathPrefix(\\\`/onboard\\\`)" \\
  -l "traefik.http.routers.oc-${slug}.entrypoints=https" \\
  -l "traefik.http.routers.oc-${slug}.tls.certresolver=letsencrypt" \\
  -l "traefik.http.routers.oc-${slug}.tls=true" \\
  -l "traefik.http.services.oc-${slug}.loadbalancer.server.port=18789" \\
  -l "traefik.http.routers.oc-${slug}.priority=100" \\
  node:22-slim \\
  sh -c "npx -y openclaw --profile ${slug} gateway --port 18789 --bind 0.0.0.0")

echo "CONTAINER_ID=\${CONTAINER_ID}"
`.trim();

  console.log(`[openclaw] Deploying for ${slug}...`);
  const output = await executeOnServer(cmd);

  const match = output.match(/CONTAINER_ID=([a-f0-9]+)/);
  const containerId = match?.[1] || "unknown";

  console.log(`[openclaw] Deployed: ${slug} (${containerId})`);
  return { containerId };
}

export async function stopOpenClaw(slug: string): Promise<void> {
  const s = slug.replace(/[^a-z0-9-]/g, "");
  await executeOnServer(`docker stop "openclaw-${s}" 2>/dev/null || true`);
}

export async function startOpenClaw(slug: string): Promise<void> {
  const s = slug.replace(/[^a-z0-9-]/g, "");
  await executeOnServer(`docker start "openclaw-${s}" 2>/dev/null || true`);
}

export async function removeOpenClaw(slug: string): Promise<void> {
  const s = slug.replace(/[^a-z0-9-]/g, "");
  await executeOnServer(`docker rm -f "openclaw-${s}" 2>/dev/null || true`);
}

export async function sendMessage(slug: string, to: string, text: string): Promise<void> {
  const s = slug.replace(/[^a-z0-9-]/g, "");
  const escaped = text.replace(/'/g, "'\\''");
  await executeOnServer(
    `docker exec "openclaw-${s}" npx openclaw message send --target "${to}" --message '${escaped}' 2>/dev/null || true`
  );
}
