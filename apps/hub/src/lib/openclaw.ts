/**
 * OpenClaw provisioning — each merchant gets their own OpenClaw instance
 * running `openclaw gateway` with a unique --profile for isolation.
 *
 * Deployed via the openclaw-provisioner service (a lightweight Node.js
 * HTTP server with Docker socket access) instead of Coolify's server
 * command API which doesn't exist in our Coolify version.
 */

const PROVISIONER_URL =
  process.env.OPENCLAW_PROVISIONER_URL || "http://openclaw-provisioner:9999";
const PROVISIONER_KEY =
  process.env.OPENCLAW_PROVISIONER_KEY || "moolabiz-provision-key";

async function provisionerRequest(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const res = await fetch(`${PROVISIONER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-key": PROVISIONER_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[openclaw] Provisioner ${path} failed (${res.status}):`, text);
    throw new Error(`Provisioner ${path} failed: HTTP ${res.status}`);
  }

  return res;
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
  console.log(`[openclaw] Deploying for ${opts.slug}...`);

  const res = await provisionerRequest("/deploy", {
    slug: opts.slug,
    businessName: opts.businessName,
    ownerPhone: opts.ownerPhone,
  });

  const data = (await res.json()) as { containerId: string };
  console.log(`[openclaw] Deployed: ${opts.slug} (${data.containerId})`);
  return { containerId: data.containerId };
}

export async function stopOpenClaw(slug: string): Promise<void> {
  await provisionerRequest("/stop", { slug });
}

export async function startOpenClaw(slug: string): Promise<void> {
  await provisionerRequest("/start", { slug });
}

export async function removeOpenClaw(slug: string): Promise<void> {
  await provisionerRequest("/remove", { slug });
}

export async function getOpenClawStatus(
  slug: string
): Promise<{ state: string }> {
  const res = await provisionerRequest("/status", { slug });
  return (await res.json()) as { state: string };
}
