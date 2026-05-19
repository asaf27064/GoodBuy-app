# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the GoodBuy backend.
#
# Produces two final images:
#   - `api`     — lightweight Node container, no Chromium. Runs the Express
#                 HTTP server.
#   - `worker`  — Node + system Chromium for Puppeteer. Runs the scraping
#                 pipeline.
#
# Build:
#   docker build --target api    -t goodbuy-api    .
#   docker build --target worker -t goodbuy-worker .
#
# Run (after setting MONGO_URI / JWT_* / GEMINI_API_KEY env vars):
#   docker run -p 3000:3000 --env-file backend/src/.env goodbuy-api
#   docker run --env-file backend/src/.env goodbuy-worker
#
# For local dev with all three (api + worker + mongo), see docker-compose.yml.

############################################################
# Stage 1 — deps. Installs production node_modules once and is reused by
# both final images via COPY. Build tools live ONLY in this stage so the
# final images stay slim.
############################################################
FROM node:22-bookworm AS deps
WORKDIR /app

# node-expat (used by the XML parser in priceFetch) needs python + a C
# toolchain to build its native binding at install time. Puppeteer's
# Chromium download is skipped here — the worker image installs system
# Chromium instead, the API doesn't need it at all.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Workspace-aware install: copy only the manifests + lockfile first so this
# layer caches across source-only changes.
COPY package.json package-lock.json ./
COPY backend/src/package.json backend/src/package.json

# Install production deps for the backend workspace only. The mobile
# workspace is irrelevant here — its deps would just bloat the image.
RUN npm ci --omit=dev --workspace=backend/src --include-workspace-root


############################################################
# Stage 2 — API. Slim runtime, no Chromium. Non-root user.
############################################################
FROM node:22-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production PORT=3000

# Copy pre-built node_modules from the deps stage, then the backend source.
# package.json files are needed at runtime by Node's module resolver.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY backend/src/package.json ./backend/src/package.json
COPY backend/src ./backend/src

# Run as an unprivileged user — defence in depth in case of RCE in deps.
RUN groupadd --system app && useradd --system --gid app --home-dir /app app \
    && chown -R app:app /app
USER app

EXPOSE 3000

# Basic liveness check: the server is up if the port answers at all.
# The route doesn't have to exist — a 404 still means the process is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["node", "backend/src/server.js"]


############################################################
# Stage 3 — Worker. Same Node base, plus system Chromium for Puppeteer.
############################################################
FROM node:22-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production

# Install system Chromium + minimum fonts so Puppeteer can render Hebrew
# product pages reliably. PUPPETEER_EXECUTABLE_PATH points Puppeteer at
# the system binary instead of its bundled download (which we skipped
# in the deps stage anyway).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-noto fonts-noto-cjk fonts-noto-color-emoji \
      ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY backend/src/package.json ./backend/src/package.json
COPY backend/src ./backend/src

# Sandbox the worker just like the API.
RUN groupadd --system app && useradd --system --gid app --home-dir /app app \
    && chown -R app:app /app
USER app

# dumb-init reaps zombies — Puppeteer spawns lots of short-lived processes
# and Node alone doesn't handle SIGCHLD well as PID 1.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/src/jobs/worker.js"]
