# WAREHOUSE FLOW

## Purpose
This document is a living specification for warehouse procurement and receipts flow.
We keep current behavior here and extend it as new rules appear.

## Current Rules (as-is)

### 1) Receipts Source
- Receipts list in `Warehouse -> Receipts` is built from supplier orders.
- One supplier order with multiple items is shown as multiple receipt rows (`orderIndex-itemIndex` style numbering).
- Manual receipt rows can exist, but supplier-order rows are the main procurement flow.

### 2) Open Order Behavior
- Click on `#` in Receipts table opens supplier order edit modal (`SupplierOrderModal`) for that receipt row's `supplierOrderId`.
- If row has no linked supplier order, order modal is not opened.

### 3) Product Click Behavior
- Click on `Product` in Receipts table opens product edit modal from Products catalog.
- Matching is currently by product name (case-insensitive, trimmed compare) against catalog products.
- If product is not found in catalog, show error: `Product not found in Products catalog.`

### 4) Supplier Click Behavior
- Click on `Supplier` in Receipts table opens supplier edit modal from Suppliers catalog.
- Matching priority:
1. supplier name (case-insensitive, trimmed compare)
2. fallback by supplierId from linked supplier order
- If supplier is not found, show error: `Supplier not found in Suppliers catalog.`

### 5) Edit Scope
- Product modal edits catalog product (`name`, `note`, `isActive`).
- Supplier modal edits supplier (`name`, `phone`, `note`, `supplierOrder`, `isActive`).
- After successful save:
1. show success message
2. refresh supplier orders in warehouse receipts
3. close modal

### 6) Non-goals / unchanged logic
- Status, payment, totals, sorting, pagination remain unchanged.
- Receipt order creation/edit flow remains unchanged.
- Only click outcomes for `Product` and `Supplier` fields were adjusted.

### 7) Cancel From Receipt Modal (Delete action)
- In `Warehouse -> Receipts`, clicking `Delete` inside supplier-order modal cancels the linked supplier order through API cancel action.
- After cancel:
1. Receipt row status is projected as `Cancelled` (red badge) in Receipts table.
2. Projection rule: if supplier order has `status = cancelled` OR `paymentStatus = cancelled`, receipt row must be shown as `cancelled` regardless of previous `receiptStatus`.
- In `Orders -> Supplier Order`:
1. Order status field becomes read-only for cancelled orders (same UX pattern as `Оприбутковано`).
2. Read-only label must be `Скасований`.
- In supplier-order modal:
1. Cancelled orders open in read-only mode (inputs/actions for editing disabled).
2. This lock is equivalent in behavior to already received/stocked lock.

### 8) Take-On-Charge Availability From Receipts Modal
- Entry point: `Warehouse -> Receipts -> receipt row (#) -> SupplierOrderModal`.
- For an existing supplier order opened from Receipts, action button `Оприбуткувати` must be available regardless of payment state (`pending` or `paid`).
- Payment state must not block warehouse receiving action.
- Order may be edited and then received later in a separate open/reopen cycle.
- Lock conditions for take-on-charge button and edit actions:
1. `receiptStatus = received` (already received)
2. `status = cancelled`
3. `paymentStatus = cancelled`
- `status = stocked` alone is not a lock condition for `Оприбуткувати`.

### 9) New Receipt Order Initial State
- When receipt order is created from `Warehouse -> Receipts -> receipt order`, it must stay receivable later.
- Initial status for a newly created supplier order in this flow is `approved` (not auto-`stocked`).
- Expected operator flow:
1. Create receipt order
2. See row in Receipts with `new/approved` progression
3. Reopen same order
4. Click `Оприбуткувати` and complete serial-number modal flow

### 10) Per-Unit Stock Materialization
- Take-on-charge (`Оприбуткувати`) must materialize stock per unit, not as an aggregated quantity line.
- If supplier-order item has `quantity = N`, warehouse stock must receive `N` separate product rows.
- Each created row must have:
1. `quantity = 1`
2. its own unique `serialNumber`
3. common item metadata copied from receipt context (name, price, supplier/purchase place, note, purchase date)
- Rows with identical product name are allowed and expected in stock.

### 11) Take-On-Charge UX/Error Behavior
- On successful take-on-charge:
1. serial modal closes
2. supplier-order modal closes
3. receipts list refreshes
4. stock balances reflect created rows
- On failed take-on-charge:
1. modal remains open
2. explicit error toast/message is shown
3. no partial success should be presented as completed action

## Next Additions
- Add edge-case decisions (duplicate names, archived catalog items, deleted suppliers).
- Add validation standards for procurement edits.
- Add API contract notes for supplier-order -> receipt projection.
