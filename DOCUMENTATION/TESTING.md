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
| Frontend proxy (node:test) | `npm run test:proxy --prefix frontend` | Also runs at the end of `npm test` in `frontend`. Forwarding headers + static path boundary |
| Deployment scripts (node:test) | `npm run test:deployment` | Root. `.env.production` parsing, Docker volume/project preflight, clean checkout, ignore rules, prod ops, `update:prod` health gate, rollback keeps MongoDB auth (`docker:rollback:noauth` requires explicit confirmation) |

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

- `e2e/invoice-print.spec.ts` — Invoice without VAT / Invoice with VAT for sale/repair records,
  service-center phone, products-only/services-only/both/empty visibility in modal
  and standalone preview, Ukrainian invoice captions, shared Completion act behavior,
  block-builder editing, and included 20% VAT in the modal, standalone preview
  and builder (gross amount stays unchanged). Runs with both English and Ukrainian
  interfaces; checks Ukrainian captions, amounts in words (including 950 грн),
  currency and the preserved website language across all built-in documents.

- `e2e/login-page.spec.ts` — logged-out Login / Sign in.
- `e2e/orders-hover-copy.spec.ts` — Orders/Kanban copy controls, Sales current product/service name plus each S/N, and opened repair/sale card fields: independent hover targets, clipboard payloads, navigation, keyboard phone copy and `tel:` links, long-name containment, narrow viewport, and touch visibility.
- `e2e/sales-current-items.spec.ts` — Regular/Rapid sale card edits update the Sales Product label, serial, raw-row count and menu without a page reload; empty sales remain clickable and removed snapshot items do not match item search.
- `e2e/list-phone-search.spec.ts` — Orders, Sales, Clients, and Suppliers list search: Ukrainian and punctuated phones, additional numbers beside the primary, bare `+380`, serials, notes, manager names, the client filter, and the single-result count.
  - This spec mocks `/api/sales`; backend phone regex and server pagination behavior are verified by backend unit tests.
- `e2e/accounting-operation-modal.spec.ts` — **Confirm** (outline, stay open) and **Confirm and close** (filled); no large-amount warning.
- `e2e/repair-kanban-master-filter.spec.ts` — Kanban master menu: several coworkers plus Without master, chips, Clear back to All, saved filter, and Orders/Sales still a single assignee. Spec: [REPAIR_KANBAN_SPEC.md](./REPAIR_KANBAN_SPEC.md#master-filter-kanban-toolbar-only).

## Frontend structure

- Print language: `shared/lib/printFormatting.test.ts` checks fixed Ukrainian
  output across site languages, hryvnia/thousand gender, plurals and rounded kopecks.
  `printForms.test.ts` checks legacy/builder caption translation and preserves
  customer/item text; shared order-print tests compare full print data in both UI languages.

- Co-located `*.test.tsx` / `*.test.ts` next to components and hooks.
- High-value suites: `OrdersWorkspace`, `OrderDetailCard`, `CreateOrderCard`, `AccountingPanel`, `DashboardPage`.
- Opened-card phone dialing: `phoneFormatter.test.ts` covers local Ukrainian dial targets, separator removal, foreign country-code preservation, and incomplete prefixes. `OrderDetailCard.test.tsx` checks repair/sale links, canonical clipboard values, unchanged display, read-only cards, and missing-phone placeholders. `e2e/orders-hover-copy.spec.ts` checks the native `tel:` target alongside display and keyboard clipboard behavior in both card types. Dial-target rules: [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md#dial-links-in-opened-repair-and-sale-cards).
- Sales list current items: `sale-product.test.ts` (current primary row, individual/combined serials, empty/missing composition, removed snapshot search, article stock-ID guard); `OrdersWorkspace.test.tsx` (Regular/Rapid labels, independent product/service-name and serial copy, text opens the sale, empty-card link without copy, current-item search and filters, `+N` toggle/contents without opening the card); `orders-workspace-shared.test.tsx` (no snapshot serial fallback, raw-row count, qty price, above-placement pins to the trigger). Spec: [SALE_FLOW.md → Sales List Columns](./SALE_FLOW.md#sales-list-columns-orders---sales).
- Kanban master filter: `repair-kanban.test.ts` (All, one master, Without master, union, manager-created order with no master, assigned order excluded); `orders-workspace-shared.test.tsx` (`toKanbanFilters` migrates legacy `assigneeId` and clears it); `orders-sales-query.test.ts` (Kanban sends `masterIds` / `includeUnassignedMaster` and not `masterId`; Orders still sends `assigneeId`); `OrdersActiveFilterChips.test.tsx` (one chip per row, × removes one row, last × is All); `OrdersWorkspaceFilterPanel.test.tsx` (closed-field text and checkbox draft). Spec: [REPAIR_KANBAN_SPEC.md](./REPAIR_KANBAN_SPEC.md#master-filter-kanban-toolbar-only).
- Product grouping: `order-line-item-groups.test.ts` (card key + print key with price); `OrderDetailCard.test.tsx` (collapsed `×N` groups); `orders-workspace-shared.test.tsx` (print `products_table` / invoice merge-vs-split).
- Product model serial table: `product-model.test.ts` (latest batch, reserved-on-other-sale, supplier-order provenance); `ProductModelModal.test.tsx` (Latest / Reserved badges, serial + supplier-order hover copy, empty `—`). Nested modal Escape: `Modal.test.tsx`.
- Serial bind modal candidate row: `SerialBindModal.test.tsx` (purchase price, empty `—`, copy/click do not select serial); `OrderDetailCard.test.tsx` (number click opens existing supplier-order modal; bind dialog remains). Spec: [WAREHOUSE_FLOW.md §4.3.2](./WAREHOUSE_FLOW.md#432-bind-modal-candidate-row-purchase-price--supplier-order).
- Warehouse stock table: `WarehouseTables.test.tsx` (name/serial/client-order/supplier-order hover copy; badge click still opens).
- Supplier Order table: `SupplierOrdersWorkspaceSections.test.tsx` (number + product + supplier hover copy; parent `N items` / child `—` have no product/supplier icon; click still opens).
- Client card history: `ClientCardModal.test.tsx` (Orders/Sales number + serial hover copy; empty serial has no icon; number click still opens).
- Split workspace shells: `OrdersWorkspaceListHeader`, `OrdersWorkspaceTableSection`, `OrdersWorkspaceModals`.
- Query migration regression: `useDashboardPage.invalidation.test.ts` asserts `queryKeys` invalidation contract.

## Backend structure

- Domain services: `backend/src/domain/**/service*.test.ts` — business rules without HTTP.
- Sales list master query: `backend/src/domain/sale/list-sales-query.test.ts` — `masterIds` `$in`, `{ master: null }`, `$or`, invalid id dropped, legacy `masterId` unchanged. Spec: [API.md](./API.md).
- List phone search: `backend/src/shared/lib/phone-search.test.ts` and `backend/src/domain/sale/list-sales-query.test.ts` check generated phone regexes against canonical and legacy formatted values, partial Ukrainian prefixes, and Rapid sale aliases. Frontend matcher and list tests cover local filtering and matched additional-phone display.
- Route helpers: `backend/src/routes/sale.routes.test.ts`.
- **API integration:** `backend/src/routes/api.integration.test.ts` (supertest)
  - 401 without token / invalid token
  - 403 missing permission / non-owner settings / finance write / SO write / warehouse write / backups
  - sale update missing target → 404
  - smoke reads: products, clients, sales, settings
  - demo endpoints blocked when `NODE_ENV=production`
- Auth middleware unit: `backend/src/shared/middleware/auth.test.ts`.
- Release 1 hardening regressions:
  - `shared/lib/redact-mongo-credentials.test.ts` — URI credentials masked (incl. unencoded `@`), stack traces kept.
  - `domain/backup/service.test.ts`, `domain/backup/scheduler.test.ts`, `domain/archive/yearly-dump.test.ts` — failed backup/dump metadata, API errors, and logs never contain the Mongo password.
  - `shared/middleware/login-rate-limit.test.ts` — spoofed `X-Forwarded-For` does not change the limiter key; `config/env.test.ts` — `TRUST_PROXY_HOPS` capped at 1.
  - `domain/supplier/excel.test.ts` — supplier names are matched literally (escaped regex).
  - `shared/lib/mongo-session.test.ts` — transaction support detected via `hello` (works for the inventory-scoped user).
  - `scripts/admin-password.test.ts` — admin scripts refuse a missing/short `PROJECT_GOODS_ADMIN_PASSWORD`.
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
