# Security

Related: [Permission_Flow.md](./Permission_Flow.md) · [API.md](./API.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [index](./README.md)

## Deployment Context

Project Goods targets **LAN / trusted-office** deployments. API endpoints require authentication; RBAC enforces permissions per module. This is not a public-internet SaaS hardening profile.

## Authentication

| Mechanism | Details |
| --- | --- |
| Login | `POST /api/auth/login` with username + password |
| Session | Bearer token in `Authorization` header |
| Storage | Token in `localStorage` (`project-goods.auth-token`) on frontend |
| Password policy | Minimum **8 characters** (username minimum 3) |
| Sessions | Up to 10 active tokens per employee; tokens stored as SHA-256 (`h1:…`) only; optional idle TTL via `AUTH_SESSION_IDLE_HOURS` (0 = off); on each auth check, all idle-expired sessions for that employee are pruned |

### Public Endpoints (no auth)

- `GET /api/health` (returns `version` + `buildSha` for deploy verification)
- `POST /api/auth/login`
- `GET /api/auth/invitations/:token`
- `POST /api/auth/invitations/:token/register`

All other `/api/*` routes require a valid Bearer token via `requireAuthUnlessPublic` middleware (`backend/src/shared/middleware/auth.ts`). The middleware sets `req.employee`; route helpers `requirePermission` / `requireAnyPermission` / `requireOwner` reuse that document (no second token DB lookup per check).

## Optimistic concurrency

Mutations that accept `expectedUpdatedAt` return **409** when the document changed since the client loaded it (`assertNotStale`). Covered: sale, product, client device, **client**. Frontend shows a conflict message and refreshes the list.

## Authorization

RBAC permissions are defined in `backend/src/domain/employee/constants.ts`. Route-level checks use `requirePermission` / `requireAnyPermission` helpers (`backend/src/shared/lib/http.ts`).

Full permission matrix: [Permission_Flow.md](./Permission_Flow.md).

### Key Rules

- `owner` bypasses all permission checks.
- Frontend hides unavailable actions; backend still returns `401` / `403`.
- Demo seed endpoints (`POST /api/demo/seed*`) require `owner` and are **disabled in production** (`NODE_ENV=production`).
- Demo erase endpoints require Temporary Admin (`owner` + username `admin`) and are **disabled in production**.

## HTTP Hardening

- Helmet — shared config for API and frontend proxy (see «Container hardening» below)
- `express.json({ limit: '1mb' })` — default body size limit
- CORS — restricted by `CLIENT_ORIGIN` env var (comma-separated origins). In **production**, missing `CLIENT_ORIGIN` blocks browser cross-origin requests (dev still allow-all when unset).
- Listen host — `HOST` (default `0.0.0.0`) for LAN binding
- Weather — OpenWeather API key via `OPENWEATHER_API_KEY` only (not query params, not Mongo settings)
- Login rate limit — soft in-memory throttle on `POST /api/auth/login` only (per IP: only **failed** logins count, default 100/15m via `LOGIN_MAX_FAILED_PER_IP`; per username: every attempt counts, 15/15m) → `429`
- Print HTML — frontend sanitizes print templates with DOMPurify before `dangerouslySetInnerHTML` / print window

### Container hardening (реализовано)

Подробности: [CONTAINER_HARDENING_PLAN.md](./CONTAINER_HARDENING_PLAN.md), развёртывание: [DEPLOYMENT.md](./DEPLOYMENT.md#container-hardening-реализовано).

- Общая конфигурация Helmet для API (`backend/src/config/security-headers.ts`) и прокси frontend (`frontend/scripts/security-headers.mjs`): HTML, `/assets/*`, файлы `public/`, SPA fallback и ошибки 500/502 получают CSP, `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy: no-referrer` и остальные заголовки Helmet. Для `/api` через прокси приоритет у заголовков backend.
- CSP: `script-src 'self'`, `script-src-attr 'none'`, `style-src 'self' 'unsafe-inline'` (React `style={…}` и `<style>` окна печати), `img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`. HSTS и `upgrade-insecure-requests` выключены: доступ только по HTTP в LAN, HTTPS не планируется.
- `CSP_REPORT_ONLY` (по умолчанию `true`) отправляет `Content-Security-Policy-Report-Only`; `false` включает блокирующий режим. `frame-ancestors` в Report-Only браузер игнорирует, встраивание всё равно запрещает `X-Frame-Options`.
- Встроенных скриптов в `index.html` нет: тема ставится из `/theme-init.js` (`no-cache`).
- Окно печати (`window.open('')` + `document.write`) наследует CSP страницы. Шаблоны проходят DOMPurify, скриптов в окне печати нет. Внешние `<img src="https://…">` в пользовательских шаблонах CSP заблокирует — проверить шаблоны до блокирующего режима.
- Контейнеры backend и frontend работают от `node` (UID 1000) с `cap_drop: [ALL]`, `no-new-privileges`, `pids_limit: 200`, `mem_limit`; frontend `read_only` с `tmpfs: /tmp`. MongoDB: `mem_limit: 2g` и `--wiredTigerCacheSizeGB 1`.
- Принятое ограничение: backend по-прежнему может писать в том бэкапов. `USER node` не защищает бэкапы от кода, выполненного внутри backend, но лишает его root-прав в контейнере.
- Известная особенность: `POST /api/backups/restore-file` читает архив до 2 ГБ целиком в память. Планируется потоковая запись во временный файл.

## Transactions

- Multi-doc money/stock paths use `withOptionalMongoSession`.
- `MONGO_REQUIRE_TRANSACTIONS` defaults to **true** when `NODE_ENV=production`: missing replica set → **503** instead of silent non-atomic writes.
- Local unit tests / non-prod default to optional fallback when RS is unavailable.

## LAN Assumptions

- The default local Compose file publishes MongoDB and backend only on `127.0.0.1`; employees connect through frontend port `5173`. Production adds MongoDB keyfile authentication and an inventory-scoped application user through the separate Compose layer in [DEPLOYMENT.md](./DEPLOYMENT.md).
- Only the production frontend proxy is a trusted forwarding hop (`TRUST_PROXY_HOPS=1`) for backend IP attribution. The proxy replaces client-supplied forwarding headers with the actual socket address; direct backend port `5000` is loopback-only. On Windows Docker Desktop all LAN clients reach the backend from one gateway address (observed `172.18.0.1`), so the per-IP bucket is effectively shop-wide. That is why it counts only failed logins: normal successful sign-ins never consume it, and the per-username limiter (15/15m) still stops guessing against one account.
- Soft login rate limit only (see above); no global API rate limit.
- Session tokens: client holds raw bearer; DB stores `h1:` + SHA-256 only. **Plaintext legacy sessions are rejected** (re-login required).
- Settings API never returns or persists `openWeatherApiKey`; response includes `dashboardPreferences.hasOpenWeatherApiKey` when server env is set.
- Idle session expiry: set `AUTH_SESSION_IDLE_HOURS` (e.g. `72` for weekend-safe shop PCs). Default **0** (disabled). `lastUsedAt` is touched at most every 5 minutes via atomic `updateOne` (not on `GET /events/stream`). Multi-tab clients share one SSE leader so HTTP/1.1 connection slots stay free.
- Backup custom `BACKUP_*_COMMAND` templates: only `{mongoUri}` / `{archivePath}`; shell metacharacters rejected before spawn.
- Backup upload default limit is **2gb** (`BACKUP_RESTORE_UPLOAD_LIMIT`).

## Maintenance

When adding new API routes:

1. Register route **after** `requireAuthUnlessPublic` in `backend/src/app.ts`.
2. Add explicit permission checks for mutations.
3. Update [Permission_Flow.md](./Permission_Flow.md) and [API.md](./API.md).
4. Add integration test for 401 without token.
