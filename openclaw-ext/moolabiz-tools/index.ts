// MoolaBiz Tools — typed OpenClaw tools that let a merchant's AI agent manage
// its catalog, orders, and payment settings by calling the MoolaBiz Vendure
// bridge API directly.
//
// Replaces the old generated `moolabiz-catalog` SKILL.md + `curl` + exec-approval
// flow with type-safe tools: validated inputs, no shell, no exec approval, lower
// latency, and the API secret never appears in a model-visible command.
//
// Config resolution order (per merchant):
//   1. plugin config  -> plugins.entries["moolabiz-tools"].config = { catalogUrl, apiSecret }
//   2. env vars       -> CATALOG_URL / API_SECRET  (the current provisioner already injects these)
//
// MULTI-TENANT NOTE (PR2 multi-agent packing): plugin config is per-profile, not
// per-agent. When many merchants share one profile, resolve the per-merchant
// apiSecret from the agent context/env instead of global config (see README).

import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type } from "typebox";

type ToolConfig = { catalogUrl?: string; apiSecret?: string };

function resolve(config: ToolConfig): { catalogUrl: string; apiSecret: string } {
  const catalogUrl = config.catalogUrl || process.env.CATALOG_URL || "";
  const apiSecret = config.apiSecret || process.env.API_SECRET || "";
  if (!catalogUrl || !apiSecret) {
    throw new Error(
      "moolabiz-tools: missing catalogUrl/apiSecret — set plugins.entries.moolabiz-tools.config or the CATALOG_URL/API_SECRET env vars",
    );
  }
  return { catalogUrl: catalogUrl.replace(/\/+$/, ""), apiSecret };
}

async function bridge(
  config: ToolConfig,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const { catalogUrl, apiSecret } = resolve(config);
  const res = await fetch(`${catalogUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiSecret}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
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

const randsToCents = (rands: number): number => Math.round(rands * 100);
const centsToRands = (cents: number): string => (cents / 100).toFixed(2);

export default defineToolPlugin({
  id: "moolabiz-tools",
  name: "MoolaBiz Tools",
  description:
    "Manage the merchant's MoolaBiz shop — products, orders, and payment settings — via the Vendure bridge API.",
  configSchema: Type.Object(
    {
      catalogUrl: Type.Optional(
        Type.String({
          description: "Vendure bridge base URL, e.g. https://moolabiz.shop/api/vendure-bridge",
        }),
      ),
      apiSecret: Type.Optional(
        Type.String({ description: "Merchant bridge Bearer token (apiSecret)" }),
      ),
    },
    { additionalProperties: false },
  ),
  tools: (tool) => [
    tool({
      name: "moolabiz_list_products",
      label: "List products",
      description: "List all products in the merchant's catalog, with prices in Rands and product ids.",
      parameters: Type.Object({}),
      async execute(_params, config) {
        const products = (await bridge(config, "/products")) as Array<{
          id: string;
          name: string;
          price: number;
          inStock: boolean;
        }>;
        if (!products.length) return "Your catalog is empty. Add a product to get started.";
        return products
          .map(
            (p) =>
              `• ${p.name} — R${centsToRands(p.price)}${p.inStock ? "" : " (out of stock)"} [id:${p.id}]`,
          )
          .join("\n");
      },
    }),
    tool({
      name: "moolabiz_add_product",
      label: "Add product",
      description: "Add a product to the catalog. Price is in Rands (e.g. 45.50 means R45.50).",
      parameters: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 120 }),
        priceRands: Type.Number({ minimum: 0 }),
        description: Type.Optional(Type.String({ maxLength: 1000 })),
        category: Type.Optional(Type.String({ maxLength: 80 })),
      }),
      async execute(params, config) {
        const created = (await bridge(config, "/products", {
          method: "POST",
          body: {
            name: params.name,
            price: randsToCents(params.priceRands),
            description: params.description,
            category: params.category,
          },
        })) as { name: string; price: number };
        return `Added ${created.name} at R${centsToRands(created.price)} to your catalog.`;
      },
    }),
    tool({
      name: "moolabiz_remove_product",
      label: "Remove product",
      description:
        "Remove a product from the catalog by its id. Use moolabiz_list_products first to find the id.",
      parameters: Type.Object({ productId: Type.String({ minLength: 1 }) }),
      async execute(params, config) {
        await bridge(config, `/products/${encodeURIComponent(params.productId)}`, {
          method: "DELETE",
        });
        return `Removed product ${params.productId} from your catalog.`;
      },
    }),
    tool({
      name: "moolabiz_list_orders",
      label: "List orders",
      description: "List recent orders for the merchant's shop, with an optional state filter.",
      parameters: Type.Object({
        state: Type.Optional(
          Type.String({ description: "Optional Vendure state filter, e.g. PaymentSettled" }),
        ),
      }),
      async execute(params, config) {
        const q = params.state ? `?state=${encodeURIComponent(params.state)}` : "";
        const data = (await bridge(config, `/orders${q}`)) as {
          total: number;
          orders: Array<{
            code: string;
            status: string;
            total: number;
            customerName: string;
          }>;
        };
        if (!data.orders?.length) return "No orders yet.";
        const lines = data.orders
          .map((o) => `• ${o.code} — ${o.customerName} — R${centsToRands(o.total)} — ${o.status}`)
          .join("\n");
        return `${data.total} order(s):\n${lines}`;
      },
    }),
    tool({
      name: "moolabiz_set_payment_key",
      label: "Set payment key",
      description:
        "Save the merchant's own payment-provider secret key (Yoco/Ozow/PayFast) so their customers can pay them directly. Stored encrypted by the hub.",
      parameters: Type.Object({ key: Type.String({ minLength: 6, maxLength: 200 }) }),
      async execute(params, config) {
        await bridge(config, "/settings", {
          method: "POST",
          body: { paymentSecretKey: params.key },
        });
        return "Payment key saved securely. Your customers can now pay you directly.";
      },
    }),
  ],
});
