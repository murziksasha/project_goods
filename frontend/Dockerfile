# syntax=docker/dockerfile:1
# Multi-stage production image for the frontend (build context: repository root).
# Runtime keeps only dist/, the static server + /api proxy scripts and their only
# runtime dependency (helmet, no transitive deps). Runs as node (UID 1000).

FROM node:20-alpine AS build

ARG GIT_SHA=unknown

WORKDIR /app/frontend

ENV NPM_CONFIG_FETCH_RETRIES=10 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY frontend/package.json frontend/package-lock.json ./
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

COPY frontend/ ./
ENV VITE_BUILD_SHA=$GIT_SHA
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app/frontend

COPY --from=build /app/frontend/node_modules/helmet ./node_modules/helmet
COPY --from=build /app/frontend/dist ./dist
COPY frontend/scripts/serve-with-api-proxy.mjs frontend/scripts/proxy-security.mjs frontend/scripts/security-headers.mjs ./scripts/
RUN node -e "import('helmet').then(() => console.log('helmet ok'))"

ENV NODE_ENV=production

USER node

EXPOSE 5173

CMD ["node", "scripts/serve-with-api-proxy.mjs"]
