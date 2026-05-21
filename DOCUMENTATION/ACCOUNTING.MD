# Accounting Logic

## Purpose
This document defines financial behavior for supplier-order related operations in the `Accounting` workspace and connected Warehouse flows.

## Transactions Tab Rules
- In `Accounting -> Транзакції`, notes that reference supplier order identifiers are clickable.
- Clickable patterns are parsed from note text by token after `замовлення` or `order`.
- Clicking such note opens supplier order details in a modal.
- The modal opened from `Accounting -> Транзакції` is strictly read-only.

## Supplier Order Lock Rules
- Once supplier order passes receipt stage `Оприбутковано` (`status = stocked` or `receiptStatus = received`), order content fields are locked.
- Locked fields include supplier, delivery date, supply type, order number, note, item name, quantity, and price.
- In locked mode, save and mutation actions are unavailable; only viewing and closing are allowed.

## Financial Queue Rules (`Accounting -> Замовлення`)
- Supplier order payment queue includes orders with:
  - `paymentStatus = pending`
  - `status in [approved, stocked]`
  - `total > 0`
- Supplier orders with zero total (free-of-charge receipts) are allowed in Warehouse flows, but must not appear in this payment queue.

## Payment Actions in Accounting
- `Оплатити`:
  - Creates finance withdraw transaction.
  - Sets `paymentStatus = paid`.
- `Видати без оплати`:
  - Requires explicit confirmation in modal dialog.
  - Does not create finance transaction.
  - Sets `paymentStatus = without_payment`.

## Zero-Total Supplier Orders
- If supplier order total is `0`, after take-on-charge flow the order must be finalized as `paymentStatus = without_payment`.
- Backend also auto-normalizes already existing orders:
  - If `total = 0`, `paymentStatus = pending`, and receipt/order is already approved/received/stocked, status is auto-switched to `without_payment`.

## Warehouse Receipts Payment Column
- In `Warehouse -> Receipts`, orders with `paymentStatus = without_payment` are shown as text:
  - `without payment`
- This value is styled as highlighted red text.

## Cross-Module Consistency
- Any status transition that changes finance visibility must trigger finance refresh event:
  - `project-goods:finance-updated`
- Warehouse receipts must refresh on this event to reflect latest payment status changes.
- Read-only modal behavior must be reused across modules to avoid divergent financial UX and logic.

## Transaction-to-Order Navigation (Payment/Refund)
- In `Accounting -> Transactions`, notes for payment/refund operations are clickable when they include an order token:
  - `Payment for order <token>`
  - `Refund for order <token>`
  - `Оплата замовлення <token>`
- Resolution priority for `<token>`:
  - 1) Sales/Service orders by `sale.recordNumber` or `sale.id`.
  - 2) Supplier orders by `order.number` or `order.orderBaseId`.
- Click behavior:
  - If sales/service order is resolved: open that order card in `Orders` workspace.
  - If supplier order is resolved: open supplier order modal in read-only mode.
