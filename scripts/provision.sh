#!/usr/bin/env bash
set -euo pipefail

# MoolaBiz Manual Provisioner — fallback for when Hub API isn't available
# Usage: ./scripts/provision.sh "Business Name" "+27123456789" "yoco"

BUSINESS_NAME="${1:?Usage: provision.sh <business-name> <whatsapp-number> <payment-provider>}"
WHATSAPP_NUMBER="${2:?Missing WhatsApp number}"
PAYMENT_PROVIDER="${3:?Missing payment provider (yoco|ozow|payfast)}"

# Generate slug
SLUG=$(echo "$BUSINESS_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')

echo "=== MoolaBiz Provisioner ==="
echo "Business:  $BUSINESS_NAME"
echo "Slug:      $SLUG"
echo "WhatsApp:  $WHATSAPP_NUMBER"
echo "Payment:   $PAYMENT_PROVIDER"
echo "Subdomain: ${SLUG}.bot.moolabiz.shop"
echo ""

# Check required env vars
: "${COOLIFY_API_URL:?Set COOLIFY_API_URL}"
: "${COOLIFY_API_TOKEN:?Set COOLIFY_API_TOKEN}"
: "${COOLIFY_PROJECT_UUID:?Set COOLIFY_PROJECT_UUID}"
: "${COOLIFY_SERVER_UUID:?Set COOLIFY_SERVER_UUID}"

echo "Creating application on Coolify..."
JSON_BODY=$(jq -n \
  --arg project "$COOLIFY_PROJECT_UUID" \
  --arg server "$COOLIFY_SERVER_UUID" \
  --arg name "bot-${SLUG}" \
  --arg desc "MoolaBiz bot for ${BUSINESS_NAME}" \
  --arg domains "https://${SLUG}.bot.moolabiz.shop" \
  '{
    project_uuid: $project,
    server_uuid: $server,
    environment_name: "production",
    type: "dockerfile",
    name: $name,
    description: $desc,
    domains: $domains,
    build_pack: "dockerfile",
    ports_exposes: "3000",
    instant_deploy: false
  }')

APP_RESPONSE=$(curl -s -X POST "${COOLIFY_API_URL}/api/v1/applications/dockerfile" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY")

APP_UUID=$(echo "$APP_RESPONSE" | jq -r '.uuid')

if [ -z "$APP_UUID" ]; then
  echo "ERROR: Failed to create application"
  echo "$APP_RESPONSE"
  exit 1
fi

echo "Created app: $APP_UUID"

echo "Setting environment variables..."
for VAR_NAME in BUSINESS_NAME BUSINESS_SLUG WHATSAPP_NUMBER PAYMENT_PROVIDER; do
  case "$VAR_NAME" in
    BUSINESS_NAME) VAL="$BUSINESS_NAME" ;;
    BUSINESS_SLUG) VAL="$SLUG" ;;
    WHATSAPP_NUMBER) VAL="$WHATSAPP_NUMBER" ;;
    PAYMENT_PROVIDER) VAL="$PAYMENT_PROVIDER" ;;
  esac

  ENV_JSON=$(jq -n \
    --arg key "$VAR_NAME" \
    --arg value "$VAL" \
    '{key: $key, value: $value, is_build_time: false}')

  curl -s -X POST "${COOLIFY_API_URL}/api/v1/applications/${APP_UUID}/envs" \
    -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$ENV_JSON" > /dev/null
done

echo "Triggering deployment..."
curl -s -X POST "${COOLIFY_API_URL}/api/v1/applications/${APP_UUID}/deploy" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" > /dev/null

echo ""
echo "=== Done! ==="
echo "Bot will be live at: https://${SLUG}.bot.moolabiz.shop"
echo "Coolify app UUID: $APP_UUID"
