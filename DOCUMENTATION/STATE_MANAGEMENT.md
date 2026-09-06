# State Management and Multi-User Roadmap

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [API.md](./API.md) · [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md) · [index](./README.md)

## Current State (implemented)

- Server collections live in TanStack Query (`products`, `sales` compact lists, `clients`, catalog, services, employees, suppliers, settings).
- `useDashboardPage` still owns forms, filters, and mutation orchestration (`dashboard-actions.ts`).
- Sales **list** uses `compact=1` (no `timeline` / `paymentHistory`). Order/sale cards load the full document via `GET /sales/:id` (`useSaleDetail`).
- Orders/Sales tables request `GET /sales?page&pageSize` (`{ items, total, page, pageSize }`). Kanban loads visible statuses with `pageSize=500`. Command palette still uses a capped compact dump (`limit=500`).
- Queries are page-scoped where safe (warehouse/catalog/clients). Sales stay loaded for command palette.
- Polling is visibility-aware (15s on the active orders/stock/clients surface, including the Kanban orders tab; paused when the tab is hidden).
- `GET /api/events/stream` (SSE) invalidates matching query keys after mutations so other LAN users refresh without a full reload.
- UI shows `Last sync` time in topbar.
- Optimistic concurrency: `409` reloads latest data and asks the user to retry.

## Goal

Support stable concurrent work for 3-5 users with minimal conflicts and stale data issues.

## Phase Plan

1. Phase 1: Safe refresh after mutations
- Add targeted refetch after create/update/delete for critical entities.
- Keep local optimistic updates, but sync with backend right after.
- Expose sync timestamp in UI.

2. Phase 2: Optimistic concurrency control
- Add version checks (`updatedAt` or `__v`) in update endpoints.
- Return `409 Conflict` on stale updates.
- Frontend handles `409` by reloading latest data and notifying user.

3. Phase 3: Query cache layer
- Migrate server-state to TanStack Query.
- Use `invalidateQueries` after mutations.
- Configure focus/reconnect refetch and reasonable `staleTime`.

4. Phase 4: Near real-time updates
- Visibility-aware polling on the active workspace.
- SSE `GET /api/events/stream` (`resource.changed`) → `invalidateQueries`.

5. Phase 5: Backend transaction hardening
- Wrap stock/payment critical paths in Mongo transactions.
- Ensure atomic updates and race-safe conditions.

## Operational Rule

For any mutation that can affect shared screens (orders, sales, stock, client devices), backend is source of truth and frontend must refresh corresponding collections immediately.

## Filters Persistence Rule (2026-05-08)

- Filter and search settings must persist across browser reload (`F5`) for all dashboard workspaces that expose filters/search.
- Persisted state must be restored automatically on page load and immediately applied to the list/query result.
- This includes at least: Orders filters, Clients filters, Supplier Orders filters, Warehouse search/filter mode, and dashboard-level catalog/orders search inputs.
- `Orders -> Supplier Order` and `Orders -> Information` share the supplier-order filter state, so the analytics tab reflects the same persisted search/status/payment/date/starred working set as the supplier-order table.
- `Orders` and `Sales` each persist their active `favoritesOnly` starred filter with the rest of the order filters.

## Dashboard Settings Storage Rule (2026-06-23)

- **Settings → Dashboard** tab fields (`dashboardPreferences`) are **server state**: persisted in **MongoDB** via `PUT /api/settings` when the user clicks **Save settings**.
- Until Save, dashboard tab edits exist only in in-memory `settingsForm` and are lost on reload.
- **Market & weather widget** display overrides (collapse, hidden currencies/providers, per-browser location/view toggles) are **client state** in `localStorage` key `project-goods.dashboard-widget-overrides`; they apply immediately and are not shared across browsers or users.
- Effective widget behavior = MongoDB defaults merged with local overrides (`getEffectiveDashboardWidgetSettings`).
- Full field list, API flow, and merge rules: [BUSINESS_DASHBOARD.md](./BUSINESS_DASHBOARD.md#settings-storage-dashboard-tab-vs-widget-drawer).
- **Print form layout** (content margins, page/label size, orientation) uses a two-layer model like dashboard widgets:
  - **Server (MongoDB)** — template content, blocks, titles, and other shared print-form fields saved through `PUT /api/settings` on **Save settings**.
  - **Browser localStorage (per employee)** — personal layout tuning in `project-goods.print-form-overrides.{employeeId}`; written only on **Save settings**, not while editing fields. Until Save, layout edits live in in-memory `settingsForm` and are lost on reload.
  - On load and for order printing, the frontend merges stored overrides onto server `printForms` for the logged-in employee (`applyPrintFormLocalOverrides`).
  - Full rules: [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md#content-margins-and-per-user-layout-storage).

## Tab Persistence Rule (2026-05-29)

- Active dashboard tabs must persist across browser reload (`F5`) so users return to the last working view instead of falling back to `Main`.
- The persisted tab state is stored in `localStorage` and restored automatically on mount unless a deeper navigation state explicitly overrides it.
- This applies to the main dashboard page, `Settings`, `Accounting`, `Products & Services`, `Clients & Suppliers`, `Warehouse`, and the nested workflow tabs inside create/edit cards.
- Nested examples that must remember their last tab: `Accounting -> Finance settings`, `Clients -> client card`, `Clients -> create client modal`, `Orders -> order detail related block`, and `Create order -> request tabs`.
- URL-driven navigation still wins when the user opens a specific page/tab via route or link, but ordinary refresh should preserve the last active tab selection.

## Browser Back/Forward Navigation (2026-06-22)

- In-app navigation must stay inside the SPA when the user presses browser **Back** or **Forward**.
- Implementation uses the native History API (`history.pushState` for user steps, `history.replaceState` only for auth, permission redirects, and one-time URL normalization).
- React Router is intentionally not used; overhead is one `popstate` listener in `DashboardPage` plus lightweight URL strings.
- **URL is the source of truth** during `popstate`; `localStorage` tab fallbacks apply on first load / empty URL, not when traversing history.
- Route-level state lives in query params (`page`, `ordersTab`, `saleId`, `createOrder`, `accountingTab`). Heavy payloads (sales lists, client history, workspace data) must not be stored in `history.state`.
- Central module: `frontend/src/pages/dashboard/model/dashboard-navigation.ts`.
- Full spec: [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md).

## Sidebar UI Persistence Rule (2026-05-19)

- Dashboard main menu collapsed/expanded state must persist across browser reload (`F5`).
- On page load, sidebar must restore to the last user-selected state without extra user action.

## Auth Session Recovery Rule (2026-06-14)

- If the session check fails because the current token is no longer valid (`401`), the app must clear stale auth state and take the user to the login screen so they can start a new session.
- A cached employee snapshot must **not** keep the workspace open on `401`. Snapshots are only for **network/timeout** failures so a brief offline blip does not kick the user out.
- `403` is permission denied, not session expiry, and must not clear the token.
- The user-facing message should explain that the session ended and that a new login is required.

## Multi-tab session and live updates (2026-08-29)

- Auth token and employee snapshot live in `localStorage`. Other tabs listen to the `storage` event (and an in-tab 401 interceptor) so logout / expired session in one window signs every window out.
- `GET /api/events/stream` is held by **one leader tab** (`navigator.locks` + `BroadcastChannel`). Hidden tabs release the stream so Chrome's HTTP/1.1 6-connection pool is not filled by SSE. Followers apply `invalidateQueries` from the channel.
- Stream reconnects on both error and clean close, with backoff. Backend `/events/stream` does not touch `lastUsedAt`.

## Phase 2 Status (2026-05-06)

- Implemented optimistic concurrency for update operations in products, sales, and client-devices using expectedUpdatedAt.
- Backend now returns 409 Conflict when stale data is submitted.
- Frontend update flows send expectedUpdatedAt and auto-refresh on conflict with user-facing retry message.


## Phase 3 Status (2026-05-06)

- Added @tanstack/react-query and QueryClientProvider in frontend root.
- Introduced shared query keys and query client config (staleTime, focus/reconnect refetch).
- products, sales, and client-devices are now loaded via React Query in dashboard effects.
- Manual refresh actions now use invalidateQueries + fetchQuery for consistent cache/state sync after mutations.

- Polling configured for shared collections (products, sales, client-devices) every 30 seconds.
- Critical mutation flows now rely less on manual local array patching and more on query-backed refresh (products/sales/client-devices).
- Added useMutation wrappers for critical product/sale/client-device writes; actions now execute mutations and rely on query invalidation/refresh for consistency.
- Extended mutation wrappers to archive/delete product and delete sale flows with query invalidation.
- Added mutation wrappers for service/client writes and switched dashboard actions to call them (query invalidation-driven consistency).

## Catalog Products State Update (2026-05-09)

- Added React Query key: `catalogProducts`.
- Added dashboard state slice: `catalogProducts`.
- Added loading flag: `isCatalogProductsLoading`.
- Added refresh/update flow for `catalog-products` through `useDashboardPage` actions.
- `ProductCatalogPanel` consumes `catalogProducts` and `onUpdateCatalogProduct`.

## Dashboard Query Cache Update (2026-07-12)

- Added React Query keys: `employees`, `suppliers`, `settings`.
- `use-dashboard-effects.ts` loads employees, suppliers, and settings through dedicated query hooks instead of one-off `Promise.allSettled` fetch.
- Supplier/employee/settings mutations in `dashboard-actions.ts` invalidate and refetch through `refreshSuppliers`, `refreshEmployees`, `refreshSettings`.
- `OrdersWorkspace` order card uses `useSupplierOrdersQuery` (enabled when a sale card is open and user has supplier-order read access).
- `DashboardPage` shell sidebar/topbar extracted to `widgets/dashboard-sidebar` and `widgets/dashboard-topbar`.

## Warehouse Query Cache Update (2026-06-03)

- Added React Query keys: `supplierOrders` and `warehouseSettings`.
- `WarehousePanel` now reads supplier orders through `useSupplierOrdersQuery` instead of storing fetched supplier orders in component state.
- `useSupplierOrdersQuery` supports an `enabled` flag; `WarehousePanel` disables it when the current employee lacks `supplierOrders.view` / `supplierOrders.manage` to avoid forbidden supplier-order reads.
- Supplier-order create/update/cancel/take-on-charge flows now use mutation hooks and invalidate `supplierOrders`; take-on-charge also invalidates `products`.
- `WarehousePanel` now reads warehouse settings through `useWarehouseSettingsQuery`.
- Warehouse settings save now uses `useUpdateWarehouseSettingsMutation` and invalidates `warehouseSettings`.
- Receipt rows from supplier orders are derived from query data; manually created local receipt rows remain local UI/session state.
- Warehouse receipt filters include a multi-select receipt status filter (`statuses: ReceiptStatus[]`; empty array means all statuses) and a starred-supplier-orders-only option with toolbar quick star toggle. The starred filter shows only receipts linked to supplier orders with `isFavorite = true`; manual receipt rows are excluded while this filter is active. Legacy saved filters with a single `status` field are migrated to `statuses` on load.

## Saved named filters (server, per creator)

- **Named** saved filters (orders workspace, warehouse, clients/suppliers, product catalog) persist in MongoDB via `GET/POST/DELETE /api/saved-filters` and belong to the **creating employee**.
- Orders workspace `tab` values: `orders`, `sales`, `kanban`, `supplierOrders`.
- Same employee sees their filters on any browser/device after login; other employees never see them.
- Scopes: `orders` | `warehouse` | `clients` | `catalog`; `tab` selects list sub-tab.
- **Active/draft** filter form state (what is currently applied in the panel) may still use `localStorage` per browser; only the **saved presets list** is server-backed.
- Warehouse workspace layout on this device (not synced): `project-goods.warehouse-filters` (tab, search, pagination, `stockView`, `receiptsView`), `project-goods.warehouse-columns` (column visibility), `project-goods.warehouse-stock-name-width` (stock `Name` column width, 180–720px).
- One-time client migration: if the server list is empty, legacy `localStorage` presets for that employee are POSTed and the old storage key is cleared.
