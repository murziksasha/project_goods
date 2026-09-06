# Catalog Product Create Modal Spec

Related: [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) · [SERIAL_NUMBER_SEQUENCE_SPEC.md](./SERIAL_NUMBER_SEQUENCE_SPEC.md) · [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) · [index](./README.md)

## Scope
- Products & Services page, `Products` tab (`catalogProducts`).
- Supplier order modal product search field (`SupplierOrderModal`).

## Catalog list hover copy

Canonical rules: [UI_DESIGN_SYSTEM.md — Hover copy icon](./UI_DESIGN_SYSTEM.md#hover-copy-icon).

- `Products & Services` name cells (Client devices, Products, Services, Suppliers) use `CatalogCopyableName` → `CopyableValue`. Name click still opens the row editor.
- **Suppliers** tab **Phone** also uses `CopyableValue`. Hover shows the copy icon after the number. Only the icon copies the stored phone (`+380…`). The number stays a `tel:` link (`stopPropagation` so row click does not open the supplier). Empty phone: no icon.
- Implementation: `frontend/src/widgets/dashboard/ui/product-catalog/ProductCatalogTables.tsx` (`SuppliersTable`).

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
