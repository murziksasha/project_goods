# Supplier Order Flow

Extracted from [ORDER_FLOW.md](./ORDER_FLOW.md) for focused maintenance. Covers `Orders -> Supplier Order`, linked sale/order card flows, and the `Information` analytics tab.

## Related docs

- [ORDER_FLOW.md](./ORDER_FLOW.md) — repair/sales orders, serial linking to supplier orders
- [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) — receipt / stock after take-on-charge
- [ACCOUNTING.md](./ACCOUNTING.md) — supplier-order payment queue
- [Permission_Flow.md](./Permission_Flow.md) — `supplierOrders.view` / `supplierOrders.manage`

## Toolbar and date panel

- Toolbar pattern: left `Data`, columns gear, `Search`, `Order status`, `Payment status`; right `Order from supplier`.
- `Supplier Order` + `Information` tabs require `supplierOrders.view` or `supplierOrders.manage`.
- `Order from supplier` requires `supplierOrders.manage`.
- `Data` panel: inclusive `Date from` / `Date to` / `Clear dates` filter on `deliveryDate`.
- Column visibility + starred-only filter persist in local storage.

## Table columns (gear)

Canonical order (keys): `number`, `product`, `quantity`, `price`, `total`, `paid`, `supplier`, **`createdAt` (Order date)**, `deliveryDate`, `status`, `paymentStatus`.

- **`createdAt` / Order date** — order creation timestamp (`SupplierOrder.createdAt` from API); shown left of **Delivery date**.
- Labels: EN `Order date`, UK `Дата замовлення` (`orders.supplier.columns.createdAt`).
- Locked column: `number` only.
- Existing saved column prefs omit new keys until the user enables them in the gear; empty/invalid prefs default to all columns.

## Row status window

- Status is a badge button (not native `<select>`); edit requires `supplierOrders.manage`.
- Manual statuses: Purchase request, Ordered, Approved, Stocked, Cancelled, Unavailable.
- Auto-only: Overdue, Partially stocked, Partially completed.
- Status menu renders in a portal; background scroll locked while open.
- Selecting `Stocked` triggers take-on-charge (bulk on collapsed multi-item parents).

## Modal and picker

- `SupplierOrderModal`: price/qty steppers (1 UAH / qty 1), supplier `Choose` nested picker (300ms debounce, 10/page).
- Content locked after receipt/final status or paid/`without_payment` (take-on-charge remains when allowed).
- Paid orders cannot be cancelled (`POST .../cancel` rejected).

## Backdated delivery

- Past `deliveryDate` allowed on create/update.
- `GET /supplier-orders` runs reconcile + auto-overdue; manual progress must not revert on refetch.
- Multi-item orders: collapsed parent row by default; child rows item-scoped.

## Information tab

- Same filtered working set as Supplier Order tab.
- Analytics: summary cards, popular goods, price/supplier analysis, overdue/late-risk signals.
- Gear hidden (no configurable columns).

## API touchpoints

| Endpoint | Permission |
|----------|------------|
| `GET /supplier-orders` | `supplierOrders.view` or `supplierOrders.manage` |
| `POST /supplier-orders` | `supplierOrders.manage` |
| `PUT /supplier-orders/:id` | `supplierOrders.manage` |
| `POST /supplier-orders/:id/take-on-charge` | `supplierOrders.manage` |
| `POST /supplier-orders/:id/cancel` | `supplierOrders.manage` (pending only) |
| `POST /supplier-orders/:id/cancel-item` | `supplierOrders.manage` |

Full auth matrix: [API.md](./API.md#authentication).