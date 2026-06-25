# Sale Flow Rules

## Create Order Modal (Sale Tab)

- Tab `Sales order` is used to create sale requests.
- Sale detail card header also exposes `Create order` (same permission and navigation rules as the toolbar button; responsive layout is documented in `ORDER_CARD.md` -> `Header`).
- Client lookup is performed by `Client phone` + `Client name`.
- If the entered phone or exact client name matches a client with status `blacklist`, the sales order form shows a non-blocking warning directly below the client fields.
- The blacklist warning must include the client name/phone and must not prevent saving the sales order.
- Clicking the blacklist warning opens the matched client card so the operator can read the client note/reason before continuing.
- If client does not exist and valid phone+name are provided, client can be created automatically in the same flow.

## Rapid Sale (2026-06-24)

Compact counter-sale flow for walk-in customers: no client form, stock products + services only, immediate issue path.

### Entry And Visibility

- Entry point: `Create order -> Sales order` tab, header button `Rapid sale` (`orders.rapidSale.openButton`).
- Button is shown only on the **Sales order** tab when `onRapidSale` handler is wired (dashboard `saveRapidSale`).
- Button sits in `create-order-header-actions` next to the close control; layout wraps on tablet/phone and must not break the create-order header.
- Opens `RapidSaleModal` — smaller than the full create-order page, reuses `catalog-edit-modal` shell.

### Modal Layout (Responsive)

- Desktop: modal width `min(640px, 100vw - 28px)`; body scrolls independently; footer stays pinned.
- Product/service entry rows use a responsive grid (same breakpoint family as `sale-item-row`):
  - wide: search + price + qty + warranty + add action on one row
  - `<=1024px`: two columns; search and add action span full width
  - `<=480px`: single column stack; footer buttons full width
- Draft items table scrolls horizontally on narrow screens when needed.
- Suggestion lists keep fixed max height with internal scroll (no layout jump).

### Product Entry (Stock Only)

- Product section includes a **Warehouse** dropdown (active warehouses from `warehouse-settings`).
- Default selection is the first created active warehouse (first item in settings list).
- Product search and stock suggestions are scoped to the selected warehouse (`product.warehouseId`, with `purchasePlace` name fallback for legacy rows).
- Changing warehouse clears the in-progress product entry row.
- Product search starts from 2+ characters (200 ms debounce).
- Suggestions come from `buildRapidSaleStockSuggestions` — **warehouse stock only** (`source: stock`, selectable rows).
- Catalog-only rows and manual product text are rejected on save.
- Selecting any stock suggestion (serial or non-serial) pre-fills the product entry row; operator confirms with `Add product`.
- Serial-bound rows bind the serial in the entry row and lock quantity to `1` until the line is added.
- Serialized draft rows keep quantity at `1` in the draft table.

### Service Entry

- Service search reuses service catalog lookup (`getServiceCatalogItems`, 350 ms debounce).
- Missing service names may be auto-created on add (same `missingService` helpers as create-order).
- Operator confirms with `Add service`.

### Draft Items List (Lower Section)

- Added products and services appear in a table below the entry sections: `Name`, `Price`, `Qty`, `Remove`.
- **Price is editable** in this list via `NumberStepper` (manual override after add). Total line updates immediately.
- `Qty` is display-only in the draft table (change quantity before add, or remove and re-add).
- Footer shows running total: `Total: {{amount}} UAH`.
- `Issued` stays disabled until at least one valid draft line exists.

### Issue And Payment Handoff

- Footer actions: `Cancel` (left) and green `Issued` (right).
- `Issued` validates draft, calls `saveRapidSale` → `POST /sales` with `isRapidSale: true`, `kind: sale`, `status: new`, mixed `lineItems`, `clientId: ''`.
- Backend resolves a dedicated system client via `getOrCreateRapidSaleClient()` (`note: __rapid_sale_system__`); operator never sees client fields.
- On success:
  1. Create-order view closes (`createOrder` cleared from URL).
  2. App navigates to `Orders -> Sales` list (`saleId` stays unset — no sale card opens).
  3. `pendingPaymentSale` opens the existing **Accept payment** modal with `targetStatus: issued`.
- After payment/issue/refusal, operator remains on the sales list; sale card opens only if chosen manually later.

### Sales List Display And Search

- Client column shows label **`Rapid sale`** (`orders.rapidSale.clientLabel`) instead of the system client name.
- Client card link is disabled for rapid sales; phone column shows `-`.
- Top search and client filter match aliases: `Rapid sale`, `rapid sale` (see `getSaleClientSearchValues`).
- Opened sale card later behaves like a normal sale card (see [SALE_CARD.md](./SALE_CARD.md)); list label override does not apply inside the card.

### Backend Validation (`isRapidSale: true`)

- `kind` must be `sale`.
- At least one `lineItems[]` entry required.
- Product lines must have `productId` linked to warehouse stock; `catalogProductId`-only lines are rejected.
- Manual product lines without `productId` are rejected.
- `clientId` in request body is ignored; system rapid-sale client is assigned server-side.
- Formatted API responses include `isRapidSale: boolean` on the sale snapshot.

### Key Implementation Files

| Layer | Path |
|-------|------|
| Modal UI | `frontend/src/widgets/dashboard/ui/RapidSaleModal.tsx` |
| Draft/line-item helpers | `frontend/src/widgets/dashboard/model/rapid-sale-line-items.ts` |
| List client label | `frontend/src/widgets/dashboard/model/sale-client-display.ts` |
| Create + payment handoff | `frontend/src/pages/dashboard/ui/DashboardPage.tsx` (`handleRapidSaleCreated`, `pendingPaymentSale`) |
| Save action | `frontend/src/pages/dashboard/model/dashboard-actions.ts` (`saveRapidSale`) |
| System client | `backend/src/domain/client/rapid-sale-client.ts` |
| Create rules | `backend/src/domain/sale/service.ts` (`assertRapidSaleLineItems`) |

Related: [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md) (URL behavior), [API.md](./API.md) (`POST /sales` payload), [SALE_CARD.md](./SALE_CARD.md) (opened card rules).

## Sale Items Input Behavior

- Product entry row is always shown as a single stable line:
  - `Product search`
  - `Price`
  - `Qty`
  - `Warranty`
  - `Add product`
- `Shipping status` control is removed from `Create order -> Sales order`.
- Search suggestions are rendered in a separate block below the entry row.
- Suggestions must not push controls inside the entry row (no layout jump).
- Suggestions list has internal scroll with fixed max height.
- In `Sales order`, `Product search` can suggest:
  - records from `Products & Services -> Products` (`catalog-products`)
  - selectable warehouse stock products (`products`) when the item is available
- Operator may type a product by:
  - product name
  - serial number
  - article

## Product Suggestions

- Product search starts from 2+ characters.
- Suggestions are loaded from product catalog lookup and available stock lookup.
- Lookup must match by normalized product `name`, stock `serialNumber`, stock `article`, and relevant notes.
- Clicking a suggestion fills:
  - product name into search input
  - suggested price from product sale price (fallback to base price)
  - quantity to `1`
  - warranty to `None`
- Selected catalog suggestion binds `catalog-products.id` and sends that value to backend as `catalogProductId` for the sale line item.
- Selected stock suggestion binds warehouse `products.id` and sends that value to backend as `productId` for the sale line item.
- If the selected stock suggestion has a serial number, the sale line auto-binds that serial immediately:
  - `lineItems[].productId = products.id`
  - `lineItems[].serialNumbers = [products.serialNumber]`
  - `lineItems[].quantity = 1`
- Manual item text is allowed and sends neither `productId` nor `catalogProductId` at creation time.
- `productId` and `catalogProductId` must stay separate; empty strings must not be persisted into ObjectId fields.

## Sale Creation: Product/Device Linking Rules

- Creating a `Sales order` from a typed product name is allowed even if there is no stock match.
- If a typed/manual product is not linked to existing stock, it must be treated as a catalog/procurement item, not as stock already on hand.
- On save/update of a sale/order, product row names are upserted into `catalog-products`; this may create a new catalog product record for future suggestions.
- Creating a `Sales order` must not auto-create warehouse stock product cards when a catalog match is absent.
- Sales line items may be saved without `productId` (manual item text), to avoid fake stock entries before receipt.
- Sales line items with `catalogProductId` are catalog-only and must not affect warehouse stock quantity.
- Sales line items with `productId` are linked to exact warehouse stock products and follow normal stock commit rules when status changes.
- If the item is not yet in stock, the existing supplier-order/procurement and warehouse receipt flow is used later to order and receive the product.
- Receipt/take-on-charge remains the only flow that creates warehouse `products` rows and assigns warehouse serial numbers for new stock.
- After receipt, subsequent serial binding/stock linking follows the existing sale-card and warehouse rules; this document does not change those downstream flows.
- Creating a `Sales order` must not auto-create entries in `Clients goods` (`client-devices`).
- `Clients goods` auto-link/create behavior is applied only for `Repair order` flows.

## Price Transfer From Create Form To Sale Card (2026-05-20)

- For `Create order -> Sales order`, entered product price is source-of-truth for created sale line items.
- Price normalization must accept user decimal formats with spaces/comma and convert to numeric value before save.
- On save:
  - each sale line item receives normalized unit `price`,
  - sale header `salePrice` is calculated from sum of sale items.
- Opened sale card must display the same effective item price values that were entered during creation.

## Services In Sale Card

- Services are optional for sale card.
- Service entry row follows the same UI pattern as product row:
  - stable controls on top
  - suggestions below
  - suggestions list with internal scroll

## Default Expansion In Sale Card

- In sale order card:
  - `Products` section is open by default.
  - `Services` section is hidden by default.
- On switching to another sale, defaults are reapplied.

## Payment Context

- Sale totals are based on current line items (`Products` + optional `Services`).
- `Paid` and `To pay` are recalculated from line items total and payment history.
- Payment modal supports method toggle: `Cash` <-> `Non-cash` (clickable badge near `To pay`).
- `Non-cash` state is highlighted with light-red badge background in modal.
- Deposit entries persist `paymentMethod` (`cash` or `non-cash`) in `paymentHistory`.
- Partial deposits are allowed while the sale/order remains in its current non-final status.
- A user may accept several partial deposits at different times and into different cashboxes until `To pay = 0`.
- `Accept to cashbox` must never require the entered amount to cover the full remaining balance.
- `Accept to cashbox` records only the deposit and must not implicitly issue shipped products when `To pay > 0`.
- Successful payment modal actions close the modal. `Print` opens print preview only and does not close the payment modal.
- In `Orders -> Sales` list, if sale has paid amount and latest deposit method is `non-cash`, columns `Price` and `Paid` are shown in red.
- Filters include `Payment method` dropdown: `All`, `Cash`, `Non-cash`.

## Status Change: Paid

- For `Sales` flow, when status is changed to `paid`, system opens `Accept payment` modal (if `To pay > 0`).
- The same paid-status payment behavior is reused by repair orders only when `paid` is explicitly selected in `Orders` tab; repair-card `Accept payment` issues the order instead. Repair-specific rules are documented in `ORDER_FLOW.md`.
- Payment modal is the working path for these status transitions:
  - `Accept to cashbox` (deposit only)
  - `Accept and mark paid` (deposit + status change)
  - `Mark paid without payment` (status change without deposit)
- Modal summary includes read-only `Discount` (informational only).
- Discount editing is done only in sale card `Payment` panel; modal reuses those values.

## Status Change: Issued In Sales List

- In `Orders -> Sales` list, when user selects status `issued`, `Accept payment` modal is opened if `To pay > 0`.
- If in this modal user clicks `Accept to cashbox` and enters full or partial payment:
  - payment is added to cashbox
  - if `To pay` becomes `0`, sale status may be auto-changed to `paid`
  - if `To pay` remains greater than `0`, sale status must stay unchanged and the modal closes successfully
- If user selected status `paid` and accepts payment, resulting status is `paid`.
- Strict rule for sales:
  - `issued` is not allowed when `To pay > 0`
  - exception: `issued` is allowed when final order total is `0`
- Backend validation mirrors this rule: sale cannot be persisted in `issued`/`paid` with unpaid product amount.

## Status Dropdown UX

- Status dropdown in list is closed when user clicks outside the dropdown menu area.
- Status dropdown in list always opens downward.
- Dropdown menu is rendered in a top overlay layer (portal), above table/content.
- Opening dropdown must not change table row height and must not introduce extra scroll inside orders table block.

## Suggestion Catalog Source (2026-05-09)

- Product suggestions are now backed by dedicated `catalog-products` storage.
- `Products & Services -> Products` tab acts as managed DB list for suggestions.
- On save/update of sales/orders, product row names are upserted into this list automatically.
- Upsert source is restricted to explicit product row names (`lineItems.kind = product`) only.
- Manual product names entered in `Create order -> Sales order` are catalogized through this upsert rule, so they can be selected from product catalog later.
- Device names from `Clients goods` (`client-devices`) must not be copied/synced into `Products` catalog.
- This catalog is separate from:
  - warehouse `products` (stock cards)
  - `Clients goods` (`client-devices`)

## Sales Card Return Workflow Baseline (2026-05-18)

- This section is normative for `Orders -> Sales -> opened sale card`.
- Status in sale card must match list status (including `issued`).
- Editing is allowed only in statuses:
  - `new`
  - `reserved`
  - `paid`
- For non-editable statuses (`issued`, `returned`, etc.), card is read-only.
- Exception for `issued` sale: `Refund to client` action stays available to unblock return workflow.

### Return Sequence

- Product return is split into two separate operations:
  1. `Refund to client` (money)
  2. `Remove` in product row (stock)
- `Remove` opens stock-return modal only (warehouse destination), without refund fields.
- If required refund has not been completed, product stock remove/return must be blocked with toast error.
- Required refund amount is discount-aware (based on line-item share in discounted order total).

### Remove Availability Rules

- `Remove` for product line is enabled only when:
  - order is not paid (`paidAmount = 0`, or net payment history deposits minus refunds equals `0`)
  - status is editable (`new`, `reserved`, `paid`)
  - no serial number is bound to that line item
- When enabled, `Remove` performs pure line deletion from order card (no stock receive modal).
- `Remove` for service line is enabled only when:
  - order is not paid (`paidAmount = 0`)
  - status is editable (`new`, `reserved`, `paid`)
- If action is blocked, UI keeps `Remove` disabled and shows tooltip with exact reason.
- For `issued` sale:
  - product row action is `Return` (not `Remove`)
  - `Return` requires bound sold serial and opens warehouse receive modal
  - this flow is used when customer returns product after issuance

## Sales Card Return Workflow Update (2026-05-20)

- For `issued` sale, if user receives product back to warehouse and no product line items remain in order:
  - and `paidAmount = 0` after refund,
  - system auto-sets sale status to `returned`.
- This removes deadlock scenario:
  - `Return` asks for refund first,
  - while status remains non-editable.
- Practical sequence for issued return:
  1. `Refund to client` (allowed in `issued` card despite read-only mode).
  2. `Return` in product row -> stock receive modal.
  3. Status auto-switches to `returned` when product part is fully reverted and money is refunded.

## Returned Status Guard (2026-05-26)

- Sale status `returned` must not be set manually while any product line remains attached to the sale.
- Sale status `returned` must not be set while `paidAmount > 0`; the client payment must be refunded first.
- In sale card status dropdown, `Returned` is blocked until:
  - all product lines were returned/unbound from the sale,
  - client paid amount is fully refunded (`paidAmount = 0`).
- Backend workspace update mirrors this guard and rejects direct `returned` saves that bypass the UI.

