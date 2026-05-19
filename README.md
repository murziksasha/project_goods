# Project Goods

Project Goods - full-stack приложение для учета товаров, клиентов, сотрудников, продаж и финансовых операций.

## Карта документации

### Базовая документация
- [DEVELOPMENT.md](./DEVELOPMENT.md) - локальный запуск, окружение, команды
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - структура репозитория
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектура и поток данных
- [API.md](./API.md) - backend API и маршруты
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - управление состоянием и multi-user roadmap

### Flow-документы
- [ORDER_FLOW.md](./ORDER_FLOW.md) - flow заказов
- [SALE_FLOW.md](./SALE_FLOW.md) - flow продаж
- [WAREHOUSE_FLOW.MD](./WAREHOUSE_FLOW.MD) - flow склада
- [ACCOUNTING.MD](./ACCOUNTING.MD) - flow финансов/касс

### Карточки и предметные спецификации
- [ORDER_CARD.md](./ORDER_CARD.md) - требования к карточке заказа
- [SALE_CARD.md](./SALE_CARD.md) - требования к карточке продажи
- [CATALOG_PRODUCT_CREATE_MODAL_SPEC.md](./CATALOG_PRODUCT_CREATE_MODAL_SPEC.md) - модалка создания товара каталога
- [SERIAL_NUMBER_SEQUENCE_SPEC.md](./SERIAL_NUMBER_SEQUENCE_SPEC.md) - правила последовательности серийных номеров
- [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md) - поведение подсказок

### Служебная и проектная документация
- [DEMO_DATA.MD](./DEMO_DATA.MD) - демо-данные
- [AGENTS.MD](./AGENTS.MD) - правила/контекст для агентов

## UI Infrastructure Notes
- Global fixed horizontal scrollbar is implemented via shared component:
  - `frontend/src/shared/ui/GlobalHorizontalScrollbar.tsx`
- It is mounted in:
  - `frontend/src/pages/dashboard/ui/DashboardPage.tsx`
- Scope:
  - works for all table wrappers with class `.catalog-table-wrap` when horizontal overflow exists.

## Технологии
- Frontend: React, TypeScript, Vite, Axios, Bootstrap
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

Подробности: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

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
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

## Корневые команды

```bash
npm run dev
npm run dev:backend
npm run dev:frontend
npm run db:up
npm run db:down
npm run install:all
```

## Client Status Localization Rule
- Keep client status values in original English.
- Do not translate client status enums in UI labels, API payloads, or documentation.
