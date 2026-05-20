FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install && npm install --prefix backend

COPY . .

WORKDIR /app/backend
EXPOSE 5000

CMD ["npm", "run", "dev"]
