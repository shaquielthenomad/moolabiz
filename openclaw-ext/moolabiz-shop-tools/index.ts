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
// Config resolution: plugins.entries["moolabiz-shop-tools"].config -> { catalogUrl, apiSecret }
//                    or the CATALOG_URL / API_SECRET env vars (provisioner injects these).

import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
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

function resolveCfg(config: ToolConfig): { catalogUrl: string; apiSecret: string } {
  const catalogUrl = (config.catalogUrl || process.env.CATALOG_URL || "").replace(/\/+$/, "");
  const apiSecret = config.apiSecret || process.env.API_SECRET || "";
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
  config: ToolConfig,
  phone: string,
): Promise<{ customer: { name: string | null } | null; orders: SimpleOrder[] }> {
  const { catalogUrl, apiSecret } = resolveCfg(config);
  if (!catalogUrl || !apiSecret) {
    throw new Error("moolabiz-shop-tools: missing catalogUrl/apiSecret (config or CATALOG_URL/API_SECRET env)");
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
      // Factory form: gives access to the trusted requesterSenderId from the runtime.
      factory: ({ config, toolContext }) => {
        const phone = senderToPhone(toolContext.requesterSenderId);
        const cfg = config as ToolConfig;
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
            const data = await fetchOwnOrders(cfg, phone);
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
            const data = await fetchOwnOrders(cfg, phone);
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
