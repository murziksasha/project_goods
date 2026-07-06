# Accounting Logic

## Purpose
This document defines financial behavior in the `Accounting` workspace (cashboxes, transactions, supplier order payments, etc.) and connected flows in Warehouse and Orders.

## Sub-Tab URL and Browser History (2026-06-22)

- Active accounting sub-tab is reflected in the URL as `accountingTab` when `page=accounting` (values: `cashboxes`, `transactions`, `orders`, `reports`).
- Switching tabs pushes a new browser history entry so **Back** / **Forward** restore the previous accounting view.
- Tab changes go through the shared dashboard navigator (`DashboardPage.navigateTo`); `useAccountingPreferences` persists the tab to `localStorage` but does not own a separate `popstate` listener.
- On history navigation, `DashboardPage` passes `syncedAccountingTab` into `AccountingPanel` to keep the UI aligned with the URL.

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
- Shows a type-specific cancel button for eligible manual `deposit`, `withdraw`, and `transfer` transactions (see Transaction Cancellation Rules below).

### Transaction-to-Order Navigation (Payment/Refund)
- Notes for payment and refund operations are parsed when they match these patterns:
  - `Payment for order <token>`
  - `Refund for order <token>`
  - `Оплата (за )?замовлення <token>`
  - `Supplier order payment: <token>` (backend fallback when note is omitted)
- Resolution priority for `<token>`:
  1. Sales or Service orders (by `sale.recordNumber` or `sale.id`)
  2. Supplier orders (by `order.number` or `order.orderBaseId`)
- Click behavior:
  - **Sales / Service orders**: opens the order in a **new browser tab** in the Orders workspace (`?page=orders&ordersTab=orders&saleId=...` or `ordersTab=sales` for regular sales).
  - **Supplier orders**: opens the supplier order in a **read-only modal** (same behavior as before).
- Non-matching notes (manual deposits, withdraws, transfers, free-text, etc.) do **not** attempt order navigation — arbitrary text containing the word "order" is not treated as a link. They render as plain clickable text for note editing (if they contain content).

## Transaction Cancellation Rules
- Active manual `deposit`, `withdraw`, and `transfer` transactions can be cancelled.
- Order-linked finance transactions cannot be cancelled from Accounting:
  - notes matching payment/refund order patterns (`Payment for order`, `Refund for order`, `Оплата замовлення`, etc.)
  - supplier-order payment notes (`Supplier order payment: ...`)
- Cancellation is available only until the end of the transaction's business day.
- Business day is calculated in `Europe/Kiev` until company timezone settings exist.
- After the transaction business day ends, the cancel button is hidden in the UI.
- Backend must reject old cancellation attempts with:
  - `Transaction can be cancelled only during the transaction day.`
- Cancellation creates a linked reverse transaction and marks the original transaction as `cancelled`:
  - `deposit` -> reverse `withdraw` from destination cashbox
  - `withdraw` -> reverse `deposit` into source cashbox
  - `transfer` -> reverse `transfer` between the same cashboxes

## Supplier Order Item Cancel (2026-07-03)
- `POST /supplier-orders/:supplierOrderId/cancel-item` cancels one line item (`items[].receiptStatus = cancelled`).
- Allowed even when `paymentStatus = paid` or `without_payment`.
- `total` is recalculated on save as the sum of non-cancelled line items only (current payable amount).
- `paymentStatus` is unchanged by item cancel.
- `paid` behavior:
  - `pending` orders keep `paid = 0`
  - newly paid orders set `paid = total` at payment time
  - already paid orders preserve historical `paid` when items are cancelled later (`Total` shrinks, `Paid` stays at the amount actually paid)
- Cancelled line items are shown with red product name in Supplier Order and Warehouse Receipts.
- Optional `reason` is appended to supplier-order `note` as `[ITEM_CANCELLED:<itemIndex>] ...`.

## Supplier Order Lock Rules
- Once supplier order passes receipt stage `Оприбутковано` (`status = stocked` or all items `receiptStatus = received`), order content fields are locked.
- Locked fields include supplier, delivery date, supply type, order number, note, item name, quantity, and price.
- In locked mode, save and mutation actions are unavailable; only viewing and closing are allowed.
- For `status = approved` that is not yet stocked/received, `SupplierOrderModal` must keep take-on-charge (`Оприбуткувати`) available in `Orders -> Supplier Order`, Warehouse receipts, and linked sale/order card flows.
- `paymentStatus = paid` or `without_payment` on an open order locks content editing and forbids modal Delete:
  - UI must hide the Delete button in `SupplierOrderModal`,
  - backend must reject `POST /supplier-orders/:supplierOrderId/cancel` with `Оплачений заказ не можна скасувати.`
- Paid / `without_payment` orders may still be closed manually through status badge `Cancelled` or `Unavailable`; for paid orders `paymentStatus` remains `paid`.
- `overdue` is auto-only and does not block take-on-charge or payment visibility rules by itself.
- `paymentStatus = paid` or `without_payment` must not block take-on-charge while the order remains open (`approved`, `overdue`, etc.) and unreceived.

## Financial Queue Rules (`Accounting -> Замовлення`)
- Supplier order payment queue includes orders with:
  - `paymentStatus = pending`
  - `status in [approved, overdue, partially_stocked, partially_completed, stocked]`
  - `total > 0`
- `overdue` rows remain payable when `total > 0` and receipt is not fully closed; auto-`overdue` must not remove them from the queue after operator status advancement.
- Supplier orders with zero total (free-of-charge receipts) are allowed in Warehouse flows, but must not appear in this payment queue.

## Payment Actions in Accounting
- `Оплатити`:
  - Creates finance withdraw transaction.
  - Sets `paymentStatus = paid`.
  - Transaction **note** uses the supplier order **display number**:
    - custom `number` entered during supplier purchase (e.g. `ПП-77`, `INV-2026-01`) when present;
    - otherwise the system automation id `orderBaseId` (e.g. `SO-1779142808517`).
  - Frontend sends localized note via `accounting.orders.paymentNote` (`Payment for order {{orderNumber}}` / `Оплата за замовлення {{orderNumber}}`).
  - Backend fallback (when `note` is omitted in pay payload): `Supplier order payment: <display number>`.
  - Display number rule matches UI helper `getSupplierOrderDisplayNumber`: `order.number || order.orderBaseId`.
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
- Clicking a cashbox card action opens the operation form for that cashbox.
- If the browser has a remembered last operation for `(cashboxId, operationType)` in `project-goods.accounting-last-operation-by-cashbox`, restore `type`, `from`, `to`, and `currency` from that memory; `amount` and `note` start empty.
- If no remembered operation exists, apply type-specific defaults:
  - `Deposit`: `To cashbox` is preselected as the clicked cashbox.
  - `Withdraw`: `From cashbox` is preselected as the clicked cashbox and `To cashbox` stays empty.
  - `Transfer`: `From cashbox` is preselected as the clicked cashbox and `To cashbox` is preselected to another valid cashbox.

## Operation Form Persistence Rules
- After a manual transaction submit finishes (success or validation/API error), `type`, `from`, `to`, and `currency` stay unchanged.
- Only `amount` and `note` are cleared after a successful submit.
- On successful submit, the operation snapshot is stored per anchor cashbox:
  - `deposit` -> anchor = `toCashboxId`
  - `withdraw` / `transfer` -> anchor = `fromCashboxId`

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
