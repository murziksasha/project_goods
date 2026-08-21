FROM node:20-bookworm-slim AS base

ARG MONGODB_DATABASE_TOOLS_VERSION=100.17.0
ARG BUILD_SHA=dev

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tar \
  && rm -rf /var/lib/apt/lists/*

# fastdl.mongodb.org often resets HTTP/2 streams (curl 18). Force HTTP/1.1 + retries.
RUN set -eux; \
  url="https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-${MONGODB_DATABASE_TOOLS_VERSION}.tgz"; \
  i=0; \
  until curl --http1.1 --fail --location --retry 5 --retry-all-errors --retry-delay 3 \
      --connect-timeout 30 --max-time 180 \
      "$url" -o /tmp/mongodb-database-tools.tgz; do \
    i=$((i + 1)); \
    if [ "$i" -ge 5 ]; then exit 18; fi; \
    sleep 4; \
  done; \
  test -s /tmp/mongodb-database-tools.tgz; \
  tar -tzf /tmp/mongodb-database-tools.tgz >/dev/null; \
  tar -xzf /tmp/mongodb-database-tools.tgz -C /tmp; \
  cp /tmp/mongodb-database-tools-*/bin/mongodump /usr/local/bin/mongodump; \
  cp /tmp/mongodb-database-tools-*/bin/mongorestore /usr/local/bin/mongorestore; \
  chmod +x /usr/local/bin/mongodump /usr/local/bin/mongorestore; \
  rm -rf /tmp/mongodb-database-tools*

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install && npm install --prefix backend

COPY . .

WORKDIR /app/backend
RUN npm run build

ENV NODE_ENV=production
ENV BUILD_SHA=${BUILD_SHA}

EXPOSE 5000

CMD ["node", "dist/server.js"]