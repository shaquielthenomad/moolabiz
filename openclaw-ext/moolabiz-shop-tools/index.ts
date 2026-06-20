// MoolaBiz Shop Tools — READ-ONLY tools for the customer-facing shop agent.
//
// Lets a returning customer check THEIR OWN orders over WhatsApp. The lookup is
// scoped to the **trusted** WhatsApp sender (OpenClaw's `requesterSenderId`,
// "runtime-provided, not tool args") — the customer/model can never pass a
// different number, so no one can read someone else's orders.
//
// These tools are deliberately in a SEPARATE plugin from the admin
// `moolabiz-tools`: the shop agent loads only this one, so a customer agent can
// never reach catalog/payment-key write tools.
//
// Config resolution order (per merchant):
//   1. {toolContext.workspaceDir}/moolabiz.json  -> { catalogUrl, apiSecret }
//        Written per-agent by the multi-agent packing provisioner so that every
//        merchant's shop agent resolves ITS OWN secret in a shared profile.
//   2. plugin config  -> plugins.entries["moolabiz-shop-tools"].config = { catalogUrl, apiSecret }
//   3. env vars       -> CATALOG_URL / API_SECRET  (the current provisioner already injects these)

import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { readFileSync } from "node:fs";
import { Type } from "typebox";

type ToolConfig = { catalogUrl?: string; apiSecret?: string };

interface SimpleOrder {
  code: string;
  status: string;
  total: number; // cents
  currency: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
}

/**
 * Read per-agent credentials from {workspaceDir}/moolabiz.json if present.
 * Missing file is fine (single-merchant / env-var deployments won't have it).
 * Malformed JSON is surfaced so misconfigurations aren't silently swallowed.
 */
function readAgentCredFile(workspaceDir: string | undefined): Partial<ToolConfig> {
  if (!workspaceDir) return {};
  try {
    const raw = readFileSync(`${workspaceDir}/moolabiz.json`, "utf8");
    return JSON.parse(raw) as Partial<ToolConfig>;
  } catch (err: unknown) {
    // ENOENT: file simply isn't there (non-packed deployment) — that's fine.
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") return {};
    // Any other error (malformed JSON, permissions) — re-throw so the operator sees it.
    throw err;
  }
}

function resolveCfg(
  workspaceDir: string | undefined,
  config: ToolConfig,
): { catalogUrl: string; apiSecret: string } {
  const fileCreds = readAgentCredFile(workspaceDir);
  // Packed multi-merchant process: never fall back to a shared config/env secret,
  // which would read as a DIFFERENT merchant. [red-team H3]
  if (
    (process.env.MOOLABIZ_PACKED === "1" || process.env.MOOLABIZ_PACKED === "true") &&
    (!fileCreds.apiSecret || !fileCreds.catalogUrl)
  ) {
    throw new Error(
      "moolabiz-shop-tools: packed mode requires per-agent {workspaceDir}/moolabiz.json (cross-merchant safety).",
    );
  }
  const catalogUrl = (
    fileCreds.catalogUrl || config.catalogUrl || process.env.CATALOG_URL || ""
  ).replace(/\/+$/, "");
  const apiSecret = fileCreds.apiSecret || config.apiSecret || process.env.API_SECRET || "";
  return { catalogUrl, apiSecret };
}

/** Normalize OpenClaw's trusted sender id (JID or E.164) to a phone string. */
function senderToPhone(senderId: string | undefined): string {
  if (!senderId) return "";
  const digits = senderId.split("@")[0].replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

const rands = (cents: number): string => (cents / 100).toFixed(2);

async function fetchOwnOrders(
  workspaceDir: string | undefined,
  config: ToolConfig,
  phone: string,
): Promise<{ customer: { name: string | null } | null; orders: SimpleOrder[] }> {
  const { catalogUrl, apiSecret } = resolveCfg(workspaceDir, config);
  if (!catalogUrl || !apiSecret) {
    throw new Error("moolabiz-shop-tools: missing catalogUrl/apiSecret (workspaceDir/moolabiz.json, config, or CATALOG_URL/API_SECRET env)");
  }
  const res = await fetch(`${catalogUrl}/customer-orders?phone=${encodeURIComponent(phone)}`, {
    headers: { Authorization: `Bearer ${apiSecret}` },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

function text(t: string) {
  return { content: [{ type: "text", text: t }], details: undefined as unknown };
}

export default defineToolPlugin({
  id: "moolabiz-shop-tools",
  name: "MoolaBiz Shop Tools",
  description:
    "Read-only tools for the shop assistant to show the CURRENT customer their own orders. Scoped to the verified WhatsApp sender — never a number supplied in chat.",
  configSchema: Type.Object(
    {
      catalogUrl: Type.Optional(Type.String()),
      apiSecret: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  tools: (tool) => [
    tool({
      name: "my_orders",
      label: "My orders",
      description:
        "Show the orders belonging to the customer in THIS chat. Takes no inputs — it always uses the customer's own verified WhatsApp number.",
      parameters: Type.Object({}),
      // Factory form: gives access to the trusted requesterSenderId and workspaceDir from the runtime.
      factory: ({ config, toolContext }) => {
        const phone = senderToPhone(toolContext.requesterSenderId);
        const cfg = config as ToolConfig;
        const workspaceDir = toolContext.workspaceDir;
        return {
          name: "my_orders",
          label: "My orders",
          description:
            "Show the orders belonging to the customer in this chat (their own verified number).",
          parameters: Type.Object({}),
          async execute(_toolCallId: string) {
            if (!phone) {
              return text("I can't verify your number in this chat, so I can't look up your orders.");
            }
            const data = await fetchOwnOrders(workspaceDir, cfg, phone);
            if (!data.orders?.length) {
              return text("I couldn't find any orders linked to your number yet.");
            }
            const who = data.customer?.name ? `${data.customer.name}, here` : "Here";
            const lines = data.orders
              .map((o) => `• ${o.code} — R${rands(o.total)} — ${o.status}`)
              .join("\n");
            return { content: [{ type: "text", text: `${who} are your recent orders:\n${lines}` }], details: data };
          },
        };
      },
    }),
    tool({
      name: "order_status",
      label: "Order status",
      description:
        "Check the status of one of the customer's own orders by its order code. Only returns an order that belongs to this customer's verified number.",
      parameters: Type.Object({ orderCode: Type.String({ minLength: 1 }) }),
      factory: ({ config, toolContext }) => {
        const phone = senderToPhone(toolContext.requesterSenderId);
        const cfg = config as ToolConfig;
        const workspaceDir = toolContext.workspaceDir;
        return {
          name: "order_status",
          label: "Order status",
          description: "Check the status of one of the customer's own orders by its order code.",
          parameters: Type.Object({ orderCode: Type.String({ minLength: 1 }) }),
          async execute(_toolCallId: string, params: { orderCode?: unknown }) {
            const code = typeof params?.orderCode === "string" ? params.orderCode.trim() : "";
            if (!phone) {
              return text("I can't verify your number in this chat, so I can't check that order.");
            }
            if (!code) {
              return text("Which order? Send me the order code (e.g. MB-1234).");
            }
            const data = await fetchOwnOrders(workspaceDir, cfg, phone);
            const match = (data.orders || []).find((o) => o.code.toLowerCase() === code.toLowerCase());
            if (!match) {
              return text(`I couldn't find order ${code} on your number. Double-check the code?`);
            }
            const items = (match.items || []).map((i) => `${i.quantity}x ${i.name}`).join(", ");
            return {
              content: [
                {
                  type: "text",
                  text: `Order ${match.code}: ${match.status} — R${rands(match.total)}${items ? ` (${items})` : ""}.`,
                },
              ],
              details: match,
            };
          },
        };
      },
    }),
  ],
});
