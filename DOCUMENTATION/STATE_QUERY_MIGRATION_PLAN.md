# State Query Migration Plan

## Goal

Move backend-owned dashboard data to TanStack Query while keeping component-local
state limited to UI concerns: modals, selected ids, drafts, filters, pagination,
expanded panels, and active tabs.

## Current Inventory

### Already Query-backed

- `products`, `sales`, `clientDevices`, `clients`, `services`, and
  `catalogProducts` have query keys and mutation invalidation in the dashboard
  flow, but `useDashboardPage` still mirrors query results into local arrays.
- `supplierOrders` and `warehouseSettings` have dedicated query hooks and are
  already used by warehouse screens.
- Accounting finance data now has query keys, query hooks, and mutation hooks
  for active cashboxes, all cashboxes, currencies, transactions, reports, and
  supplier-order payment queue. `AccountingPanel` uses these mutation hooks for
  cashboxes, currencies, transactions, transfer cancellation, supplier-order
  payment, and issue-without-payment flows.

### Partially Migrated

- `useDashboardPage.ts` still owns many server arrays with `useState`:
  `allProducts`, `clientDevices`, `suppliers`, `allClients`, `sales`,
  `catalogProducts`, `services`, `allEmployees`, and `settings`.
- `dashboard-actions.ts` performs many manual local patches after mutations and
  then refreshes server data. Supplier/employee mutations now use
  `refreshSuppliers` / `refreshEmployees` query invalidation.
- `OrdersWorkspace.tsx` now uses `useSupplierOrdersQuery` for order card
  supplier-order context (enabled when a sale card is open).
- `AccountingPanel.tsx` still calls `refreshFinance` after mutation success to
  preserve current UI timing, but the mutations themselves now invalidate finance
  query keys through `financeApi.ts`.

### Still Manual

- `employees`, `suppliers`, and app `settings` use query hooks in
  `use-dashboard-effects.ts`, but results are still mirrored into dashboard
  local state. Next step: read query data directly in consumers.
- Order workspace UI stores saved filters, active filters, pagination, visible
  columns, status menu state, and modal state locally. These are UI state and
  should remain local or persisted in `localStorage`.
- Cashbox card ordering is local user preference and should remain local. The
  cashbox records and balances themselves are server state.

## Migration Order

1. Orders supplier data: replace manual `getSupplierOrders` usage inside
   `OrdersWorkspace.tsx` with `useSupplierOrdersQuery`.
2. Dashboard root: remove mirrored server arrays from `useDashboardPage` one
   entity at a time, starting with `catalogProducts`, `services`, and `clients`.
3. Employees/suppliers/settings: add query keys and hooks, then move dashboard
   consumers to query results.
4. Manual local patches: keep only optimistic UI updates that have explicit
   rollback; otherwise rely on mutation success + query invalidation.

## Acceptance Rules

- Backend-owned lists must have a query key, query hook, and mutation invalidation
  path.
- Component state should not duplicate query data unless it is a local projection
  such as user-defined ordering or draft edits.
- Mutations that affect stock, sales, cashboxes, supplier orders, or clients must
  invalidate every affected query key.
- Every migration step should keep existing tests passing before moving to the
  next entity.
