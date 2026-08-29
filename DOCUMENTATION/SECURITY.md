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

- `helmet()` — security headers
- `express.json({ limit: '1mb' })` — default body size limit
- CORS — restricted by `CLIENT_ORIGIN` env var (comma-separated origins). In **production**, missing `CLIENT_ORIGIN` blocks browser cross-origin requests (dev still allow-all when unset).
- Listen host — `HOST` (default `0.0.0.0`) for LAN binding
- Weather — OpenWeather API key via `OPENWEATHER_API_KEY` only (not query params, not Mongo settings)
- Login rate limit — soft in-memory throttle on `POST /api/auth/login` only (~40/15m per IP, ~15/15m per username) → `429`
- Print HTML — frontend sanitizes print templates with DOMPurify before `dangerouslySetInnerHTML` / print window

## Transactions

- Multi-doc money/stock paths use `withOptionalMongoSession`.
- `MONGO_REQUIRE_TRANSACTIONS` defaults to **true** when `NODE_ENV=production`: missing replica set → **503** instead of silent non-atomic writes.
- Local unit tests / non-prod default to optional fallback when RS is unavailable.

## LAN Assumptions

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