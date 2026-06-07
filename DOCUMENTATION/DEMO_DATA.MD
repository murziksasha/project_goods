# Demo Data Erase Rules

## Purpose
This document defines what must be removed when `Erase all data` is triggered from dashboard main tab.

## Erase Contract
- `Erase all data` is available only to Temporary Admin: active `owner` with username `admin`.
- Backend must reject direct erase requests from every other employee.
- Backend must create a completed safety backup before deleting data; if backup creation fails, erase must not start.
- Keep: `employees`.
- Delete all business/demo data and catalogs.
- UI after erase must reflect empty collections without requiring manual page reload.
- Successful erase responses include `safetyBackupId`.

## Backend Collections To Clear
Source of truth: `backend/src/domain/demo/service.ts` -> `eraseAllDataExceptEmployees`.

- `Sale`
- `Client`
- `Product`
- `CatalogProduct`
- `Supplier`
- `SupplierOrder`
- `ServiceCatalog`
- `ClientDevice`
- `Cashbox`
- `FinanceTransaction`
- `Settings`
- `Sequence`

## Frontend State Expectations
- Main dashboard state resets products/clients/sales/catalog list.
- Warehouse receipts must not keep stale local rows after erase.
- Supplier orders/receipts views should show empty data after next fetch.

## Change Policy
- When a new persistent domain entity is added, update:
  1. `eraseAllDataExceptEmployees` in backend.
  2. This `DEMO_DATA.MD` list.
  3. Any frontend local caches/state tied to that entity.
- Backend run rule:
  - Development: use `cd backend && npm run dev` (uses `src` directly).
  - Production-like local run: `npm start` now has `prestart` and always rebuilds `dist` before launch.
