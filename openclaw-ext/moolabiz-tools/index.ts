// MoolaBiz Tools — typed OpenClaw tools that let a merchant's AI agent manage
// its catalog, orders, and payment settings via the MoolaBiz Vendure bridge.
//
// Replaces the old SKILL.md + `curl` + exec-approval flow with type-safe tools.
//
// Credential resolution order (per merchant):
//   1. {toolContext.workspaceDir}/moolabiz.json -> { catalogUrl, apiSecret }
//        Written per-agent by the packing provisioner so each merchant's admin
//        agent reads ITS OWN secret in a shared (packed) profile.
//   2. plugin config  -> plugins.entries["moolabiz-tools"].config
//   3. env vars       -> CATALOG_URL / API_SECRET  (single-container deployments)
//
// SECURITY (packed mode): when MOOLABIZ_PACKED is set, the per-agent workspace
// file is REQUIRED — we never fall back to a shared config/env secret, because in
// a multi-merchant process that would act as a DIFFERENT merchant (cross-tenant).

import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { readFileSync } from "node:fs";
import { Type } from "typebox";

type ToolConfig = { catalogUrl?: string; apiSecret?: string };

function isPackedMode(): boolean {
  const v = process.env.MOOLABIZ_PACKED;
  return v === "1" || v === "true";
}

function readAgentCredFile(workspaceDir: string | undefined): Partial<ToolConfig> {
  if (!workspaceDir) return {};
  try {
    return JSON.parse(readFileSync(`${workspaceDir}/moolabiz.json`, "utf8")) as Partial<ToolConfig>;
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err; // malformed JSON / permissions — surface it
  }
}

function resolve(
  workspaceDir: string | undefined,
  config: ToolConfig,
): { catalogUrl: string; apiSecret: string } {
  const fileCreds = readAgentCredFile(workspaceDir);
  // Packed multi-merchant process: refuse to fall back to a shared secret.
  if (isPackedMode() && (!fileCreds.apiSecret || !fileCreds.catalogUrl)) {
    throw new Error(
      "moolabiz-tools: packed mode requires per-agent {workspaceDir}/moolabiz.json; " +
        "refusing shared config/env fallback (cross-merchant safety).",
    );
  }
  const catalogUrl = (
    fileCreds.catalogUrl || config.catalogUrl || process.env.CATALOG_URL || ""
  ).replace(/\/+$/, "");
  const apiSecret = fileCreds.apiSecret || config.apiSecret || process.env.API_SECRET || "";
  if (!catalogUrl || !apiSecret) {
    throw new Error(
      "moolabiz-tools: missing catalogUrl/apiSecret — set {workspaceDir}/moolabiz.json, " +
        "plugins.entries.moolabiz-tools.config, or CATALOG_URL/API_SECRET env",
    );
  }
  return { catalogUrl, apiSecret };
}

async function bridge(
  workspaceDir: string | undefined,
  config: ToolConfig,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const { catalogUrl, apiSecret } = resolve(workspaceDir, config);
  const res = await fetch(`${catalogUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiSecret}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const raw = await res.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Wrap a plain string into the AgentToolResult shape the factory path requires. */
function text(t: string) {
  return { content: [{ type: "text", text: t }], details: undefined as unknown };
}

const randsToCents = (r: number): number => Math.round(r * 100);
const centsToRands = (c: number): string => (c / 100).toFixed(2);

/**
 * Define a factory-form tool from one metadata block + a run() that returns a
 * string (auto-wrapped) or a full AgentToolResult. Single source of truth for
 * name/label/description/parameters (no static/factory duplication), and every
 * result is wrapped — the factory path does NOT auto-wrap bare strings.
 */
type ToolMeta = { name: string; label: string; description: string; parameters: unknown };
function makeTool(
  tool: (def: unknown) => unknown,
  meta: ToolMeta,
  run: (
    params: Record<string, unknown>,
    ctx: { workspaceDir: string | undefined; config: ToolConfig },
  ) => Promise<string | { content: unknown[]; details: unknown }>,
) {
  return tool({
    ...meta,
    factory: ({ config, toolContext }: { config: unknown; toolContext: { workspaceDir?: string } }) => ({
      ...meta,
      async execute(_toolCallId: string, params: Record<string, unknown> = {}) {
        const out = await run(params ?? {}, {
          workspaceDir: toolContext.workspaceDir,
          config: config as ToolConfig,
        });
        return typeof out === "string" ? text(out) : out;
      },
    }),
  });
}

export default defineToolPlugin({
  id: "moolabiz-tools",
  name: "MoolaBiz Tools",
  description:
    "Manage the merchant's MoolaBiz shop — products, orders, and payment settings — via the Vendure bridge API.",
  configSchema: Type.Object(
    {
      catalogUrl: Type.Optional(Type.String({ description: "Vendure bridge base URL" })),
      apiSecret: Type.Optional(Type.String({ description: "Merchant bridge Bearer token" })),
    },
    { additionalProperties: false },
  ),
  tools: (tool) => [
    makeTool(
      tool,
      {
        name: "moolabiz_list_products",
        label: "List products",
        description: "List all products in the merchant's catalog, with prices in Rands and ids.",
        parameters: Type.Object({}),
      },
      async (_params, { workspaceDir, config }) => {
        const products = (await bridge(workspaceDir, config, "/products")) as Array<{
          id: string;
          name: string;
          price: number;
          inStock: boolean;
        }>;
        if (!products.length) return "Your catalog is empty. Add a product to get started.";
        return products
          .map((p) => `• ${p.name} — R${centsToRands(p.price)}${p.inStock ? "" : " (out of stock)"} [id:${p.id}]`)
          .join("\n");
      },
    ),
    makeTool(
      tool,
      {
        name: "moolabiz_add_product",
        label: "Add product",
        description: "Add a product to the catalog. Price is in Rands (e.g. 45.50 = R45.50).",
        parameters: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 120 }),
          priceRands: Type.Number({ minimum: 0 }),
          description: Type.Optional(Type.String({ maxLength: 1000 })),
          category: Type.Optional(Type.String({ maxLength: 80 })),
        }),
      },
      async (params, { workspaceDir, config }) => {
        const created = (await bridge(workspaceDir, config, "/products", {
          method: "POST",
          body: {
            name: params.name,
            price: randsToCents(params.priceRands as number),
            description: params.description,
            category: params.category,
          },
        })) as { name: string; price: number };
        return `Added ${created.name} at R${centsToRands(created.price)} to your catalog.`;
      },
    ),
    makeTool(
      tool,
      {
        name: "moolabiz_remove_product",
        label: "Remove product",
        description: "Remove a product by its id (use moolabiz_list_products to find the id).",
        parameters: Type.Object({ productId: Type.String({ minLength: 1 }) }),
      },
      async (params, { workspaceDir, config }) => {
        await bridge(workspaceDir, config, `/products/${encodeURIComponent(String(params.productId))}`, {
          method: "DELETE",
        });
        return `Removed product ${params.productId} from your catalog.`;
      },
    ),
    makeTool(
      tool,
      {
        name: "moolabiz_list_orders",
        label: "List orders",
        description: "List recent orders for the merchant's shop, with an optional state filter.",
        parameters: Type.Object({ state: Type.Optional(Type.String()) }),
      },
      async (params, { workspaceDir, config }) => {
        const q = params.state ? `?state=${encodeURIComponent(String(params.state))}` : "";
        const data = (await bridge(workspaceDir, config, `/orders${q}`)) as {
          total: number;
          orders: Array<{ code: string; status: string; total: number; customerName: string }>;
        };
        if (!data.orders?.length) return "No orders yet.";
        const lines = data.orders
          .map((o) => `• ${o.code} — ${o.customerName} — R${centsToRands(o.total)} — ${o.status}`)
          .join("\n");
        return `${data.total} order(s):\n${lines}`;
      },
    ),
    makeTool(
      tool,
      {
        name: "moolabiz_set_payment_key",
        label: "Set payment key",
        description:
          "Save the merchant's own payment-provider secret key (Yoco/Ozow/PayFast) so customers can pay them directly. Stored encrypted.",
        parameters: Type.Object({ key: Type.String({ minLength: 6, maxLength: 200 }) }),
      },
      async (params, { workspaceDir, config }) => {
        await bridge(workspaceDir, config, "/settings", {
          method: "POST",
          body: { paymentSecretKey: params.key },
        });
        return "Payment key saved securely. Your customers can now pay you directly.";
      },
    ),
  ],
});
