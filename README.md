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
  - `.catalog-table-wrap`, `.orders-table-wrap`, and `.finance-table-wrap` when horizontal overflow exists.
  - On desktop with a fine pointer the wrapper native bar is hidden. The fixed bar at the bottom of the window is the only horizontal scrollbar.
  - The native bar stays on `max-width: 1024px`, coarse pointers, and wrappers with `data-global-scrollbar="off"`.
- Rules: [UI_DESIGN_SYSTEM.md — Tables](./DOCUMENTATION/UI_DESIGN_SYSTEM.md#tables), [WAREHOUSE_FLOW.md §15](./DOCUMENTATION/WAREHOUSE_FLOW.md).

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
- Backend API: `http://localhost:5000/api` (в Docker порт `5000` доступен только с этого ПК)
- Health check: `http://localhost:5000/api/health`

MongoDB в Docker слушает только `127.0.0.1:27017`; для подключения с хоста используйте `MONGO_URI` из `backend/.env.example` (`replicaSet=rs0&directConnection=true`). Сотрудники в сети работают только через frontend на `5173`.

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
npm run test:deployment
```

Docker-запуск всего стека (MongoDB + backend + frontend) и передача `GIT_SHA` в сборку frontend: см. [BUILD_VERSION_SPEC.md](./DOCUMENTATION/BUILD_VERSION_SPEC.md).

Рабочий сервер запускается отдельными командами с авторизацией MongoDB и приватным незакоммиченным `.env.production` (шаблон `.env.production.example`):

```bash
npm run update:prod            # обновление одной командой: build:prod + up:prod + проверка /api/health
npm run docker:build:prod      # сохранить rollback-образы и собрать новые, сервисы не перезапускаются
npm run mongo:keyfile:prepare:prod
npm run mongo:users:init:prod  # первый переход сервера на пароль: создать/обновить пользователей MongoDB, keyfile, запуск prod
npm run docker:up:prod         # отказывает без .env.production / MONGO_URI
npm run docker:rollback:prod   # откат на сохранённые :rollback-образы, MongoDB остаётся с паролем (keyfile + MONGO_URI)
npm run docker:rollback:noauth -- --confirm-noauth  # ТОЛЬКО для отката самого перехода на авторизацию: MongoDB БЕЗ пароля
npm run docker:stop:prod       # остановить prod-контейнеры (stop, не down: тома и данные сохраняются)
npm run docker:logs:prod       # логи prod (-f, последние 200 строк); сервис: npm run docker:logs:prod -- backend
                               # без слежения: npm run docker:logs:prod -- backend --no-follow
```

Обновление рабочего сервера на новый коммит:

1. В программе создать бэкап (Настройки → Бэкапы), скачать и сохранить не на этом ПК.
2. `git pull --ff-only` (чистый checkout, нужная ветка).
3. `npm run update:prod` — проверяет `.env.production`, собирает образы под текущий коммит и сохраняет работающие как точку отката, пересоздаёт контейнеры на тех же томах и до ~90 с ждёт `/api/health` (`mongoOk: true`, `buildSha` = текущий коммит) на `127.0.0.1:5000` и `127.0.0.1:5173`. Сам `git pull` не делает и сам не откатывает.
4. Проверить вход, продажи, склад, финансы.
5. Если проверка не прошла, команда выводит последние логи backend и завершается с кодом 1; откат — `npm run docker:rollback:prod`: поднимает образы, сохранённые на шаге 3, на тех же томах; авторизация MongoDB (keyfile и пользователь `project_goods_app` из `.env.production`) остаётся включённой, а `/api/health` показывает `buildSha` версии отката. Возврат на новую версию — снова `npm run update:prod`.

Первый переход сервера с существующими данными на MongoDB с паролем (пользователей в базе ещё нет, backend `unhealthy`):

1. Бэкап в программе, скачать и сохранить не на этом ПК (если программа не запускается — временно переименовать `.env.production`, `npm run docker:up`, бэкап, `npm run docker:down`, вернуть имя файла).
2. Заполнить `.env.production` для этого сервера (свой пароль приложения в `MONGO_URI`; по желанию `MONGO_ADMIN_PASSWORD`).
3. Чистый checkout нужного коммита.
4. `npm run mongo:users:init:prod` — останавливает prod (`stop`, не `down`), поднимает временную MongoDB без пароля на том же томе (без портов и сети), создаёт или обновляет `project_goods_admin` и `project_goods_app`, удаляет временный контейнер, при необходимости готовит keyfile, запускает prod и ждёт `/api/health` (`mongoOk: true`). Пароли не печатаются и не передаются в аргументах. Если пароля администратора нет ни в `.env.production`, ни в базе, он генерируется в `~/project_goods_secrets/mongo-admin-password.txt` — перенести в менеджер паролей и удалить файл. Повторный запуск безопасен.

Если образа для текущего коммита нет, `docker:up:prod` пишет `Image project-goods/<сервис>:<sha> not found. Run npm run docker:build:prod first.`

Порядок репетиции, рабочего окна и отката: [DEPLOYMENT.md](./DOCUMENTATION/DEPLOYMENT.md). Production-изменения Docker и секретов выполняются только после отдельного подтверждения (см. `AGENTS.md`).

Планируется (container hardening): контейнеры от `node` (UID 1000), автоматическая смена владельца тома бэкапов внутри `docker:up:prod` / `update:prod`, CSP и защита от встраивания для страниц frontend, лимиты памяти и процессов. Пока не реализовано, см. [CONTAINER_HARDENING_PLAN.md](./DOCUMENTATION/CONTAINER_HARDENING_PLAN.md).
