# Accounting Logic

## Purpose
This document defines financial behavior in the `Accounting` workspace (cashboxes, transactions, supplier order payments, etc.) and connected flows in Warehouse and Orders.

## Transactions Tab (`Accounting -> Транзакції`)

### Notes column behavior
- The **Note** column shows the transaction note (or `-` if empty).
- Most notes are interactive:
  - Notes matching documented payment/refund patterns are treated as **order links** (see below).
  - All other notes with content are **editable**: clicking the note text opens the **"Transaction note"** modal (a simple textarea editor).
    - Save calls `PATCH /finance/transactions/:transactionId`.
    - Empty notes are allowed (note can be cleared).
    - Max length 300 characters (trimmed on save).
- Editing is only permitted on active transactions. Cancelled transactions and reversal/cancellation transactions cannot have their notes changed.
- Notes are always visible (even for system-generated payment notes).

### Action column
- Shows a **"Cancel transfer"** button only for eligible cashbox-to-cashbox transfers (see Transfer Cancellation Rules below).

### Transaction-to-Order Navigation (Payment/Refund)
- Notes for payment and refund operations are parsed when they match these patterns:
  - `Payment for order <token>`
  - `Refund for order <token>`
  - `Оплата замовлення <token>`
- Resolution priority for `<token>`:
  1. Sales or Service orders (by `sale.recordNumber` or `sale.id`)
  2. Supplier orders (by `order.number` or `order.orderBaseId`)
- Click behavior:
  - **Sales / Service orders**: opens the order in a **new browser tab** in the Orders workspace (`?page=orders&ordersTab=orders&saleId=...` or `ordersTab=sales` for regular sales).
  - **Supplier orders**: opens the supplier order in a **read-only modal** (same behavior as before).
- Non-matching notes (manual deposits, withdraws, transfers, free-text, etc.) do **not** attempt order navigation — arbitrary text containing the word "order" is not treated as a link. They render as plain clickable text for note editing (if they contain content).

## Transfer Cancellation Rules
- Only active cashbox-to-cashbox transfer transactions can be cancelled.
- Cancellation is available only until the end of the transaction's business day.
- Business day is calculated in `Europe/Kiev` until company timezone settings exist.
- After the transaction business day ends, `Cancel transfer` is hidden in the UI.
- Backend must reject old transfer cancellation attempts with:
  - `Transfer can be cancelled only during the transaction day.`
- Cancellation creates a linked reverse transfer and marks the original transaction as `cancelled`.

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

## Transactions Table Visual + Total Rules
- Type color coding:
  - `Deposit` is shown in green.
  - `Withdraw` is shown in red.
- `Total` column shows post-transaction balance for the affected side:
  - `Withdraw` and `Transfer`: balance of source cashbox (`From`) after transaction.
  - `Deposit`: balance of destination cashbox (`To`) after transaction.

## Cashbox Card Action Prefill Rules
- Clicking a cashbox card action opens the operation form with fields prefilled from that specific cashbox.
- `Deposit`: `To cashbox` is preselected as the clicked cashbox.
- `Withdraw`: `From cashbox` is preselected as the clicked cashbox and `To cashbox` stays empty.
- `Transfer`: `From cashbox` is preselected as the clicked cashbox and `To cashbox` is preselected to another valid cashbox.

## Accounting Settings Access
- In `Accounting`, a gear button is shown on the right side of the tabs row.
- Clicking gear opens `Accounting settings` panel without leaving the page.
- Top tab label is `Information` (renamed from `Reports`).

## Cashbox Settings Rules
- `Cashboxes` settings section supports:
  - create cashbox,
  - rename cashbox,
  - deactivate/reactivate cashbox.
- Cashbox delete is not supported.
- Default cashbox cannot be deactivated.
- Deactivated cashboxes stay visible in settings and are rendered in muted/greyed style.
- Transactions/cashbox runtime lists continue to use active cashboxes only.

## Currency Settings Rules
- `Currencies` settings section supports creating and archiving finance currency codes.
- New currencies are stored in MongoDB and become full transaction currencies for `deposit`, `withdraw`, and `transfer`.
- New currencies are added to every cashbox with zero balance and disabled receiving by default.
- Archived currencies cannot receive deposits or incoming transfers, but existing positive balances remain visible and can be withdrawn.

## Cashbox Currency Visibility Rules
- System currency visibility for cashboxes is stored in MongoDB per cashbox, not in browser-local user preferences.
- `UAH` is always enabled for every cashbox and cannot be disabled.
- `USD` and all custom currencies exist for every current and future cashbox, but are disabled by default.
- Enabling a non-UAH currency in one cashbox setting is global for all users because it updates that cashbox document in the database.
- If a currency is disabled for a cashbox but its balance is greater than zero, the balance remains visible as `Withdraw only`.
- Disabled currency cashboxes cannot receive deposits or incoming transfers in that currency; withdrawing existing balance is allowed.

## Concurrency Safety Rules
- Finance mutations must use MongoDB transactions when the database is connected as a replica set.
- Cashbox debits must use conditional atomic updates so the balance can never become negative under concurrent requests.
- Transfer and cancellation flows must update balances and transaction records in one transaction.
- Manual transaction requests may include an optional idempotency key; repeated requests with the same key return the existing transaction.
