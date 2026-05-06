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

## Phase 2 Status (2026-05-06)

- Implemented optimistic concurrency for update operations in products, sales, and client-devices using expectedUpdatedAt.
- Backend now returns 409 Conflict when stale data is submitted.
- Frontend update flows send expectedUpdatedAt and auto-refresh on conflict with user-facing retry message.


## Phase 3 Status (2026-05-06)

- Added @tanstack/react-query and QueryClientProvider in frontend root.
- Introduced shared query keys and query client config (staleTime, focus/reconnect refetch).
- products, sales, and client-devices are now loaded via React Query in dashboard effects.
- Manual refresh actions now use invalidateQueries + etchQuery for consistent cache/state sync after mutations.

- Polling configured for shared collections (products, sales, client-devices) every 30 seconds.
- Critical mutation flows now rely less on manual local array patching and more on query-backed refresh (products/sales/client-devices).
- Added useMutation wrappers for critical product/sale/client-device writes; actions now execute mutations and rely on query invalidation/refresh for consistency.
- Extended mutation wrappers to archive/delete product and delete sale flows with query invalidation.
- Added mutation wrappers for service/client writes and switched dashboard actions to call them (query invalidation-driven consistency).
