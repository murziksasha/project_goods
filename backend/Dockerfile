# syntax=docker/dockerfile:1
# Multi-stage production image for the backend (build context: repository root).
# Runtime keeps only dist/, production dependencies, MongoDB Database Tools
# (mongodump/mongorestore for backups and yearly archives), curl for the Compose
# healthcheck, and /bin/sh for BACKUP_*_COMMAND templates. Runs as node (UID 1000).

FROM mongo:7 AS mongo-tools

FROM node:20-bookworm-slim AS deps-base
WORKDIR /app/backend
ENV NPM_CONFIG_FETCH_RETRIES=10 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY backend/package.json backend/package-lock.json ./

FROM deps-base AS build
# Cache + retries: registry.npmjs.org often ETIMEDOUT during docker builds.
RUN --mount=type=cache,target=/root/.npm \
    set -eux; \
    i=0; \
    until npm ci --no-audit --no-fund; do \
      i=$((i + 1)); \
      if [ "$i" -ge 5 ]; then exit 1; fi; \
      echo "npm ci failed (attempt $i), retrying in 8s..."; \
      sleep 8; \
    done
COPY backend/tsconfig.json backend/server.ts ./
COPY backend/src ./src
RUN npm run build

FROM deps-base AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
    set -eux; \
    i=0; \
    until npm ci --omit=dev --no-audit --no-fund; do \
      i=$((i + 1)); \
      if [ "$i" -ge 5 ]; then exit 1; fi; \
      echo "npm ci --omit=dev failed (attempt $i), retrying in 8s..."; \
      sleep 8; \
    done

FROM node:20-bookworm-slim AS runtime

ARG BUILD_SHA=dev

# libgssapi-krb5-2: mongodump/mongorestore from mongo:7 link against Kerberos.
# curl: Compose healthcheck. ca-certificates: TLS for outbound requests (weather).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl libgssapi-krb5-2 \
  && rm -rf /var/lib/apt/lists/*

# Copy dump/restore from the same mongo:7 image Compose already pulls.
# Avoids fastdl.mongodb.org (connect timeouts / blocked CDN during builds).
COPY --from=mongo-tools /usr/bin/mongodump /usr/local/bin/mongodump
COPY --from=mongo-tools /usr/bin/mongorestore /usr/local/bin/mongorestore
RUN chmod 0755 /usr/local/bin/mongodump /usr/local/bin/mongorestore \
  && mongodump --version \
  && mongorestore --version

WORKDIR /app/backend
COPY --from=prod-deps /app/backend/node_modules ./node_modules
COPY backend/package.json backend/package-lock.json ./
COPY --from=build /app/backend/dist ./dist

# A new empty named volume inherits this owner on first mount. Existing root-owned
# production volumes are migrated by scripts/backup-volume-owner.mjs (docker:up:prod).
RUN mkdir -p /app/backups/yearly && chown -R node:node /app/backups

ENV NODE_ENV=production
ENV BUILD_SHA=${BUILD_SHA}

USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
