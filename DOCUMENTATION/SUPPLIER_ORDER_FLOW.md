# Supplier Order Flow

Extracted from [ORDER_FLOW.md](./ORDER_FLOW.md) for focused maintenance. Covers `Orders -> Supplier Order`, linked sale/order card flows, and the `Information` analytics tab.

## Related docs

- [ORDER_FLOW.md](./ORDER_FLOW.md) — repair/sales orders, serial linking to supplier orders
- [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) — receipt / stock after take-on-charge
- [SERIAL_NUMBER_SEQUENCE_SPEC.md](./SERIAL_NUMBER_SEQUENCE_SPEC.md) — serials assigned on take-on-charge
- [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md) — supplier/product lookup dismiss
- [index](./README.md)
- [ACCOUNTING.md](./ACCOUNTING.md) — supplier-order payment queue
- [Permission_Flow.md](./Permission_Flow.md) — `supplierOrders.view` / `supplierOrders.manage`

## Toolbar and filter panel

- Toolbar pattern matches Orders/Sales: left pagination (or count chip), **Filter** (badge = applied drawer filters), columns gear + **Reset columns**, star, search; right `Order from supplier`.
- `Supplier Order` + `Information` tabs require `supplierOrders.view` or `supplierOrders.manage`.
- `Order from supplier` requires `supplierOrders.manage`.
- Filter drawer (draft → Apply / Clear): order statuses, payment statuses (multi; empty = all), supplier, created by, product, order number, date from/to, date field (`delivery` default or `created`).
- Named saved filters use `GET/POST/DELETE /api/saved-filters` with `scope=orders` and `tab=supplierOrders`. Active/draft filters stay in `localStorage` (`project-goods.supplier-orders-filters`).
- Removable chips under the toolbar cover statuses, payment, supplier, created by, product, number, dates, date-field, search query, and starred.
- Toolbar search is live (number, product, supplier, created by, note). Enter / count chip opens the unique match.
- Starred-only is a live toolbar toggle. Column visibility persists in `project-goods.supplier-orders-columns`.
- Information tab uses the same applied filters. Gear, star, search, and create stay hidden.

## Table columns (gear)

Canonical order (keys): `number`, `product`, `quantity`, `price`, `total`, `paid`, `supplier`, **`createdAt` (Order date)**, `createdBy`, `deliveryDate`, `status`, `paymentStatus`.

- **`createdAt` / Order date** — order creation timestamp (`SupplierOrder.createdAt` from API); shown left of **Created by** / **Delivery date**.
- Labels: EN `Order date`, UK `Дата замовлення` (`orders.supplier.columns.createdAt`). `createdBy`: EN `Created by`, UK `Створив`.
- Locked column: `number` only.
- Hover on the order number shows a copy icon. Only the icon copies; number click still opens the order. Spec: [UI_DESIGN_SYSTEM.md — Hover copy icon](./UI_DESIGN_SYSTEM.md#hover-copy-icon).
- Default visible: `number`, `product`, `quantity`, `price`, `total`, `paid`, `supplier`, `createdAt`, `status`, `paymentStatus`. `deliveryDate` and `createdBy` are extras in the gear.
- Existing saved column prefs omit new keys until the user enables them; empty/invalid prefs restore the default set (`Reset columns` too).
- `Paid` uses unpaid (amber) styling when `paymentStatus = pending` and `total - paid > 0`.
- Past `deliveryDate` on open orders (`not` stocked / cancelled / unavailable / partially_completed) uses overdue tone (Europe/Kiev date).
- Footer totals are for the **filtered** set: order count, pcs, total, paid, outstanding.

## Row status window

- Status is a badge button (not native `<select>`); edit requires `supplierOrders.manage`.
- Manual statuses: Purchase request, Ordered, Approved, Stocked, Cancelled, Unavailable.
- Auto-only: Overdue, Partially stocked, Partially completed.
- Status menu renders in a portal; background scroll locked while open.
- Selecting `Stocked` triggers take-on-charge (bulk on collapsed multi-item parents).

## Modal and picker

- `SupplierOrderModal`: price/qty steppers (1 UAH / qty 1), supplier `Choose` nested picker (300ms debounce, 10/page). Supplier and catalog-product typeahead lists follow [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md#dismiss-without-select-rule).
- Content locked after receipt/final status or paid/`without_payment` (take-on-charge remains when allowed).
- Paid orders cannot be cancelled (`POST .../cancel` rejected).
- Full-order modal: **Cancel order** (confirm) cancels the unpaid order. **Cancel item** cancels one unreceived line (`new` / `approved` receipt), including on `approved` + paid/`without_payment` orders. There is no hard-delete.
- Product model modal `Purchase by serial` shows the unit's supplier-order number (same provenance as Warehouse Stock balances). Click opens this same `SupplierOrderModal` (item-scoped); hover copy icon copies the visible number. Serial # in that table has the same hover copy icon. Spec: [WAREHOUSE_FLOW.md §4.4](./WAREHOUSE_FLOW.md#44-product-model-detail-modal).
- Linked sale/order card `Supplier Order` tab shows a dollar pay icon after the status badge when Accounting queue rules allow payment (`finance.supplierOrders.pay`). Click opens a pay modal (`POST /finance/supplier-orders/:id/pay`); optional issue-without-payment uses `finance.supplierOrders.issueWithoutPayment`.
- After payment (`paymentStatus = paid`) the same slot shows a green check (not clickable). `without_payment` has no marker. The check is visible to anyone who can see the tab.

## Backdated delivery

- Past `deliveryDate` allowed on create/update.
- `GET /supplier-orders` runs reconcile + auto-overdue; manual progress must not revert on refetch.
- Multi-item orders: collapsed parent row by default; child rows item-scoped.

## Information tab

- Same filtered working set as Supplier Order tab (`filterSupplierOrders`).
- Gear hidden (no configurable columns). Custom SVG only (no chart library), tokenized surfaces.
- Builder: `buildSupplierOrderAnalytics(filteredOrders, now, { previousOrders })` in `frontend/src/widgets/dashboard/model/supplier-order-utils.ts`. UI: `SupplierInformationDashboard.tsx`.
- **Date Δ:** when Filter `dateFrom`/`dateTo` is set, previous window is the equal-length range immediately before (`getPreviousDeliveryDateRange`). The same `dateField` (`delivery` or `created`) is applied to both windows. No date filter → no Δ (same as Home `whole`). Hide a Δ chip when previous is 0.
- **KPI row:** spend (sparkline of `spendSeries`), paid + coverage bar, outstanding (risk tone when overdue outstanding > 0), open pipeline (not stocked / partially_completed / cancelled / unavailable / received). Compact row: order count + pcs, stocked rate.
- **Charts:** spend-over-time (hourly ≤1 day of `createdAt` span, daily ≤62 days, else monthly); status mix bar; payment mix bar (`pending` / `paid` / `without_payment` / `cancelled`).
- **Ranked bars:** top goods tabs Quantity | Value | Frequency; top suppliers tabs Spend | Outstanding; price min/max plus spread track (min–max, avg tick).
- **Signals:** overdue count + overdue outstanding ₴; late-risk 3 days; cancelled/unavailable %; avg lead time; top-1 supplier concentration (warning if ≥50%). Coverage is not repeated here (Paid KPI only).
- **Lead time:** average whole days from date-only `createdAt` to `updatedAt` for `stocked` / `partially_completed` / `receiptStatus=received`. Approximation — there is no dedicated `stockedAt`.
- **Open pipeline value:** sum of totals for orders that are not closed (`stocked`, `partially_completed`, `cancelled`, `unavailable`, or received).

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