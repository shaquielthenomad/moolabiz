#!/usr/bin/env bash
set -euo pipefail

# MoolaBiz Manual Provisioner — fallback for when Hub API isn't available
# Usage: ./scripts/provision.sh [--dry-run] <business-name> <whatsapp-number> <payment-provider>

# ── Parse flags ───────────────────────────────────────────────────────────────
DRY_RUN=false
POSITIONAL=()

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      POSITIONAL+=("$arg")
      ;;
  esac
done

# Restore positional args
set -- "${POSITIONAL[@]:-}"

BUSINESS_NAME="${1:?Usage: provision.sh [--dry-run] <business-name> <whatsapp-number> <payment-provider>}"
WHATSAPP_NUMBER="${2:?Missing WhatsApp number}"
PAYMENT_PROVIDER="${3:?Missing payment provider (yoco|ozow|payfast)}"

# ── Generate slug ─────────────────────────────────────────────────────────────
SLUG=$(echo "$BUSINESS_NAME" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9]/-/g' \
  | sed 's/--*/-/g' \
  | sed 's/^-\|-$//g')

echo "=== MoolaBiz Provisioner ==="
echo "Business:  $BUSINESS_NAME"
echo "Slug:      $SLUG"
echo "WhatsApp:  $WHATSAPP_NUMBER"
echo "Payment:   $PAYMENT_PROVIDER"
echo "Subdomain: ${SLUG}.bot.moolabiz.shop"
if $DRY_RUN; then
  echo ""
  echo "[dry-run] DRY RUN MODE — no Coolify API calls will be made."
fi
echo ""

# ── Validate required env vars (even for dry-run so we can surface issues early)
: "${COOLIFY_API_URL:?Set COOLIFY_API_URL}"
: "${COOLIFY_API_TOKEN:?Set COOLIFY_API_TOKEN}"
: "${COOLIFY_PROJECT_UUID:?Set COOLIFY_PROJECT_UUID}"
: "${COOLIFY_SERVER_UUID:?Set COOLIFY_SERVER_UUID}"

# ── Helper: run or print a curl command ──────────────────────────────────────
# Usage: coolify_curl <description> <method> <path> [extra curl args...]
coolify_curl() {
  local description="$1"; shift
  local method="$1";      shift
  local path="$1";        shift
  local url="${COOLIFY_API_URL}${path}"

  if $DRY_RUN; then
    echo "[dry-run] $description"
    echo "          curl -s -X $method \"$url\" $*"
    return 0
  fi

  echo "$description..."
  local response http_code body

  # Capture both body and HTTP status code
  response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
    "$@") || {
    echo "ERROR: curl failed for: $description" >&2
    return 1
  }

  http_code=$(tail -n1 <<< "$response")
  body=$(head -n -1 <<< "$response")

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "ERROR: $description returned HTTP $http_code" >&2
    echo "$body" >&2
    return 1
  fi

  printf '%s' "$body"
}

# ── Step 1: Create application ───────────────────────────────────────────────
echo "=== Step 1: Creating application on Coolify ==="

JSON_BODY=$(jq -n \
  --arg project "$COOLIFY_PROJECT_UUID" \
  --arg server  "$COOLIFY_SERVER_UUID" \
  --arg name    "bot-${SLUG}" \
  --arg desc    "MoolaBiz bot for ${BUSINESS_NAME}" \
  --arg domains "https://${SLUG}.bot.moolabiz.shop" \
  '{
    project_uuid:      $project,
    server_uuid:       $server,
    environment_name:  "production",
    name:              $name,
    description:       $desc,
    domains:           $domains,
    ports_exposes:     "3000",
    instant_deploy:    false
  }')

if $DRY_RUN; then
  echo "[dry-run] Would POST to ${COOLIFY_API_URL}/api/v1/applications/dockerfile"
  echo "[dry-run] Payload: $JSON_BODY"
  APP_UUID="dry-run-uuid-placeholder"
else
  APP_RESPONSE=$(coolify_curl \
    "Creating application 'bot-${SLUG}'" \
    POST "/api/v1/applications/dockerfile" \
    -H "Content-Type: application/json" \
    -d "$JSON_BODY")

  APP_UUID=$(jq -r '.uuid // empty' <<< "$APP_RESPONSE")

  if [[ -z "$APP_UUID" ]]; then
    echo "ERROR: Coolify did not return an app UUID. Full response:" >&2
    echo "$APP_RESPONSE" >&2
    exit 1
  fi

  echo "Created app UUID: $APP_UUID"
fi

# ── Step 2: Set environment variables ────────────────────────────────────────
echo ""
echo "=== Step 2: Setting environment variables ==="

declare -A ENV_VARS=(
  [BUSINESS_NAME]="$BUSINESS_NAME"
  [BUSINESS_SLUG]="$SLUG"
  [WHATSAPP_NUMBER]="$WHATSAPP_NUMBER"
  [PAYMENT_PROVIDER]="$PAYMENT_PROVIDER"
)

for VAR_NAME in "${!ENV_VARS[@]}"; do
  VAL="${ENV_VARS[$VAR_NAME]}"

  ENV_JSON=$(jq -n \
    --arg key   "$VAR_NAME" \
    --arg value "$VAL" \
    '{key: $key, value: $value, is_build_time: false}')

  if $DRY_RUN; then
    echo "[dry-run] Would set env var: ${VAR_NAME}=<value>"
  else
    coolify_curl \
      "  Setting ${VAR_NAME}" \
      POST "/api/v1/applications/${APP_UUID}/envs" \
      -H "Content-Type: application/json" \
      -d "$ENV_JSON" > /dev/null || {
        echo "ERROR: Failed to set env var ${VAR_NAME}" >&2
        exit 1
      }
    echo "  Set: $VAR_NAME"
  fi
done

# ── Step 3: Trigger deployment ────────────────────────────────────────────────
echo ""
echo "=== Step 3: Triggering deployment ==="

if $DRY_RUN; then
  echo "[dry-run] Would POST to ${COOLIFY_API_URL}/api/v1/applications/${APP_UUID}/deploy"
else
  coolify_curl \
    "Triggering deployment for ${APP_UUID}" \
    POST "/api/v1/applications/${APP_UUID}/deploy" > /dev/null || {
      echo "ERROR: Failed to trigger deployment" >&2
      exit 1
    }
  echo "Deployment triggered."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Done! ==="
if $DRY_RUN; then
  echo "[dry-run] No changes were made."
  echo "Remove --dry-run to execute."
else
  echo "Bot will be live at: https://${SLUG}.bot.moolabiz.shop"
  echo "Coolify app UUID:    $APP_UUID"
fi
