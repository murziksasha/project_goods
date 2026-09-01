# Testing Guide

Related: [DEVELOPMENT.md](./DEVELOPMENT.md) · [index](./README.md)

## Commands

| Scope | Command | Notes |
|-------|---------|-------|
| Frontend unit/UI | `cd frontend && npm test` | Vitest + Testing Library |
| Frontend watch | `cd frontend && npm run test:watch` | |
| Frontend coverage | `cd frontend && npm run test:coverage` | |
| Frontend e2e (Playwright) | `npm run test:e2e` | Starts Vite on `:5174`. See **Playwright e2e**. |
| Backend unit + integration | `cd backend && npm test` | Vitest, no live MongoDB required |
| Backend coverage | `cd backend && npm run test:coverage` | Strict 100% on listed modules only |
| Lint | `npm run lint` (per package) | |

## Playwright e2e

In-repo Chromium checks (`@playwright/test` in `frontend`). Not an MCP server.

```bash
npm run test:e2e:install --prefix frontend   # once per machine
npm run test:e2e                             # from repo root, or cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:ui           # Playwright UI mode
```

- Config: `frontend/playwright.config.ts`. Specs: `frontend/e2e/`.
- Playwright **starts Vite on `127.0.0.1:5174`** (not Docker `:5173`). Override with `PLAYWRIGHT_PORT` / `PLAYWRIGHT_BASE_URL`.
- Skip the auto server with `PLAYWRIGHT_SKIP_WEBSERVER=1` if you already have that URL up.
- Authenticated specs mock `/api/**` and inject `project-goods.auth-token` — no real Mongo login.
- English UI via `project-goods.lang`.
- Not on CI. `npm test` / `npm run verify` stay unit + lint + typecheck + build.

Specs:

- `e2e/login-page.spec.ts` — logged-out Login / Sign in.
- `e2e/accounting-operation-modal.spec.ts` — **Confirm** (outline, stay open) and **Confirm and close** (filled); no large-amount warning.

## Frontend structure

- Co-located `*.test.tsx` / `*.test.ts` next to components and hooks.
- High-value suites: `OrdersWorkspace`, `OrderDetailCard`, `CreateOrderCard`, `AccountingPanel`, `DashboardPage`.
- Product grouping: `order-line-item-groups.test.ts` (card key + print key with price); `OrderDetailCard.test.tsx` (collapsed `×N` groups); `orders-workspace-shared.test.tsx` (print `products_table` / invoice merge-vs-split).
- Product model serial table: `product-model.test.ts` (latest batch + reserved-on-other-sale); `ProductModelModal.test.tsx` (Latest / Reserved badges).
- Split workspace shells: `OrdersWorkspaceListHeader`, `OrdersWorkspaceTableSection`, `OrdersWorkspaceModals`.
- Query migration regression: `useDashboardPage.invalidation.test.ts` asserts `queryKeys` invalidation contract.

## Backend structure

- Domain services: `backend/src/domain/**/service*.test.ts` — business rules without HTTP.
- Route helpers: `backend/src/routes/sale.routes.test.ts`.
- **API integration:** `backend/src/routes/api.integration.test.ts` (supertest)
  - 401 without token / invalid token
  - 403 missing permission / non-owner settings / finance write / SO write / warehouse write / backups
  - sale update missing target → 404
  - smoke reads: products, clients, sales, settings
  - demo endpoints blocked when `NODE_ENV=production`
- Auth middleware unit: `backend/src/shared/middleware/auth.test.ts`.
- HTTP helpers: `backend/src/shared/lib/http.test.ts` — `asyncHandler` + `requirePermission` uses `req.employee` (no second token lookup).
- Supplier-order update + favorite: `domain/supplier-order/service.update.test.ts`
- Catalog-product list/delete usage: `domain/catalog-product/service.test.ts`
- Sequence formatters + counters: `domain/sequence/service.test.ts`
- Demo erase + seed(sales): `domain/demo/service.test.ts`

## Coverage policy

`backend/vitest.config.ts` enforces 100% lines on an explicit allow-list (`env`, `client/constants`, `sale/stock`, `sequence/service`). Expand gradually: add a module to `coverageInclude` only together with full branch tests.

Planned next domains: finance `validators`/`normalizers` (near-ready), thin route matrices.

## CI (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

- **Triggers:** `push` to `main`/`master`, all `pull_request`
- **Runner:** `ubuntu-latest`, Node **20**
- **Jobs (parallel):** `backend`, `frontend`
- **Backend:** lint → typecheck → `vitest run` → build
- **Frontend:** lint → typecheck → build (**no** full Vitest on CI — run locally)
- **No Mongo/Docker/secrets** — backend integration suite mocks mongoose
- **Concurrency:** cancels in-progress runs for the same ref

Local full gate (includes frontend tests):

```bash
npm run verify
# frontend tests only:
npm run test:frontend
```

## CI expectations

1. Backend `npm test` passes on CI.
2. Frontend Vitest runs **locally** (`npm run test:frontend`); CI gates frontend via lint + typecheck + build.
3. `npm run build` passes in both packages before release.
4. Integration tests must not require Docker MongoDB (mongoose models mocked in API suite).
5. New protected routes need entries in `api.integration.test.ts` or dedicated `*.routes.test.ts`.