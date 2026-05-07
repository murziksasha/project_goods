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
