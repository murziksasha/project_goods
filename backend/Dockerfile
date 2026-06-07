FROM node:20-bookworm-slim

ARG MONGODB_DATABASE_TOOLS_VERSION=100.17.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tar \
  && curl -fsSL "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-${MONGODB_DATABASE_TOOLS_VERSION}.tgz" -o /tmp/mongodb-database-tools.tgz \
  && tar -xzf /tmp/mongodb-database-tools.tgz -C /tmp \
  && cp /tmp/mongodb-database-tools-*/bin/mongodump /usr/local/bin/mongodump \
  && cp /tmp/mongodb-database-tools-*/bin/mongorestore /usr/local/bin/mongorestore \
  && chmod +x /usr/local/bin/mongodump /usr/local/bin/mongorestore \
  && rm -rf /var/lib/apt/lists/* /tmp/mongodb-database-tools* 

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install && npm install --prefix backend

COPY . .

WORKDIR /app/backend
EXPOSE 5000

CMD ["npm", "run", "dev"]
