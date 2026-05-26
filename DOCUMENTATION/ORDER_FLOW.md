# Order Creation Rules

## Create Order Modal

- Clicking `Create order` opens the modal.
- `Client phone` + `Client name` perform lookup in clients.
- If client is not found and valid phone+name are entered, a new client is created automatically when user focuses `Device #1` (to bind `clientId` before device actions).
- Client phone is unique. If uniqueness fails, order creation is rejected.
- In right sidebar block `Client requests`, request number (`recordNumber`) is a link to the exact order/sale card.
- Clicking request number opens a new browser tab/window (`target="_blank"`).
- The opened URL must include `page=orders`, proper `ordersTab` (`orders` for repair, `sales` for sale), and `saleId=<id>` so the exact card opens immediately.

## Create Order Sidebar: Client Devices / Client Requests Tabs (2026-05-24)

- In right sidebar block `Client devices`, show devices only from `Repair order` history (`sale.kind = repair`).
- Sales history entries must not be shown in `Client devices`.
- In right sidebar block `Client requests`, two tabs are available:
  - `Orders` (repair requests only),
  - `Sales` (sales requests only).
- `Client requests` tab auto-activates based on current create tab:
  - `Create order -> Repair order` activates `Orders`,
  - `Create order -> Sales order` activates `Sales`.
- User can still switch `Client requests` tab manually after auto-selection.

## Repair Order Device Behavior

- `Device #1` searches in `Products & Services -> Clients goods` (client devices), globally across all clients (no `clientId` filter).
- Search returns only active client devices.
- Device suggestions in `Create order` are deduplicated by canonical device name (case-insensitive).
- If current `Device #1` value already exactly matches a suggested device name, that suggestion is hidden (no repeated selected item in dropdown).
- `Create new` button is visible but disabled until:
  - tab is `Repair order`
  - a client is selected from suggestions (required only for creating a new device card)
  - device name has at least 2 chars
  - no active matches are found
- New device is created in `client-devices` collection, not in warehouse products.

## Urgent Term

- If `Urgent repair` flag is selected during repair order creation, order term is shown as `Urgent` in light red.
- Otherwise term is `Non-urgent`.

## Repair vs Stock Product Separation

- Repair order creation no longer creates warehouse products from customer devices.
- Customer device name is stored in `Clients goods`; serial is stored only in order context/history.
- Field `Kit` from `Create order` is order-scoped and must not be written to `Clients goods.note`.
- On order creation, `Kit` is prepended to order `Notes` in format `(kits: ...)` as the first line.
- No automatic `Repair` service line item is injected into new repair orders.
- Removing service line items from order card is allowed and persisted.

## Prepayment

- Prepayment logic is fully removed from `Create order`.
- There is no prepayment input block in the create-order modal.
- New orders are created with `paidAmount = 0` and empty `paymentHistory`.

## Orders List Columns (`Orders` tab)

- Column `Received` is renamed to `Issued`.
- Column `Master` is added.
- `Issued` displays only the employee who performed the status change to one of final repair statuses:
  - `issued`
  - `client rejected`
  - `issued without repair`
- If no such status transition happened yet, `Issued` shows `-`.
- Every status change action is recorded in `Live feed` with author and timestamp.
- `Ready date` in the orders list is treated as completion date and is set from the timestamp of transition to one of:
  - `issued`
  - `client rejected`
  - `issued without repair`
- Completion timestamp source is the corresponding status-change entry in `Live feed` (timeline).
- Filters include `Payment method` dropdown: `All`, `Cash`, `Non-cash`.
- If order has paid amount and latest deposit method is `non-cash`, columns `Price` and `Paid` are shown in red.
- Status dropdown in list always opens downward and is rendered in overlay (portal) above table/content.
- Status dropdown must not affect row height and must not create additional scroll inside orders table container.
- For repair orders, status change to `issued`, `client rejected`, or `issued without repair` is blocked when any product line has a warehouse serial number bound through the `Serials x/y` action.
- Product line items without bound warehouse serial numbers do not trigger this final-status stock lock.
- To unlock final-status change, shipped serialized products must be returned back to stock first (line-item return flow).
- The line-item `Return` action remains available for serialized products in these final repair statuses, so the user can move the shipped item back to stock and unlock the order.

## Payment Method In Accept Payment Modal

- `Cash` badge in payment modal is clickable and toggles payment method: `Cash` <-> `Non-cash`.
- In `Non-cash` mode, badge background changes to light red.
- Selected method is saved into `paymentHistory` deposit entries as `paymentMethod`.
- `Discount` in payment modal summary is read-only; editing is available only in order card `Payment` panel.
- For `Repair order`, action `Issue without payment` is allowed even when `To pay > 0`.
- For `Repair order`, `Issue without payment` changes order status to selected payment target status (normally `issued`) and writes status change to timeline.
- Exception for `Repair order`: if order has attached product line items and `To pay > 0`, `Issue without payment` is blocked until those products are returned to stock.
- For `Sales`, `Issue without payment` remains blocked for target status `issued` while `To pay > 0`.

## Repair Order Refund Guard

- For repair orders, `Refund to client` is blocked in statuses:
  - `issued`
  - `client rejected`
  - `issued without repair`
- In all other repair statuses, refund action is allowed and refund modal may open.

## Order Card Editing Rules

- In order card `Main information`, `Device` is read-only (no `Edit` button and no device-edit modal in order card).
- In order card `Main information`, `S/N` is editable.
- `S/N` must remain editable at any time, including empty value.
- Empty `S/N` must be accepted by backend validation and must not prevent saving order-card changes.
- `Save changes` from order card does not modify device name.
- `Master` is editable in order card via dropdown list of active employees with role `master` (or users with repair execution rights).
- `Manager` remains informational.
- `Article` is removed from order card main information.
- `Save changes` button appears only when main information or status was modified (dirty state), and persists changes atomically.
- Status in order card is applied on `Save changes` (not immediately on select).
- In order card `Save changes`, status change is blocked by the same stock rule as in Orders list: selecting `issued`, `client rejected`, or `issued without repair` must fail while any product line has a bound warehouse serial number.
- In order card product lines, `Serials x/y` remains openable for an already bound serial even when the product block is otherwise read-only, so the serialized stock binding can be inspected or cleared.
- If saved status is NOT one of final issued statuses:
  - `issued`
  - `client rejected`
  - `issued without repair`
  then `Issued` worker is cleared in both orders list and order card.
- Saving order card main information does not provide device editing via order-card modal; device management is performed via `Clients goods`.
- `S/N` in order card remains order-specific and must not be written to `Clients goods`.
- In order card device modal, if no exact device-name match is found in `Clients goods`, the form must stay in `New device` mode.
- The modal must not auto-select the first available client device as fallback.
- `Live feed` composer (comment input + `Add` button) is fixed at the bottom of the live feed panel and must not shrink.

## Clients Goods (`Products & Services` first tab)

- First tab is named `Clients goods`.
- Fields shown: `ID`, `Name`, `Activity`, `Date`.
- Device `Name` must be unique in `Clients goods` list view (case-insensitive).
- When creating an order, if a device with the same canonical name already exists in `Clients goods`, it must be reused from suggestions and no duplicate record is created.
- Serial numbers are not stored or edited in `Clients goods`; they are handled in order card context/history only.
- Clicking `Name` opens edit modal.
- Create/Edit modals for `Clients goods` include only device name, note and activity.
- Modal allows toggling `active/inactive`.
- Inactive devices are excluded from order device lookup.
- A device is considered "used" if it appears in at least one order/sale history entry for the same client (including order snapshot and line items).
- If a device is used in orders/sales, `Remove` is forbidden; only deactivation is allowed.
- `Remove` is enabled only when device is not used in orders/sales.
- `Remove` action asks for confirmation.

## Sales Flow: Product Add Action

- In sale create/card product entry, Shipping status action is removed.
- Product add flow uses explicit add action only.
- No supplier-order modal is triggered from product entry row.

## Sales Card: Serials Modal -> Supplier Order (2026-05-20)

- In sale card product line, `Serials x/y` action opens serial binding modal.
- In serial binding modal, `Order` action opens existing `SupplierOrderModal`.
- Product name is prefilled from current product line item.
- On submit, system creates supplier order with:
  - order status `request` (new request),
  - payment status `pending`,
  - selected supplier/date/line items from modal.
- Created request appears in `Orders -> Supplier Order`.

## Sales Card: Related Supplier Orders Link (2026-05-23)

- Supplier orders created from `Sales` card serials modal are now explicitly linked to the source sale.
- Link is persisted in supplier order note using technical markers:
  - `[LINKED_SALE_ID:<saleId>]`
  - `[LINKED_CLIENT_ID:<clientId>]`
- In order/sale card bottom related block, tab `Supplier Order` now shows linked supplier orders for the current sale.
- Matching priority:
  - explicit link by `LINKED_SALE_ID` (primary),
  - fallback by linked client marker + product-name intersection (for backward compatibility with older records).
- Purpose:
  - quick jump context for receiving (`Оприбуткувати`) from same workflow window,
  - historical visibility of supplier procurement done for a specific client sale.
- Clicking a linked supplier-order item in `Sales` card bottom tab `Supplier Order` opens `SupplierOrderModal` for that exact item.
- Take-on-charge action from this modal is item-scoped (`itemIndex` is passed), so receiving affects only the selected product line.
- Opening behavior:
  - before modal open, system loads suppliers and warehouse settings,
  - modal opens in context of a single supplier-order line (`<orderNumber>-<itemIndex+1>`),
  - action `Оприбуткувати` from this modal triggers `takeOnChargeSupplierOrder` for the same supplier order id with selected `itemIndex`.
## Products Suggestions Source (2026-05-09)

- `Products & Services` now contains a dedicated tab `Products` (suggestion catalog in DB).
- This list is used as a persistent suggestion source for product name lookup scenarios.
- Records are auto-populated from:
  - `Order card -> Products`
  - `Sales card -> Products`
  - `Create order (Sales flow) -> Products`
- `Client device` names must never be auto-added to `Products` catalog.
- Device name from repair context (`Device #1` / order-card main device) is stored only in `Clients goods` (`client-devices`) and order snapshots/history.
- Only explicit product line items (`lineItems.kind = product`) participate in `Products` catalog upsert.
- The list supports activity status (`active`/`inactive`) and editing via modal.



