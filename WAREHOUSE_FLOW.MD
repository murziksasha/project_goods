# WAREHOUSE FLOW

## Purpose
This document defines current warehouse requirements for stock balances, receipts, and procurement-linked behavior.

## Navigation
- Warehouse tabs: `Stock balances`, `Receipts`, `Transfers`, `Settings`
- Related flow docs: [ORDER_FLOW.md](./ORDER_FLOW.md), [SALE_FLOW.md](./SALE_FLOW.md), [ACCOUNTING.MD](./ACCOUNTING.MD)

## Stock Balances Requirements

### 1) Column Visibility
- Column visibility menu (gear icon) is available in `Stock balances`.
- `Select` is locked and cannot be hidden.
- `Qty` and `Retail` are removed from the feature and from table layout.
- Active stock columns:
1. `Select`
2. `Name`
3. `Serial #`
4. `Article`
5. `Date`
6. `Purchase`
7. `Warehouse`
8. `Location`
9. `Client order`
10. `Supplier order`
11. `Supplier`
12. `Note`
13. `Action`

### 2) Supplier Column Source of Truth
- `Supplier` in `Stock balances` must show supplier where goods were bought.
- Value priority:
1. supplier name from linked supplier order (`supplierOrdersByProductId[product.id][0].supplierName`)
2. fallback to legacy product field `purchasePlace`
3. fallback `-`

### 3) Product Warehouse Mapping Priority
- Stock display mapping priority:
1. `product.warehouseId` + `product.locationId`
2. fallback by `purchasePlace` (warehouse name match)
3. fallback to first configured warehouse/location

### 4) Return/Unbind Rule
- When product is unlinked from order and returned to stock, it must return to original warehouse/location.
- Source of truth: stored product warehouse metadata, not transient modal selection.

## Receipts Requirements

### 5) Receipts Source
- `Warehouse -> Receipts` is projected from supplier orders.
- One supplier order with multiple items is rendered as multiple receipt rows.

### 6) Row Click Behavior
- Click `#` -> open `SupplierOrderModal` by `supplierOrderId`.
- Click `Product` -> open product editor from catalog.
- Click `Supplier` -> open supplier editor from suppliers catalog.
- If catalog/supplier entity is not found, show explicit error toast.

### 7) Status/Cancel Projection
- Cancel action in receipt-linked supplier order must project receipt row status as `Cancelled`.
- Projection rule: if `status = cancelled` OR `paymentStatus = cancelled`, row state is `cancelled` regardless of previous `receiptStatus`.

### 8) Take-On-Charge Availability
- Action `Оприбуткувати` in receipt-linked supplier order is allowed regardless of payment state (`pending` / `paid`).
- Locks for action/edit:
1. `receiptStatus = received`
2. `status = cancelled`
3. `paymentStatus = cancelled`

### 9) New Receipt Order Initial State
- New supplier order created from `Warehouse -> Receipts` starts as `approved` (not auto-`stocked`) to allow later receiving.

### 10) Per-Unit Materialization
- Take-on-charge creates one product row per unit (`quantity = 1` each), each with unique `serialNumber`.

### 11) Warehouse/Location Required On Take-On-Charge
- Operator must select `warehouse` and `location`.
- API payload must include `warehouseId` and `locationId`.

## Global UI Requirement

### 12) Horizontal Scrollbar Accessibility
- If horizontal overflow appears, scrollbar must remain accessible at the bottom of app window.
- Implemented via global shared component `GlobalHorizontalScrollbar`.
- The component is mounted once in `DashboardPage` and synchronizes with visible `.catalog-table-wrap`.

## Notes
- This document is normative for warehouse UI/UX and data mapping.
- Any warehouse behavior changes must update this file in the same task.
