# Catalog Product Create Modal Spec

## Scope
- Products & Services page, `Products` tab (`catalogProducts`).
- Supplier order modal product search field (`SupplierOrderModal`).

## UI Contract
- Modal title: `Product`.
- Fields:
  - `Product name` (required, min 2 chars)
  - `Note` (optional)
- Actions:
  - `Cancel`
  - `Save`

## Validation
- `Save` disabled when:
  - product name length < 2
  - saving is in progress
  - product name already exists in the current loaded product list (case-insensitive exact match)
- Backend duplicate validation remains source of truth and can return:
  - `Catalog product with this name already exists.`

## Behavior Changes
- Supplier order product search no longer creates products from suggestion list inline.
- Product creation is performed only through `Product` modal opened by `+` button in the product input.
- Creating a catalog product does **not** create a warehouse stock item.
- Until receipt workflow is implemented, stock balance view must show only items with `quantity > 0`.
