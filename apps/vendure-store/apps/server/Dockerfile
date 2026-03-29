FROM node:22-alpine AS base

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 vendure

COPY --from=deps  --chown=vendure:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=vendure:nodejs /app/dist ./dist
COPY --from=builder --chown=vendure:nodejs /app/package.json ./
# Include email templates and other static assets (email templates are read at runtime)
COPY --from=builder --chown=vendure:nodejs /app/static ./static

USER vendure
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
