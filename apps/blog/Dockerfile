# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ── Dependencies ───────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/blog/package.json ./apps/blog/
RUN npm ci --workspace=@nexus/blog

# ── Development ────────────────────────────────────────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@nexus/blog"]

# ── Builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/blog/node_modules ./apps/blog/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@nexus/blog

# ── Production runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/blog/.next/standalone ./
COPY --from=builder /app/apps/blog/.next/static ./apps/blog/.next/static
COPY --from=builder /app/apps/blog/public ./apps/blog/public 2>/dev/null || true

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/blog/server.js"]
