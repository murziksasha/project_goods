# Order Creation Rules

## Create Order Modal

- Clicking `Create order` opens the modal.
- Entry points:
  - Orders/Sales toolbar `Create order`;
  - Order/sale detail card header `Create order` (after status dropdown, before close).
- `Client phone` + `Client name` perform lookup in clients.
- If the entered phone or exact client name matches a client with status `blacklist`, the repair order form shows a non-blocking warning directly below the client fields.
- The blacklist warning must include the client name/phone and must not prevent saving the repair order.
- Clicking the blacklist warning opens the matched client card so the operator can read the client note/reason before continuing.
- If client is not found and valid phone+name are entered, a new client is created automatically when user focuses `Device #1` (to bind `clientId` before device actions).
- Client phone is the primary unique client key and is normalized before save (for example `063...` and `+38063...` resolve to the same client phone). If uniqueness fails, order creation is rejected.
- In right sidebar block `Client requests`, request number (`recordNumber`) is a link to the exact order/sale card.
- Clicking request number opens a new browser tab/window (`target="_blank"`).
- The opened URL must include `page=orders`, proper `ordersTab` (`orders` for repair, `sales` for sale), and `saleId=<id>` so the exact card opens immediately.

## In-App Navigation and Browser History (2026-06-22)

- Left-click navigation inside the dashboard (sidebar, orders tabs, open/close cards) uses client-side History API (`pushState`) and does **not** reload the page.
- Browser **Back** / **Forward** restore the previous in-app view (page, tab, open card) from the URL query string.
- Opening an order/sale card from the orders workspace, client card, or warehouse stock table updates `saleId` in the URL and pushes a history entry; closing the card clears `saleId` so Back can reopen the card.
- Create-order `Client requests` links remain `target="_blank"` (new tab) — they are intentionally outside the in-app history stack.
- URL helpers: `getOrderLink()` / `buildDashboardHref()` in `frontend/src/pages/dashboard/model/dashboard-navigation.ts`.
- See [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md).

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
- Status dropdown in list is rendered in overlay (portal) above table/content.
- Status dropdown opens **below or above** the row badge depending on available viewport space; `max-height` is clamped to the free space on the chosen side.
- When the status dropdown is open, background scroll is locked: `body`/page scroll and `orders-table-wrap` scroll are disabled until the menu closes.
- Mouse-wheel scrolling moves only the status list (`overscroll-behavior: contain` plus wheel guard); the parent page and orders table must not scroll.
- Status dropdown must not affect row height and must not create additional scroll inside orders table container.
- For repair orders with attached warehouse products, status change to `issued` is allowed only after the attached products are fully paid.
- When a paid repair order changes to `issued`, bound warehouse serials stay attached to the order and stock is shipped by the workspace save flow.
- For repair orders, status change to `client rejected` or `issued without repair` is blocked when any product line has a warehouse serial number bound through the `Serials x/y` action.
- To unlock `client rejected` / `issued without repair`, refund the client at least the refundable amount for the product serials that will be unbound, then return those serials back to stock through the line-item return flow.
- Product line items without bound warehouse serial numbers do not trigger this refusal-status stock lock.
- Orders list defaults to 30 rows per page.

## Payment Method In Accept Payment Modal

- `Cash` badge in payment modal is clickable and toggles payment method: `Cash` <-> `Non-cash`.
- In `Non-cash` mode, badge background changes to light red.
- Selected method is saved into `paymentHistory` deposit entries as `paymentMethod`.
- `Discount` in payment modal summary is read-only; editing is available only in order card `Payment` panel.
- Partial deposits are allowed for repair orders while the order remains in its current non-final status.
- A repair order may receive several payments at different times and into different cashboxes.
- `Accept to cashbox` records only the deposit and must not require full remaining payment.
- `Accept to cashbox` must not issue the repair order while `To pay > 0`; it only closes the payment modal and refreshes the payment state.
- Successful payment modal actions close the modal. `Print` opens print preview only and does not close the payment modal.
- Repair orders support status `paid` in the `Orders` tab status dropdown and filters.
- When repair order status is changed to `paid`, the system opens `Accept payment` modal if `To pay > 0`.
- In repair order card, the `Payment -> Accept payment` button opens the same modal with target status `issued`.
- For repair order card issue target, payment modal actions follow the same issue behavior as sale card:
  - `Accept to cashbox` adds a deposit without issuing.
  - `Accept and issue` adds a deposit and changes the order status to `issued`.
  - `Issue without payment` changes only the status to `issued` when allowed by product/payment guards.
- Repair order `paid` behavior remains available only through explicit `paid` status selection from the Orders list/status dropdown:
  - `Accept to cashbox` adds a deposit and marks the order `paid`.
  - `Accept and mark paid` adds a deposit and marks the order `paid`.
  - `Mark paid without payment` changes only the status to `paid`.
- Repair status `paid` is a payment state, not a final issue/close state: it does not fill `Issued`, does not set completion date, and does not trigger final repair stock-lock behavior.
- For `Repair order`, action `Issue without payment` is allowed even when `To pay > 0` if the order has no attached product line items.
- For `Repair order`, `Issue without payment` changes order status to selected payment target status (normally `issued`) and writes status change to timeline.
- Exception for `Repair order`: if order has attached product line items and `To pay > 0`, `Issue without payment` is blocked until the attached products are fully paid.
- For `Sales`, `Issue without payment` remains blocked for target status `issued` while `To pay > 0`.

## Repair Status Refinement (2026-07-03)

- Repair orders support intermediate status `refinement`:
  - key: `refinement`
  - EN label: `Refinement`
  - UK label: `Опрацювання`
- Status position in workflow/list: after `in repair`, before `waiting parts`.
- Badge color: pale red (`#ebb4b4`).
- `refinement` is a non-final working status:
  - available in `Orders` list status dropdown, order-card status select, and `Order status` filter checkboxes,
  - editable in order card while the order remains in a non-final status,
  - does not fill `Issued`, does not set `Ready date`, does not trigger payment modal on selection,
  - does not block `client rejected` / `issued without repair` by itself (same stock-lock rules as other non-final statuses),
  - `Refund to client` remains allowed.

## Repair Order Refund Guard

- For repair orders, `Refund to client` is blocked in statuses:
  - `issued`
  - `client rejected`
  - `issued without repair`
- In all other repair statuses, refund action is allowed and refund modal may open.

## Order Card Editing Rules

- In order card `Main information`, `Device` opens a change modal for repair orders.
- The device change modal shows active `Clients goods` records for the current client and can create a new client device.
- In order card `Main information`, `S/N` is editable.
- `S/N` must remain editable at any time, including empty value.
- Empty `S/N` must be accepted by backend validation and must not prevent saving order-card changes.
- `Save changes` from order card persists the selected device name to the order snapshot.
- `Master` is editable in order card via dropdown list of active employees with role `master` (or users with repair execution rights).
- `Manager` remains informational.
- `Article` is removed from order card main information.
- `Save changes` button appears only when main information or status was modified (dirty state), and persists changes atomically.
- Status in order card is applied on `Save changes` (not immediately on select).
- In order card `Save changes`, status change follows the same rules as in Orders list:
  - `issued` is blocked while attached product line items have unpaid balance.
  - `client rejected` and `issued without repair` are blocked while any product line has a bound warehouse serial number.
- In order card product lines, `Serials x/y` remains openable for an already bound serial even when the product block is otherwise read-only, so the serialized stock binding can be inspected or cleared.
- If saved status is NOT one of final issued statuses:
  - `issued`
  - `client rejected`
  - `issued without repair`
  then `Issued` worker is cleared in both orders list and order card.
- Existing device editing remains in `Clients goods`; the order-card modal only selects or creates a client device.
- `S/N` in order card remains order-specific and must not be written to `Clients goods`.
- In order card device modal, if no exact device-name match is found in `Clients goods`, the create-new flow remains available.
- The modal must not auto-select the first available client device as fallback.
- `Live feed` composer (comment input + `Add` button) is fixed at the bottom of the live feed panel and must not shrink.
- Manual `Live feed` composer comments are rendered green; generated timeline messages keep system styling.

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
- The same unbind rules are also available outside `Clients goods`:
  - `Order card -> Change device` modal: each active client device row has `Unbind`;
  - `Clients & suppliers -> Client card -> Client devices` tab: each active client device row has `Unbind`.
- In both entry points, `Unbind` means delete when unused and deactivate when used; confirmation is required in both cases.

## Sales Flow: Product Add Action

- In sale create/card product entry, Shipping status action is removed.
- Product add flow uses explicit add action only.
- No supplier-order modal is triggered from product entry row.

## Sales Card: Serials Modal -> Supplier Order (2026-05-20)

- In sale card product line, `Serials x/y` action opens serial binding modal.
- In serial binding modal, warehouse dropdown filters available serials; `Auto-select oldest` must respect that warehouse filter and pick the oldest dated stock inside it only.
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
  - `[LINKED_SALE_ID:<saleReference>]`
  - `[LINKED_CLIENT_ID:<clientId>]`
- `saleReference` is stored as `recordNumber` when available, otherwise `sale.id`.
- In order/sale card bottom related block, tab `Supplier Order` shows only supplier orders explicitly linked to the current sale/order card.
- Matching rule:
  - supplier order is visible only when `LINKED_SALE_ID` matches the opened card by `recordNumber` or `sale.id` (case-insensitive),
  - product-name or client-only matches without `LINKED_SALE_ID` must not appear in this tab.
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

## Supplier Order Toolbar and Date Panel (2026-05-26)

- `Orders -> Supplier Order` toolbar follows `Order Flow` visual pattern:
  - left: `Data` button, columns settings (gear), persistent `Search`, `Order status`, `Payment status`,
  - right: `Order from supplier`.
- `Supplier Order` and `Information` tabs are visible only to `owner` or employees with `supplierOrders.view` / `supplierOrders.manage`.
- `Order from supplier` is visible only with `supplierOrders.manage`.
- In `Supplier Order`, the date-panel toggle is named `Data` (instead of `Filter`) because it controls date range fields.
- `Data` toggles a smooth expandable panel using the same animated filter-panel behavior as order-flow tabs.
- The panel includes:
  - `Date from`
  - `Date to`
  - `Clear dates`
- `Order status` and `Payment status` dropdown menus are overlay controls and must open over content without reflow or layout shifts.
- Date filter behavior is inclusive range:
  - only `Date from`: include records with `deliveryDate >= dateFrom`,
  - only `Date to`: include records with `deliveryDate <= dateTo`,
  - both: include records with `dateFrom <= deliveryDate <= dateTo`.
- Supplier-order column visibility can be changed from the gear menu and is persisted in local storage.
- Supplier orders can be starred from the row number cell. The star state is persisted on the supplier order and is shown as yellow when active.
- The toolbar star button after the columns settings gear toggles `Starred only`; this filter is persisted with the supplier-order filters and also affects the `Information` tab working set.
- `Orders` and `Sales` rows use the same star pattern in the row number cell. The star state is persisted on the sale/order record.
- The `Orders` / `Sales` toolbar star button after the columns settings gear toggles `Starred only` for the active tab. Repair-order star changes require `orders.manage`; product-sale star changes require `sales.manage`.

## Supplier Order Row Status Window (2026-06-03)

- In `Orders -> Supplier Order`, each row `Status` value is an interactive badge-style button, not a native select.
- Status badge editing requires `supplierOrders.manage`; employees with only `supplierOrders.view` see supplier orders read-only.
- Clicking the row status button opens the available **manual** supplier-order statuses:
  - `Purchase request`
  - `Ordered`
  - `Approved`
  - `Stocked`
  - `Cancelled`
  - `Unavailable`
- Auto-only statuses (not selectable in status window):
  - `Overdue`
  - `Partially stocked` (`partially_stocked`)
  - `Partially completed` (`partially_completed`)
- `Overdue` is **auto-only**: backend promotes only `request` orders (unreceived, no received line items) to `overdue` when `deliveryDate` is before the current business day (`Europe/Kiev`) during `GET /supplier-orders`.
- Auto-`overdue` must not overwrite workflow progress:
  - manual statuses `ordered` and `approved` stay after operator selection (including transitions from `overdue`),
  - `partially_stocked` / `partially_completed` stay after partial take-on-charge,
  - orders with any received line item are reconciled to the resolved item-based status instead of being forced back to `overdue`.
- See **Supplier Order Backdated Delivery and Status Persistence (2026-07-06)** below for the full backdated-order workflow.
- Supplier Order table list visibility:
  - an order disappears from the default working set only when `paymentStatus = pending` and all line items are `cancelled`
  - partially processed orders (`partially_stocked`, `partially_completed`) stay visible even when the saved status filter still contains only manual open statuses such as `Approved`
  - paid and `without_payment` orders stay visible even if every line item is `cancelled`
- `Overdue` does not block take-on-charge, content editing, or payment actions.
- `Cancelled` and `Unavailable` are manual closure statuses. They block take-on-charge and content editing.
- Paid / `without_payment` orders may still be moved to `Cancelled` or `Unavailable` through the status badge; `paymentStatus` stays unchanged for paid orders.
- The status window is rendered in a portal attached to `document.body`, using fixed viewport coordinates measured from the clicked status button.
- Portal rendering is required because the supplier-order table has horizontal scrolling; the status window must not be clipped by the table wrapper.
- Opening the status window must not change row height, table height, pagination position, or horizontal scrollbar position.
- If the same supplier order appears as multiple item rows, the opened status window is keyed by the visible row number so it anchors to the exact clicked badge.
- The status window has internal vertical scroll with fixed maximum height.
- Mouse-wheel scrolling inside the status window must keep the window open and scroll only the status list.
- Wheel momentum from the status window must not scroll the page/table behind it.
- Clicking outside the status button/window closes the status window.
- Page/table scrolling outside the status window closes it.
- Browser resize closes it, because the measured fixed position may no longer match the clicked badge.
- Selecting the current status closes the window without sending an update request.
- Selecting another status:
  - closes the status window,
  - updates the supplier order status,
  - refreshes the supplier-order list,
  - shows success or error feedback.
- If the selected status is `Stocked`, the UI must call the take-on-charge flow directly using the default warehouse/location pair and the clicked row `itemIndex`, matching the manual stocked behavior documented in `WAREHOUSE_FLOW.MD`.
- Item-scoped actions from `SupplierOrderModal`:
  - take-on-charge must pass `itemIndex` for the opened row/suborder
  - `Cancel item` calls `POST /supplier-orders/:supplierOrderId/cancel-item`
  - item cancel recalculates order `total` from non-cancelled lines; on paid orders `paid` stays at the amount actually paid
  - cancelled item product names render in red in Supplier Order and Warehouse Receipts
  - whole-order `Delete` stays available only outside item-scoped multi-item view and only while `paymentStatus = pending`
- If `paymentStatus = cancelled`, or `status = cancelled`, or `status = unavailable`, the row status button is disabled and the status window cannot be opened.
- Clicking a supplier order number must always open the supplier order modal when the employee has supplier-order read access.
- If the order is locked by receipt/final status (`stocked`, `receiptStatus = received`, `cancelled`, or `unavailable`), the opened modal is read-only instead of blocked.
- For `status = approved` that is not yet stocked/received, the modal must allow take-on-charge (`Оприбуткувати`) regardless of `paymentStatus` (`pending`, `paid`, `without_payment`) when the employee has `supplierOrders.manage`.
- Cancel (`Скасувати`) in `SupplierOrderModal` is allowed only while `paymentStatus = pending`.
- If `paymentStatus = paid` or `without_payment`, the Delete button in `SupplierOrderModal` must not be rendered, and `POST /supplier-orders/:supplierOrderId/cancel` must be rejected by backend with `Оплачений заказ не можна скасувати.`
- On `approved` orders, `paid` / `without_payment` lock order content fields (supplier, items, prices) and cancel, but must not hide or disable take-on-charge when the employee has `supplierOrders.manage`.
- Editable content fields remain available only when the employee has `supplierOrders.manage` and the order is not locked by the supplier-order content lock rules.

## Supplier Order Backdated Delivery and Status Persistence (2026-07-06)

This section documents supplier orders created with a **past `deliveryDate`** («задним числом») and how status / take-on-charge must behave after list refresh.

### Business intent

- A backdated delivery date is allowed on create/update; it is **not** rejected by validation.
- `overdue` is a **signal** that an unreceived `request` missed its planned delivery date.
- Once the operator advances the order manually (`ordered`, `approved`) or starts receipt (`partially_stocked`), the system must **not** roll the saved `status` back to `overdue` on the next list fetch.
- `Information` tab overdue analytics still use date-based rules and may count late open orders even when the row badge shows `ordered` / `approved`.

### `GET /supplier-orders` side effects (list refresh)

On every list fetch, backend runs in order:

1. `autoMarkZeroTotalOrdersWithoutPayment()`
2. `reconcileSupplierOrderStatuses()` — repairs open orders that already have `items[].receiptStatus = received` but still show a stale header status such as `overdue` or `approved`; applies item-based resolver (`partially_stocked`, `partially_completed`, `stocked`).
3. `autoMarkOverdueSupplierOrders()` — promotes only matching `request` rows to `overdue`.

`autoMarkOverdueSupplierOrders` candidates must satisfy **all** of:

- `status = request`
- `receiptStatus != received`
- no line item has `receiptStatus = received`
- `deliveryDate` (business day, `Europe/Kiev`) is before today

`autoMarkOverdueSupplierOrders` must **never** downgrade or overwrite:

- `ordered`, `approved`, `overdue` (manual or prior auto state after operator action)
- `partially_stocked`, `partially_completed`, `stocked`
- any order with at least one received line item

### Manual status changes on backdated orders

| Current badge | Operator selects | Expected result after refresh |
|---------------|------------------|-------------------------------|
| `overdue` | `ordered` | stays `ordered` |
| `overdue` | `approved` | stays `approved` |
| `request` (future date) | `ordered` | stays `ordered` |
| `request` (past date, untouched) | — | becomes `overdue` on next list fetch |
| any open | `stocked` on one row | `partially_stocked` until all lines are received |

- `PUT /supplier-orders/:id` with a manual status must persist; a success toast must not be followed by a silent revert on refetch.
- If the selected status equals the current status, the status window closes without an API call.

### Multi-item orders (e.g. 18 positions)

- One supplier order with many line items renders as **one table row per item**; every row shows the same header `order.status`.
- `Stocked` from the row status badge and `Оприбуткувати` from the item-scoped modal receive **only the clicked row** (`itemIndex`).
- Receiving one line on a multi-item order sets `partially_stocked` (auto-only) until every active line is `received` or terminal.
- Operator workflow: repeat take-on-charge per remaining row; cancelled lines are skipped.
- UI success feedback:
  - full order received -> `orders.supplier.messages.success.stocked`
  - single line on a multi-item order -> `orders.supplier.messages.success.partiallyStocked`

### Payment and finance on `overdue`

- `overdue` does **not** block take-on-charge, content editing (while still pending), or payment actions.
- Accounting payment queue and pay/issue-without-payment actions treat `overdue` the same as other open receipt-ready statuses (`approved`, `partially_stocked`, `partially_completed`, `stocked`).

### Implementation references

- Backend: `backend/src/domain/supplier-order/service.ts`
  - `reconcileSupplierOrderStatuses`
  - `autoMarkOverdueSupplierOrders`
  - `listSupplierOrders`
- Frontend status badge / partial stocked toast: `frontend/src/widgets/dashboard/ui/supplier-orders/SupplierOrdersWorkspace.tsx`
- Item-scoped modal take-on-charge: `frontend/src/widgets/dashboard/ui/orders/modals/SupplierOrderModal.tsx`

## Truncated Text Hover Tooltip

- Any visible value that is truncated with ellipsis because of limited column/card width must expose the full text on hover/focus.
- The tooltip must be a custom interactive tooltip, not only the native browser `title`, when the text is expected to be copied.
- The tooltip must remain open while the pointer moves from the truncated value into the tooltip.
- Tooltip text must be selectable so the operator can copy names, order numbers, serial numbers, notes, and other clipped values.
- The same behavior should be reusable across orders, sales, supplier orders, warehouse tables, accounting tables, and compact cards.

## Supplier Order Information Tab (2026-05-29)

- `Orders` has a fourth tab after `Supplier Order` named `Information`.
- `Information` is rendered by the same supplier-order workspace as `Supplier Order`.
- Access to `Information` follows supplier-order read access: `supplierOrders.view` or `supplierOrders.manage`.
- The `Information` tab reuses the supplier-order working set after current filters are applied:
  - search by number, product, supplier,
  - order status,
  - payment status,
  - inclusive delivery date range from the `Data` panel.
- The `Data`, `Search`, `Order status`, `Payment status`, and `Order from supplier` controls remain available on `Information`.
- The table column settings gear is hidden on `Information` because the analytics dashboard has no configurable table columns.
- The normal supplier-order table and pagination are shown only on `Supplier Order`.
- `Information` shows procurement analytics for supplier-order goods only:
  - summary cards: supplier order count, total value, paid amount, outstanding amount, total quantity, average order value, payment coverage, stocked/received rate,
  - popular goods: top products by quantity, purchase value, and frequency,
  - price analysis: lowest unit price, highest unit price, and product min/max/average price ranges when the product appears at multiple prices,
  - supplier analysis: top suppliers by spend, pending amount, paid amount, and order count,
  - business signals: overdue open orders, late-risk open orders within 3 days, cancelled/unavailable rate, stocked/received rate, and payment coverage.
- Overdue and late-risk counts exclude final/closed supplier orders:
  - `stocked`,
  - `cancelled`,
  - `unavailable`,
  - `overdue` (date-based overdueCount must not double-count auto-overdue rows),
  - `receiptStatus = received`.
- If filters produce no supplier orders, `Information` shows a compact empty state instead of table rows.
- Services are not included in this tab in v1 because `SupplierOrder` items currently represent goods/products only.

