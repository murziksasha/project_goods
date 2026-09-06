FROM node:20-alpine

ARG GIT_SHA=unknown

WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=10 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/
# Root package is only `file:..` for frontend; skip root `npm install`.
RUN --mount=type=cache,target=/root/.npm \
    set -eux; \
    i=0; \
    until npm install --prefix frontend --no-audit --no-fund; do \
      i=$((i + 1)); \
      if [ "$i" -ge 5 ]; then exit 1; fi; \
      echo "npm install failed (attempt $i), retrying in 8s..."; \
      sleep 8; \
    done

COPY . .

WORKDIR /app/frontend
ENV VITE_BUILD_SHA=$GIT_SHA
RUN npm run build

EXPOSE 5173

CMD ["node", "scripts/serve-with-api-proxy.mjs"]