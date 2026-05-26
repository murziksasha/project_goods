# Sale Flow Rules

## Create Order Modal (Sale Tab)

- Tab `Sales order` is used to create sale requests.
- Client lookup is performed by `Client phone` + `Client name`.
- If client does not exist and valid phone+name are provided, client can be created automatically in the same flow.

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
- In `Sales order`, `Product search` looks up records from `Products & Services -> Products` (`catalog-products`), not from warehouse `products`.

## Product Suggestions

- Product search starts from 2+ characters.
- Suggestions are loaded from product catalog lookup.
- Clicking a suggestion fills:
  - product name into search input
  - suggested price from product sale price (fallback to base price)
  - quantity to `1`
  - warranty to `None`
- Selected suggestion binds `catalog-products.id` and sends that value to backend as `productId` for the sale line item.

## Sale Creation: Product/Device Linking Rules

- Creating a `Sales order` must not auto-create warehouse product cards when a catalog match is absent.
- Sales line items may be saved without `productId` (manual item text), to avoid fake stock entries before receipt.
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
- In `Orders -> Sales` list, if sale has paid amount and latest deposit method is `non-cash`, columns `Price` and `Paid` are shown in red.
- Filters include `Payment method` dropdown: `All`, `Cash`, `Non-cash`.

## Status Change: Paid

- For `Sales` flow, when status is changed to `paid`, system opens `Accept payment` modal (if `To pay > 0`).
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
  - sale status is auto-changed to `paid`
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

