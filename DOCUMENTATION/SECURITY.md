# Security

## Deployment Context

Project Goods targets **LAN / trusted-office** deployments. API endpoints require authentication; RBAC enforces permissions per module. This is not a public-internet SaaS hardening profile.

## Authentication

| Mechanism | Details |
| --- | --- |
| Login | `POST /api/auth/login` with username + password |
| Session | Bearer token in `Authorization` header |
| Storage | Token in `localStorage` (`project-goods.auth-token`) on frontend |
| Password policy | Minimum **8 characters** (username minimum 3) |
| Sessions | Up to 10 active tokens per employee; no TTL yet |

### Public Endpoints (no auth)

- `GET /api/health` (returns `version` + `buildSha` for deploy verification)
- `POST /api/auth/login`
- `GET /api/auth/invitations/:token`
- `POST /api/auth/invitations/:token/register`

All other `/api/*` routes require a valid Bearer token via `requireAuthUnlessPublic` middleware (`backend/src/shared/middleware/auth.ts`). The middleware sets `req.employee`; route helpers `requirePermission` / `requireAnyPermission` / `requireOwner` reuse that document (no second token DB lookup per check).

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
- CORS — restricted by `CLIENT_ORIGIN` env var (comma-separated origins); defaults to allow-all when unset

## LAN Assumptions

- No rate limiting on login (acceptable for trusted LAN).
- Session tokens stored in plaintext in MongoDB (acceptable for LAN; hash + TTL planned for internet-facing deploys).
- Backup restore may execute shell commands from env templates — restrict `BACKUP_RESTORE_COMMAND` in production.

## Maintenance

When adding new API routes:

1. Register route **after** `requireAuthUnlessPublic` in `backend/src/app.ts`.
2. Add explicit permission checks for mutations.
3. Update [Permission_Flow.md](./Permission_Flow.md) and [API.md](./API.md).
4. Add integration test for 401 without token.