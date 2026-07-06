FROM node:20-alpine

ARG GIT_SHA=unknown

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install && npm install --prefix frontend

COPY . .

WORKDIR /app/frontend
ENV VITE_BUILD_SHA=$GIT_SHA
RUN npm run build

EXPOSE 5173

CMD ["node", "scripts/serve-with-api-proxy.mjs"]