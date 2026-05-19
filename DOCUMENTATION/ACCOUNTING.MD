# Accounting Logic

## Purpose
This document defines financial behavior for supplier-order related operations in the `Accounting` workspace and shared order modal behavior.

## Transaction Tab Rules
- In `Accounting -> Транзакції`, notes that reference supplier order identifiers must be clickable.
- Clickable patterns are parsed from note text by token after `замовлення` or `order`.
- Clicking such note opens supplier order details in a modal.
- The modal opened from `Accounting -> Транзакції` is strictly read-only.

## Supplier Order Lock Rules
- Once supplier order passes receipt stage `Оприбутковано` (`status = stocked` or `receiptStatus = received`), order content fields are locked.
- Locked fields include supplier, delivery date, supply type, order number, note, item name, quantity, and price.
- In locked mode, save and mutation actions are unavailable; only viewing and closing are allowed.

## Financial Queue Rules
- Supplier order payment queue in `Accounting -> Замовлення` includes orders with:
  - `paymentStatus = pending`
  - `status in [approved, stocked]`
- Payment operation remains available for these statuses according to existing payment flow.

## Cross-Module Consistency
- Any status transition that changes finance visibility must trigger finance refresh event:
  - `project-goods:finance-updated`
- Read-only modal behavior must be reused across modules to avoid divergent financial UX and logic.
