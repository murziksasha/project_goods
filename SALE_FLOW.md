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
