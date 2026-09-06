FROM mongo:7 AS mongo-tools

FROM node:20-bookworm-slim AS with-mongo-tools

# libgssapi-krb5-2: mongodump/mongorestore from mongo:7 link against Kerberos.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl libgssapi-krb5-2 \
  && rm -rf /var/lib/apt/lists/*

# Copy dump/restore from the same mongo:7 image Compose already pulls.
# Avoids fastdl.mongodb.org (connect timeouts / blocked CDN during docker:up).
COPY --from=mongo-tools /usr/bin/mongodump /usr/local/bin/mongodump
COPY --from=mongo-tools /usr/bin/mongorestore /usr/local/bin/mongorestore
RUN chmod +x /usr/local/bin/mongodump /usr/local/bin/mongorestore \
  && mongodump --version \
  && mongorestore --version

FROM with-mongo-tools AS base

ARG BUILD_SHA=dev

WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=10 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
# Root package is only `file:..` for backend; skip root `npm install` (concurrently).
# Cache + retries: registry.npmjs.org often ETIMEDOUT during docker:up.
RUN --mount=type=cache,target=/root/.npm \
    set -eux; \
    i=0; \
    until npm install --prefix backend --no-audit --no-fund; do \
      i=$((i + 1)); \
      if [ "$i" -ge 5 ]; then exit 1; fi; \
      echo "npm install failed (attempt $i), retrying in 8s..."; \
      sleep 8; \
    done

COPY . .

WORKDIR /app/backend
RUN npm run build

ENV NODE_ENV=production
ENV BUILD_SHA=${BUILD_SHA}

EXPOSE 5000

CMD ["node", "dist/server.js"]