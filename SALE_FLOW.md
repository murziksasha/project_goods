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
- Search suggestions are rendered in a separate block below the entry row.
- Suggestions must not push controls inside the entry row (no layout jump).
- Suggestions list has internal scroll with fixed max height.

## Product Suggestions

- Product search starts from 2+ characters.
- Suggestions are loaded from product catalog lookup.
- Clicking a suggestion fills:
  - product name into search input
  - suggested price from product sale price (fallback to base price)
  - quantity to `1`
  - warranty to `None`
- Selected suggestion binds `productId` for the line item.

## Sale Creation: Product/Device Linking Rules

- Creating a `Sales order` must not auto-create warehouse product cards when a catalog match is absent.
- Sales line items may be saved without `productId` (manual item text), to avoid fake stock entries before receipt.
- Creating a `Sales order` must not auto-create entries in `Clients goods` (`client-devices`).
- `Clients goods` auto-link/create behavior is applied only for `Repair order` flows.

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

## Status Change: Paid / Completed

- For `Sales` flow, when status is changed to `paid` or `completed`, system opens `Accept payment` modal (if `To pay > 0`).
- Payment modal is the working path for these status transitions:
  - `Accept to cashbox` (deposit only)
  - `Accept and mark paid` / `Accept and complete` (deposit + status change)
  - `Mark paid without payment` / `Complete without payment` (status change without deposit)
- Modal summary includes editable `Discount` with mode switch:
  - `%` percent discount
  - `₴` fixed amount discount
- Discount is shared with sale card payment panel and affects `To pay` immediately.

## Status Change: Issued In Sales List

- In `Orders -> Sales` list, when user selects status `issued`, `Accept payment` modal is opened if `To pay > 0`.
- If in this modal user clicks `Accept to cashbox` and enters full or partial payment:
  - payment is added to cashbox
  - sale status is auto-changed to `paid`
- If user selected status `paid` and accepts payment, resulting status is `paid`.
- Strict rule for sales:
  - `issued` is not allowed when `To pay > 0`
  - exception: `issued` is allowed when final order total is `0`
- Backend validation mirrors this rule: sale cannot be persisted in `issued`/`paid`/`completed` with unpaid product amount.

## Status Dropdown UX

- Status dropdown in list is closed when user clicks outside the dropdown menu area.

## Suggestion Catalog Source (2026-05-09)

- Product suggestions are now backed by dedicated `catalog-products` storage.
- `Products & Services -> Products` tab acts as managed DB list for suggestions.
- On save/update of sales/orders, product row names are upserted into this list automatically.
- Upsert source is restricted to explicit product row names (`lineItems.kind = product`) only.
- Device names from `Clients goods` (`client-devices`) must not be copied/synced into `Products` catalog.
- This catalog is separate from:
  - warehouse `products` (stock cards)
  - `Clients goods` (`client-devices`)
