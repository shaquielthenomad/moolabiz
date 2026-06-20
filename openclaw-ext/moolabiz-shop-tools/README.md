# @moolabiz/openclaw-shop-tools

Read-only OpenClaw tools for the **customer-facing shop agent** ({slug}-shop).
Lets a returning customer check **their own** orders over WhatsApp.

| Tool | Purpose |
|---|---|
| `my_orders` | List the orders belonging to the customer in this chat (no inputs) |
| `order_status` | Status of one of the customer's own orders, by order code |

## Why a separate plugin (not `moolabiz-tools`)

The admin tools (add/remove product, set payment key) live in `moolabiz-tools`
and load on the **owner/admin** agent only. These customer tools live here so the
**shop** agent loads *only* read-only, self-scoped tools — a customer agent can
never reach an admin/write tool. This preserves the owner-vs-customer gate from
the agent-model PR.

## Security model (the important part)

The lookup is scoped to the **trusted** WhatsApp sender, taken from OpenClaw's
`OpenClawPluginToolContext.requesterSenderId` ("Trusted sender id from inbound
context — runtime-provided, not tool args", `src/plugins/tool-types.ts`). Because
of this, the tools are built with the **factory** form (the simple `execute` form
does not receive `requesterSenderId`), and **`phone` is never a tool parameter** —
the model and the customer cannot choose whose orders to see.

Server-side, the `GET /api/vendure-bridge/customer-orders` endpoint:
- authenticates as the merchant (Bearer `apiSecret`) → scopes to the merchant's channel,
- matches the customer by phone (with SA `+27`/`0` variants),
- and **defensively filters** results to the merchant's own channel token, so a
  customer who also bought from another MoolaBiz merchant can't see those orders here.

POPIA: self-scoping (you only ever see your own orders) is what keeps this compliant.

## Install / wire-up

Add to the **shop** agent's profile config:

```jsonc
{
  "plugins": {
    "load": { "paths": ["/data/moolabiz-ext/moolabiz-shop-tools"] },
    "entries": {
      "moolabiz-shop-tools": {
        "config": { "catalogUrl": "https://moolabiz.shop/api/vendure-bridge", "apiSecret": "<merchant apiSecret>" }
      }
    }
  }
}
```

…or rely on the `CATALOG_URL` / `API_SECRET` env vars the provisioner already injects.
The shop agent should load **this** plugin; the admin agent loads `moolabiz-tools`.

## TODO (verify on a local OpenClaw build)

- Confirm `requesterSenderId` reflects the **active inbound message** when the tool
  factory runs (the type + comments imply per-conversation context; verify it is
  not a stale registration-time value). If needed, read it at execute time via the
  runtime context accessor instead of closing over it in the factory.
- Confirm the format of `requesterSenderId` for WhatsApp (JID vs E.164) and adjust
  `senderToPhone` accordingly.
- Confirm Vendure `Customer.orders` + the channel-token filter fully isolate
  per-merchant order history (the defensive filter is there either way).
- Build step / `typebox` version: same notes as `moolabiz-tools`.
