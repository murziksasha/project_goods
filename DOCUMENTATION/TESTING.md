# Testing Guide

## Commands

| Scope | Command | Notes |
|-------|---------|-------|
| Frontend unit/UI | `cd frontend && npm test` | Vitest + Testing Library |
| Frontend watch | `cd frontend && npm run test:watch` | |
| Frontend coverage | `cd frontend && npm run test:coverage` | |
| Backend unit + integration | `cd backend && npm test` | Vitest, no live MongoDB required |
| Backend coverage | `cd backend && npm run test:coverage` | Strict 100% on listed modules only |
| Lint | `npm run lint` (per package) | |

## Frontend structure

- Co-located `*.test.tsx` / `*.test.ts` next to components and hooks.
- High-value suites: `OrdersWorkspace`, `OrderDetailCard`, `CreateOrderCard`, `AccountingPanel`, `DashboardPage`.
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

## CI expectations

1. `npm test` passes in `frontend/` and `backend/`.
2. `npm run build` passes in both packages before release.
3. Integration tests must not require Docker MongoDB (mongoose models mocked in API suite).
4. New protected routes need entries in `api.integration.test.ts` or dedicated `*.routes.test.ts`.