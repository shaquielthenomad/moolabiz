#!/usr/bin/env bash
set -euo pipefail

# MoolaBiz OpenClaw Deployer
# Usage: ./scripts/deploy-openclaw.sh <slug> <business-name> <owner-phone> <payment-provider> [ollama-url]
#
# This script is called by the hub's Coolify API integration, but can also be
# run manually on the server for debugging.

SLUG="${1:?Usage: deploy-openclaw.sh <slug> <business-name> <owner-phone> <payment-provider> [ollama-url]}"
BUSINESS_NAME="${2:?Missing business name}"
OWNER_PHONE="${3:?Missing owner phone}"
PAYMENT_PROVIDER="${4:?Missing payment provider}"
OLLAMA_URL="${5:-http://ollama-shared:11434}"
CATALOG_URL="https://${SLUG}.bot.moolabiz.shop"

CONFIG_DIR="/data/openclaw/${SLUG}"

echo "=== MoolaBiz OpenClaw Deployer ==="
echo "Slug:       ${SLUG}"
echo "Business:   ${BUSINESS_NAME}"
echo "Phone:      ${OWNER_PHONE}"
echo "Payment:    ${PAYMENT_PROVIDER}"
echo "Ollama:     ${OLLAMA_URL}"
echo "Catalog:    ${CATALOG_URL}"
echo ""

# ── Create config directories ────────────────────────────────────────────────
mkdir -p "${CONFIG_DIR}/workspace"
mkdir -p "${CONFIG_DIR}/session"

# ── Generate openclaw.json ───────────────────────────────────────────────────
cat > "${CONFIG_DIR}/openclaw.json" << EOF
{
  "agents": {
    "defaults": {
      "workspace": "/home/openclaw/.openclaw/workspace",
      "model": "ollama/llama3.2:1b"
    }
  },
  "gateway": {
    "port": 18789,
    "bind": "0.0.0.0"
  },
  "channels": {
    "whatsapp": {
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "web": { "enabled": true },
      "adminNumbers": ["${OWNER_PHONE}"]
    }
  },
  "ollama": {
    "baseUrl": "${OLLAMA_URL}"
  }
}
EOF

echo "Generated: ${CONFIG_DIR}/openclaw.json"

# ── Generate SOUL.md ─────────────────────────────────────────────────────────
cat > "${CONFIG_DIR}/workspace/SOUL.md" << EOF
# SOUL — MoolaBiz Shop Bot

## Identity
You are a friendly, helpful WhatsApp shop assistant for ${BUSINESS_NAME}.
You help the shop owner manage their web catalog, track orders, and grow their business.

## Personality
- Warm, friendly, and patient
- You speak simply — no jargon, no complicated words
- You use the customer's language (Zulu, Xhosa, Afrikaans, Sesotho, or English)
- You're like a friendly shop worker who knows every customer by name

## Rules
1. You don't need to announce you're a digital assistant, but if a customer asks directly, be honest: "I'm the shop's digital assistant — here to help you 24/7!"
2. ALWAYS greet customers warmly
3. Keep messages SHORT — most customers are on data budgets
4. Maximum one emoji per message.
5. If you don't understand, ask politely — never guess
6. NEVER discuss politics, religion, or controversial topics
7. ALWAYS confirm orders before processing payment
8. If you cannot resolve a customer's issue (refund, complaint, missing order), say: "Let me connect you with ${BUSINESS_NAME} directly" and share the owner's WhatsApp number.

## Sending Customers to Your Shop
When a customer wants to browse or buy, send them your shop link:
${CATALOG_URL}

## Business Details
- Name: ${BUSINESS_NAME}
- WhatsApp: ${OWNER_PHONE}
- Payment: ${PAYMENT_PROVIDER}
- Shop: ${CATALOG_URL}
EOF

echo "Generated: ${CONFIG_DIR}/workspace/SOUL.md"

# ── Stop and remove existing container if present ────────────────────────────
docker rm -f "openclaw-${SLUG}" 2>/dev/null || true

# ── Run OpenClaw container ───────────────────────────────────────────────────
echo ""
echo "Starting OpenClaw container..."

CONTAINER_ID=$(docker run -d \
  --name "openclaw-${SLUG}" \
  --network coolify \
  --restart unless-stopped \
  --memory 512m \
  --cpus 0.5 \
  -v "${CONFIG_DIR}:/home/openclaw/.openclaw" \
  -e OLLAMA_BASE_URL="${OLLAMA_URL}" \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.openclaw-${SLUG}.rule=Host(\`${SLUG}.bot.moolabiz.shop\`) && PathPrefix(\`/onboard\`)" \
  -l "traefik.http.routers.openclaw-${SLUG}.entrypoints=https" \
  -l "traefik.http.routers.openclaw-${SLUG}.tls.certresolver=letsencrypt" \
  -l "traefik.http.routers.openclaw-${SLUG}.tls=true" \
  -l "traefik.http.services.openclaw-${SLUG}.loadbalancer.server.port=18789" \
  -l "traefik.http.routers.openclaw-${SLUG}.priority=100" \
  -l "coolify.managed=true" \
  -l "moolabiz.slug=${SLUG}" \
  -l "moolabiz.service=openclaw" \
  node:20-slim sh -c "npx -y openclaw gateway")

echo ""
echo "=== Done! ==="
echo "Container ID: ${CONTAINER_ID}"
echo "QR onboard:   https://${SLUG}.bot.moolabiz.shop/onboard"
echo "CONTAINER_ID=${CONTAINER_ID}"
