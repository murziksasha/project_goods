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

## Next Additions
- Add edge-case decisions (duplicate names, archived catalog items, deleted suppliers).
- Add validation standards for procurement edits.
- Add API contract notes for supplier-order -> receipt projection.
