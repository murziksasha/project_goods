FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install && npm install --prefix frontend

COPY . .

WORKDIR /app/frontend
RUN npm run build

EXPOSE 5173

CMD ["node", "scripts/serve-with-api-proxy.mjs"]
