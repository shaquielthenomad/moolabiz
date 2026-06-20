# MoolaBiz agent model — owner vs customer, natural-language admin

Encodes the product flow: **type → scan → login → shop is live**, then the owner
manages by **natural language**, and anyone the bot doesn't recognise is treated
as a **customer**.

## How owner-vs-customer is enforced (verified against OpenClaw source)

OpenClaw has **no built-in "admin number"** concept — the `adminNumbers` key in the
old `scripts/deploy-openclaw.sh` is never read by OpenClaw and should be removed.
Instead we use OpenClaw's **agent route bindings**, which can match a specific peer:

```
AgentBindingMatch = { channel, accountId?, peer?: { kind, id }, ... }   // src/config/types.agents.ts
```

Each merchant profile gets **two agents**:

| Agent | Persona | Tools | Bound to |
|---|---|---|---|
| `{slug}-admin` | `admin.SOUL.md` | `moolabiz-tools` (catalog / orders / payment key) | the **owner's** number (`match.peer.id` = owner JID) |
| `{slug}-shop` | `shop.SOUL.md` | **none** (browse / order only) | **everything else** on the channel (default / catch-all) |

Because the customer agent **has no admin tools**, a customer cannot perform admin
actions even if they claim to be the owner — the gate is **structural** (routing +
per-agent tools), not persona text. The personas add defence-in-depth.

This is the **same `agents.list[]` + `bindings` machinery as multi-agent packing**,
so the generator that emits these is built together with that PR.

### Per-merchant config shape (emitted by the provisioner)

```jsonc
{
  "agents": { "list": [
    { "id": "{slug}-admin", "workspace": "/root/.openclaw/workspace-{slug}-admin", "tools": { /* enable moolabiz-tools */ } },
    { "id": "{slug}-shop",  "workspace": "/root/.openclaw/workspace-{slug}-shop",  "tools": { /* no admin tools */ } }
  ]},
  "bindings": [
    { "agentId": "{slug}-admin", "match": { "channel": "whatsapp", "accountId": "{slug}", "peer": { "kind": "dm", "id": "<OWNER_PHONE JID>" } } },
    { "agentId": "{slug}-shop",  "match": { "channel": "whatsapp", "accountId": "{slug}" } }
  ]
}
```

Most-specific binding wins → the owner's DM hits `-admin`; everyone else falls
through to `-shop`. Render `admin.SOUL.md` into the `-admin` workspace and
`shop.SOUL.md` into the `-shop` workspace (these use the same `{{VAR}}`
placeholders the provisioner already fills).

## Replaces

The single-agent + slash-command `moolabiz-catalog` SKILL.md generated in
`scripts/openclaw-provisioner.mjs`. Natural-language admin now comes from the
`admin.SOUL.md` persona + the typed `moolabiz-tools` plugin (PR #2) — no `/commands`.

## TODO (verify against a local OpenClaw build)

- Exact `ChatType` value for a WhatsApp direct chat (`peer.kind`).
- Binding precedence — confirm the resolver picks the most specific match (peer over channel-default).
- The per-agent tool-enable field name in `AgentConfig` (so `moolabiz-tools` is on `-admin` only).
- Owner reaches the bot from their **own** number while the shop runs on the **linked (ideally dedicated) business number** — matches the dedicated-SIM hygiene.
- Remove the dead `adminNumbers` line from `scripts/deploy-openclaw.sh`.
