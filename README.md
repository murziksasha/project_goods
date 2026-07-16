# Project Goods

Project Goods - full-stack приложение для учета товаров, клиентов, сотрудников, продаж и финансовых операций.

## Карта документации

### Базовая документация
- [DEVELOPMENT.md](./DOCUMENTATION/DEVELOPMENT.md) - локальный запуск, окружение, команды
- [DEPLOYMENT.md](./DOCUMENTATION/DEPLOYMENT.md) - Docker prod, env vars, MongoDB replica set
- [TESTING.md](./DOCUMENTATION/TESTING.md) - команды тестов, структура, CI expectations
- [PROJECT_STRUCTURE.md](./DOCUMENTATION/PROJECT_STRUCTURE.md) - структура репозитория
- [ARCHITECTURE.md](./DOCUMENTATION/ARCHITECTURE.md) - архитектура и поток данных
- [API.md](./DOCUMENTATION/API.md) - backend API, auth matrix per endpoint
- [STATE_MANAGEMENT.md](./DOCUMENTATION/STATE_MANAGEMENT.md) - TanStack Query, multi-user roadmap
- [STATE_QUERY_MIGRATION_PLAN.md](./DOCUMENTATION/STATE_QUERY_MIGRATION_PLAN.md) - план миграции query cache
- [BROWSER_NAVIGATION.md](./DOCUMENTATION/BROWSER_NAVIGATION.md) - SPA History API, URL-параметры dashboard
- [BUILD_VERSION_SPEC.md](./DOCUMENTATION/BUILD_VERSION_SPEC.md) - метка версии сборки (SHA + время)
- [SECURITY.md](./DOCUMENTATION/SECURITY.md) - аутентификация, RBAC, LAN-деплой
- [UI_DESIGN_SYSTEM.md](./DOCUMENTATION/UI_DESIGN_SYSTEM.md) - токены, компоненты, breakpoints

### Flow-документы
- [BUSINESS_DASHBOARD.md](./DOCUMENTATION/BUSINESS_DASHBOARD.md) - analytics, market rates, weather widget
- [ORDER_FLOW.md](./DOCUMENTATION/ORDER_FLOW.md) - repair orders и sales orders
- [SUPPLIER_ORDER_FLOW.md](./DOCUMENTATION/SUPPLIER_ORDER_FLOW.md) - заказы поставщику (вкладки Supplier Order / Information)
- [SALE_FLOW.md](./DOCUMENTATION/SALE_FLOW.md) - продажи, Rapid sale
- [WAREHOUSE_FLOW.md](./DOCUMENTATION/WAREHOUSE_FLOW.md) - склад, серийные этикетки
- [ACCOUNTING.md](./DOCUMENTATION/ACCOUNTING.md) - финансы и кассы
- [Permission_Flow.md](./DOCUMENTATION/Permission_Flow.md) - RBAC, роли, finance permissions
- [EMPLOYEES_SPEC.md](./DOCUMENTATION/EMPLOYEES_SPEC.md) - сотрудники, аналитика, мастер

### Карточки и предметные спецификации
- [ORDER_CARD.md](./DOCUMENTATION/ORDER_CARD.md) - карточка заказа (loading/error/mobile)
- [SALE_CARD.md](./DOCUMENTATION/SALE_CARD.md) - карточка продажи
- [CLIENTS_RULES.md](./DOCUMENTATION/CLIENTS_RULES.md) - клиенты и статусы CRM
- [CATALOG_PRODUCT_CREATE_MODAL_SPEC.md](./DOCUMENTATION/CATALOG_PRODUCT_CREATE_MODAL_SPEC.md) - модалка каталога
- [SERIAL_NUMBER_SEQUENCE_SPEC.md](./DOCUMENTATION/SERIAL_NUMBER_SEQUENCE_SPEC.md) - серийные номера
- [PRINT_FORMS_SPEC.md](./DOCUMENTATION/PRINT_FORMS_SPEC.md) - печатные формы
- [SPEC_SUGGESTIONS_BEHAVIOR.md](./DOCUMENTATION/SPEC_SUGGESTIONS_BEHAVIOR.md) - подсказки

### Служебная документация
- [DEMO_DATA.md](./DOCUMENTATION/DEMO_DATA.md) - демо-данные
- [AGENTS.md](./AGENTS.md) - правила для AI-агентов

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

