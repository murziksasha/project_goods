# State Management and Multi-User Roadmap

## Current State (implemented)

- Frontend state is centralized in `useDashboardPage` with React `useState`.
- Initial loading is done in `use-dashboard-effects.ts`.
- Mutations are orchestrated in `dashboard-actions.ts`.
- After critical mutations we perform server refresh (`safeRefresh`) for affected entities.
- UI shows `Last sync` time in topbar.

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
- Start with polling (10-30s) for sales/stock.
- Optionally switch to WebSocket/SSE events (`sale.updated`, `stock.changed`, `client.updated`).

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

- If the session check fails because the current token is no longer valid, the app must clear stale auth state and take the user to the login screen so they can start a new session.
- The workspace must not stay open on a failed session check when recovery requires a fresh sign-in.
- The user-facing message should explain that the session ended or could not be verified and that a new login is required.

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

## Warehouse Query Cache Update (2026-06-03)

- Added React Query keys: `supplierOrders` and `warehouseSettings`.
- `WarehousePanel` now reads supplier orders through `useSupplierOrdersQuery` instead of storing fetched supplier orders in component state.
- `useSupplierOrdersQuery` supports an `enabled` flag; `WarehousePanel` disables it when the current employee lacks `supplierOrders.view` / `supplierOrders.manage` to avoid forbidden supplier-order reads.
- Supplier-order create/update/cancel/take-on-charge flows now use mutation hooks and invalidate `supplierOrders`; take-on-charge also invalidates `products`.
- `WarehousePanel` now reads warehouse settings through `useWarehouseSettingsQuery`.
- Warehouse settings save now uses `useUpdateWarehouseSettingsMutation` and invalidates `warehouseSettings`.
- Receipt rows from supplier orders are derived from query data; manually created local receipt rows remain local UI/session state.
- Warehouse receipt filters include a starred-supplier-orders-only option and toolbar quick star toggle. They show only receipts linked to supplier orders with `isFavorite = true`; manual receipt rows are excluded while this filter is active.
