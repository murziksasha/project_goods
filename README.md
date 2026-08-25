# Project Goods

Project Goods - full-stack приложение для учета товаров, клиентов, сотрудников, продаж и финансовых операций.

## Карта документации

Полный индекс и порядок чтения: [DOCUMENTATION/README.md](./DOCUMENTATION/README.md).

- **Start:** [DEVELOPMENT](./DOCUMENTATION/DEVELOPMENT.md) · [DEPLOYMENT](./DOCUMENTATION/DEPLOYMENT.md) · [TESTING](./DOCUMENTATION/TESTING.md)
- **Platform:** [ARCHITECTURE](./DOCUMENTATION/ARCHITECTURE.md) · [API](./DOCUMENTATION/API.md) · [PROJECT_STRUCTURE](./DOCUMENTATION/PROJECT_STRUCTURE.md) · [SECURITY](./DOCUMENTATION/SECURITY.md)
- **Orders / sales:** [ORDER_FLOW](./DOCUMENTATION/ORDER_FLOW.md) · [ORDER_CARD](./DOCUMENTATION/ORDER_CARD.md) · [SALE_FLOW](./DOCUMENTATION/SALE_FLOW.md) · [SALE_CARD](./DOCUMENTATION/SALE_CARD.md)
- **Warehouse / serials:** [WAREHOUSE_FLOW](./DOCUMENTATION/WAREHOUSE_FLOW.md) · [SERIAL_NUMBER_SEQUENCE_SPEC](./DOCUMENTATION/SERIAL_NUMBER_SEQUENCE_SPEC.md)
- **Finance / people:** [ACCOUNTING](./DOCUMENTATION/ACCOUNTING.md) · [CLIENTS_RULES](./DOCUMENTATION/CLIENTS_RULES.md) · [EMPLOYEES_SPEC](./DOCUMENTATION/EMPLOYEES_SPEC.md)
- **Agents:** [AGENTS.md](./AGENTS.md)

## UI Infrastructure Notes
- Global fixed horizontal scrollbar is implemented via shared component:
  - `frontend/src/shared/ui/GlobalHorizontalScrollbar.tsx`
- It is mounted in:
  - `frontend/src/pages/dashboard/ui/DashboardPage.tsx`
- Scope:
  - works for all table wrappers with class `.catalog-table-wrap` when horizontal overflow exists.

## Технологии
- Frontend: React 19, TypeScript, Vite, Axios, TanStack Query, i18next, custom CSS design system
- Backend: Node.js, Express, TypeScript, Mongoose
- Database: MongoDB
- Local infrastructure: Docker Compose

## Структура репозитория

```text
project_goods/
|- backend/      # Express API, доменные сервисы, модели Mongoose
|- frontend/     # React-приложение
|- docker-compose.yml
|- package.json  # корневые команды для локальной разработки
```

Подробности: [PROJECT_STRUCTURE.md](./DOCUMENTATION/PROJECT_STRUCTURE.md).

## Быстрый старт

### 1. Установить зависимости

```bash
npm run install:all
```

### 2. Подготовить переменные окружения

Создайте локальные `.env` файлы на основе:
- `backend/.env.example`
- `frontend/.env.example`

### 3. Запустить MongoDB

```bash
npm run db:up
```

### 4. Запустить frontend и backend

```bash
npm run dev
```

### 5. Открыть приложение
- Frontend локально: `http://localhost:5173`
- Frontend в локальной сети: `http://192.168.10.55:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

## Браузерный режим

- Приложение работает как обычный browser app без PWA, manifest и service worker.
- Основной адрес для клиентов в локальной сети: `http://192.168.10.55:5173`.
- После деплоя клиенты должны один раз открыть приложение в браузере: frontend автоматически unregister старые service workers и удалит старые PWA/workbox caches.
- Если у клиента все еще открывается устаревшая версия, очистите site data вручную в Chrome DevTools/Application или настройках браузера.

## Корневые команды

```bash
npm run dev
npm run dev:backend
npm run dev:frontend
npm run db:up
npm run db:down
npm run docker:up
npm run docker:down
npm run install:all
```

Docker-запуск всего стека (MongoDB + backend + frontend) и передача `GIT_SHA` в сборку frontend: см. [BUILD_VERSION_SPEC.md](./DOCUMENTATION/BUILD_VERSION_SPEC.md).

