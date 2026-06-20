# @moolabiz/openclaw-tools

Typed OpenClaw tool plugin that lets a merchant's AI agent manage its MoolaBiz
shop by calling the Vendure bridge API directly.

It **replaces** the previously generated `moolabiz-catalog` SKILL.md (which made
the model run `curl` under an exec-approval allowlist). Benefits:

- **Type-safe** inputs (TypeBox) and validated Rand→cents conversion.
- **No shell / no exec-approval** surface — removes a prompt-injection + command-injection risk.
- **API secret never appears** in a model-visible command.
- Lower latency (one direct `fetch`, no skill-read + shell round trip).

## Tools

| Tool | Purpose |
|---|---|
| `moolabiz_list_products` | List catalog products (price in Rands, with ids) |
| `moolabiz_add_product` | Add a product (`name`, `priceRands`, optional `description`/`category`) |
| `moolabiz_remove_product` | Remove a product by `productId` |
| `moolabiz_list_orders` | List recent orders (optional `state` filter) |
| `moolabiz_set_payment_key` | Save the merchant's own PSP secret key (stored encrypted by the hub) |

## Install / wire-up

1. Make this directory visible to OpenClaw via the merchant profile config:

   ```jsonc
   {
     "plugins": {
       "load": { "paths": ["/data/moolabiz-ext/moolabiz-tools"] },
       "entries": {
         "moolabiz-tools": {
           "config": {
             "catalogUrl": "https://moolabiz.shop/api/vendure-bridge",
             "apiSecret": "<merchant apiSecret>"
           }
         }
       }
     }
   }
   ```

   Or rely on the **`CATALOG_URL` / `API_SECRET` env vars** — the current
   `openclaw-provisioner.mjs` already injects both into each container, so the
   plugin works with zero extra config in today's one-container-per-merchant setup.

2. In `scripts/openclaw-provisioner.mjs`, once this plugin is enabled you can
   **delete the generated `moolabiz-catalog` SKILL.md block** and its
   `exec-approvals.json` curl allowlist — they're no longer needed.

## Multi-tenant note (PR2 — multi-agent packing)

Plugin config lives under `plugins.entries` and is **per-profile, not per-agent**.
When many merchant agents share one profile (the multi-agent packing model),
resolve the per-merchant `apiSecret` per-agent instead of from global config —
e.g. inject `API_SECRET` per agent, or convert these tools to the `factory(...)`
form and read the current agent's identity from `toolContext` to look up the
secret. Until then, this plugin is correct for one-merchant-per-profile.

## TODOs (need a local OpenClaw build to finalise)

- **Build/loader:** confirm whether the pinned `moolabiz/openclaw` image loads a
  `.ts` plugin directly or expects compiled JS; if the latter, add a `tsdown`/`tsc`
  build emitting `dist/index.js` and point `main`/exports at it.
- **`typebox` version:** pin to the exact version the pinned OpenClaw image ships
  (it re-exports `typebox`); `*` is a placeholder.
- **SDK subpath:** verify `openclaw/plugin-sdk/tool-plugin` resolves in the pinned
  image (confirmed present in openclaw@2026.6.8 exports).
- **DELETE route:** confirm `DELETE /api/vendure-bridge/products/{id}` exists and
  is the right shape (the old skill used it).
- Run `openclaw plugins doctor` / `openclaw plugins validate` after install.
