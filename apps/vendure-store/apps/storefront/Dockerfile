FROM node:22-alpine AS base

# ── deps: install all workspace deps so Next.js build can resolve them ────────
FROM base AS deps
WORKDIR /app
# Copy workspace-level manifests first for layer caching
COPY package.json package-lock.json ./
# Copy only the storefront package manifest (server is not needed for this build)
COPY apps/storefront/package.json ./apps/storefront/
RUN npm ci --workspace=storefront --include-workspace-root

# ── builder: compile the Next.js standalone bundle ───────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copy storefront source
COPY apps/storefront/ ./apps/storefront/
# Build only the storefront workspace
RUN npm run build:storefront

# ── runner: lean production image ────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# static assets (always present after a successful build)
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/static ./.next/static

# standalone output (contains server.js and a trimmed node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./

# public/ is optional — create it first so the COPY is always safe
RUN mkdir -p ./public
COPY --from=builder /app/apps/storefront/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
