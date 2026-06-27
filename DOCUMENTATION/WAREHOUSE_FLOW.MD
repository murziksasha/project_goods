# WAREHOUSE FLOW

## Purpose
This document defines current warehouse requirements for stock balances, receipts, and procurement-linked behavior.

## Navigation
- Warehouse tabs: `Stock balances`, `Receipts`, `Transfers`, `Settings`
- Related flow docs: [ORDER_FLOW.md](./ORDER_FLOW.md), [SALE_FLOW.md](./SALE_FLOW.md), [ACCOUNTING.MD](./ACCOUNTING.MD), [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md), [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md)

### Client order links (Stock balances)
- Column `Client order` renders linked sale/order numbers with a shareable `href` built via `getOrderLink(saleId, kind)`.
- **Left click** opens the order/sale card inside the SPA (`navigateTo` / `pushState`) — no full page reload; browser Back returns to the warehouse view.
- **Middle click / Ctrl+click** opens the deep-link URL in a new tab (full SPA load with `?page=orders&ordersTab=...&saleId=...`).

## Stock Balances Requirements

### 1) Column Visibility
- Column visibility menu (gear icon) is available in `Stock balances`.
- `Select` is locked and cannot be hidden.
- `Qty` and `Retail` are removed from the feature and from table layout.
- Active stock columns:
1. `Select`
2. `Name`
3. `Serial #`
4. `Article`
5. `Date`
6. `Purchase`
7. `Warehouse`
8. `Location`
9. `Client order`
10. `Supplier order`
11. `Supplier`
12. `Note`
13. `Action`

### 2) Supplier Column Source of Truth
- `Supplier` in `Stock balances` must show supplier where goods were bought.
- Value priority:
1. supplier name from linked supplier order (`supplierOrdersByProductId[product.id][0].supplierName`)
2. fallback to legacy product field `purchasePlace`
3. fallback `-`
- Search mode `By supplier`, the supplier filter, and the `Supplier` column must use this same priority so the visible value and filtering behavior stay consistent.

### 2.1) Supplier Order Provenance Is Unit-Level
- `Supplier order` in `Stock balances` is provenance of a конкретная складская единица (`Product` row / serial), not of a product name or catalog model.
- Source of truth for the supplier-order badge/link:
1. `product.supplierOrderId`
2. `product.supplierOrderItemIndex`
- The badge is shown only when both fields point to an existing supplier order and exact supplier-order item.
- Forbidden matching logic:
1. product name equality or similarity
2. article equality
3. `catalogProductId` shared by supplier-order items
4. substring/fuzzy matching between supplier-order item names and stock product names
- If a stock `Product` is absent from `Stock balances` by regular stock visibility rules (for example sold/issued stock), its supplier-order badge is not displayed there.
- If a legacy/historical stock row has no explicit supplier-order provenance fields, `Supplier order` must stay empty; the UI must not backfill or guess automatically.
- Take-on-charge must persist `supplierOrderId` and `supplierOrderItemIndex` on every created serialized `Product` row.

### 3) Product Warehouse Mapping Priority
- Stock display mapping priority:
1. `product.warehouseId` + `product.locationId`
2. fallback by `purchasePlace` (warehouse name match)
3. fallback to first configured warehouse/location

### 4) Return/Unbind Rule
- When product is unlinked from order and returned to stock, it must return to original warehouse/location.
- Source of truth: stored product warehouse metadata, not transient modal selection.

### 4.1) Issued Sale Visibility Rule
- Product linked to `Sales order` with status `issued` must not be shown in `Stock balances`.
- Matching is resolved only by strict linkage identifiers:
1. `productId` (from `sale.product.id` or `sale.lineItems[].productId`)
2. `serial` (from `sale.product.serialNumber` or `sale.lineItems[].serialNumbers[]`)
- After customer return flow is completed (refund + stock receive), sale status becomes `returned` and product may appear in stock balances again by regular stock rules.

### 4.2) Free vs Linked Stock Display
- `Stock balances` must clearly separate free stock units from linked units by data rules (not by product name/article similarity).
- `Free` unit:
1. product has `quantity > 0`
2. product is not matched to any `issued` sale by strict linkage (`productId` or `serial`)
- `Linked` unit:
1. product is matched to an `issued` sale by strict linkage (`productId` or `serial`)
2. such product is hidden from `Stock balances` until return is completed and sale status changes from `issued` to `returned`
- Order/Sale records without assigned serial must not auto-link to all goods with same name/article in stock list.
- Stock balance filtering logic is kept in a pure frontend helper (`src/widgets/dashboard/model/stock-balance.ts`) and must remain covered by unit tests for strict product/serial matching, warehouse fallback, and supplier fallback.

### 4.4) Stock Balance Working Register UI
- `Stock balances` is a compact operational register for finding and opening a stock unit quickly.
- Toolbar requirements:
1. show current filtered stock row count
2. show the number of active applied filters on the `Filter` button
3. use a search placeholder that matches the active search mode
- Table requirements:
1. header stays sticky while scrolling the stock table
2. rows use compact spacing for dense scanning
3. `Warehouse` and `Location` are displayed as readable badges
4. `Client order` and `Supplier order` links are displayed as compact badges
5. `Note` is a compact single-line column; long text is truncated with ellipsis and exposes the full note in the native hover tooltip
6. `Action` contains only the delete `X` control for the stock row
7. empty state must explicitly suggest adjusting search or filters

### 4.3) Serial Binding In Sale Card: Strict Product Match Only
- In `Sale card -> Bind serial numbers`, available serials must be loaded only for the exact product in line item.
- Source of truth for candidate list:
1. `lineItem.productId` strict equality with `product.id`
2. if `lineItem.productId` is missing (legacy data), allow only exact normalized product name equality (no partial match)
- Forbidden matching logic:
1. `includes` / substring checks between product names
2. fuzzy matching that can mix similar models (example: `Аеромиша G10S` and `Аеромиша G10S Pro`)
- Result requirement:
1. operator must never see serials from another product model in the same bind modal
2. serial picker must remain deterministic and model-safe even when names are similar

### 4.3.1) Serialized Sale Line Item Invariant
- Warehouse receipt creates one stock `Product` row per serialized unit; sale/order cards must preserve that unit-level identity.
- For serialized stock sales, persisted sale line items are atomic:
1. `lineItems[].kind = product`
2. `lineItems[].productId` points to the exact stock `Product`
3. `lineItems[].quantity = 1`
4. `lineItems[].serialNumbers` contains exactly one serial
5. that serial must equal the referenced stock `Product.serialNumber`
- A sale of two serialized units must be stored as two product line items, even when both units have the same product name/model.
- A product line item with a bound serial must not allow direct quantity increase.
- Binding multiple serials to a legacy product row must split that row into one atomic serialized row per selected serial.
- Backend workspace validation must enforce the same invariant before stock deltas are calculated.

### 4.4) Product Model Detail Modal
- In `Warehouse -> Stock balances`, clicking `Name`, `Serial #`, `Article`, or `Note` opens the shared product model modal for the row's exact product name.
- `Note` click opens the same modal so the operator can view or edit the full note in `MAIN INFORMATION -> Note`.
- The modal aggregates only `Product` rows whose normalized name exactly equals the opened name (trim + lowercase); similar names such as `Mi Box S Gen 3` and `Mi Box S Gen 3 Pro` must stay separate.
- The modal shows:
1. read-only model name
2. shared editable `article` and `note`
3. retail price from `salePriceOptions[0]`
4. wholesale price from `salePriceOptions[1]`
5. purchase / last batch price from `Product.price`
6. total/free/reserved stock grouped by warehouse/location using configured warehouse metadata
- Clicking the `Product model` label, model title, or copy icon near the title copies the exact product name to clipboard and shows a short copied tooltip.
- Modal content is grouped as an accordion:
1. `MAIN INFORMATION`
2. `PRICES`
3. `STOCK SUMMARY`
- Default accordion state: only `PRICES` is expanded; all other groups are collapsed.
- Saving the modal updates all and only matching `Product` stock rows.
- Saving does not update `CatalogProduct` and does not create stock rows.
- If no matching stock rows exist, balances are shown as zero and stock-backed fields cannot be saved.

### 4.5) Serial Label Printing (Stock Balances)

Warehouse serial labels use the dedicated print form **`Product barcode`** (`formId: warehouse-barcode`). It is separate from the order label form **`Barcode`** (`formId: barcode`). Template rules: [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md#product-barcode-warehouse-stock-label).

#### Entry Points

1. **Bulk print from toolbar** — `Stock balances` tab, printer icon in the warehouse toolbar.
2. **Single print from product model modal** — click `Serial #` in the stock table to open the modal with a print action for that exact stock row.
3. **Optional print after take-on-charge** — `SupplierOrderModal` checkbox `Print serial numbers after receipt` (uses the same print pipeline).

#### Selection Rules (Bulk Print)

1. Operator selects stock rows with the `Select` checkbox. Selection persists across pagination and filters until cleared.
2. Only rows with a non-empty trimmed `serialNumber` are printable.
3. Toolbar printer button is enabled only when `selectedSerialCount > 0`.
4. Toolbar tooltip shows the printable count, for example `Print selected: 30`.
5. Rows without a serial number may stay selected for other actions, but are excluded from the print payload.

#### Data Mapping

Each printed label is built from one stock `Product` row:

| Template variable | Source |
|---|---|
| `{{barcode}}` / `{{labelCode}}` | `product.serialNumber` (CODE128 value and visible code line) |
| `{{labelTitle}}` | `product.name` |
| `{{labelContact}}` | `product.article` (empty string when absent) |

#### Print Form And Settings Source

1. `WarehousePanel` receives merged `printForms` from dashboard settings (`applyPrintFormLocalOverrides` per employee).
2. Warehouse printing resolves the active form by `warehouse-barcode`.
3. On first load after rollout, if `warehouse-barcode` is missing in stored settings, the frontend creates it by copying layout settings from the current `barcode` form (margins, label size, orientation, layout blocks, active flag).
4. Operators tune warehouse labels in `Settings -> Print -> Product barcode` without changing order labels.

#### Single vs Multi Print Behavior

| Scenario | Items | Print mode | Result |
|---|---|---|---|
| Product model modal | 1 | single-label | one physical label page |
| Toolbar bulk print | 1 | single-label | one physical label page |
| Toolbar bulk print | 2+ | **batch-label** | one physical label page per selected serial |

Multi-print rules:

1. Frontend generates one `<section class="print-form print-form-label">` per printable item.
2. When `items.length > 1`, print HTML uses batch classes `print-html-label-batch` / `print-body-label-batch`.
3. In batch mode, `html/body` are allowed to grow vertically; each label section keeps the configured physical size and receives `page-break-after: always`.
4. Single-label mode keeps the existing one-label container (`overflow: hidden` on `html/body`) for order-like preview behavior.
5. `@page` size for every label page comes from the oriented `warehouse-barcode` label preset (default `40 x 25 mm`, landscape).

Implementation references:

- selection and toolbar action: `src/widgets/dashboard/ui/WarehousePanel.tsx`, `WarehouseToolbar.tsx`
- print pipeline: `src/widgets/dashboard/ui/orders-workspace-shared.ts` (`printWarehouseSerialLabels`)
- batch CSS: `src/entities/settings/model/printForms.ts` (`printLabelDocumentStyles`)

#### Operator Expectations

1. Selecting 30 rows with serial numbers must produce 30 label pages in the browser print preview.
2. Each page must scan the correct serial; barcode value equals the stock row serial, not article or product id.
3. Changing `Product barcode` size/orientation/margins in Settings must affect the next warehouse print without redeploy.
4. Order-card product model printing uses the same `warehouse-barcode` form when `printForms` are passed from `OrdersWorkspace`; otherwise it falls back to built-in defaults.

#### Regression Tests

- `orders-workspace-shared.test.tsx`: batch HTML classes and one `print-form-label` section per item.
- `printForms.test.ts`: `warehouse-barcode` migration copies settings from `barcode`.
- `ProductModelModal.test.tsx`: single-item print calls `printWarehouseSerialLabels` with one payload row.

## Receipts Requirements

### 5) Receipts Source
- `Warehouse -> Receipts` is projected from supplier orders.
- One supplier order with multiple items is rendered as multiple receipt rows.
- Frontend source of truth for supplier-order-backed receipt rows is the TanStack Query `supplierOrders` cache.
- Loading supplier-order-backed receipt rows requires `supplierOrders.view` or `supplierOrders.manage`; without it the query is disabled and only local/manual receipt rows remain available.
- Creating/editing/cancelling/taking-on-charge supplier-order-backed receipt rows requires `supplierOrders.manage`.
- Manual receipt rows created only inside the warehouse UI remain local UI/session rows and are composed after supplier-order-backed rows.

### 6) Row Click Behavior
- Click `#` -> open `SupplierOrderModal` for конкретная позиция заказа (item-level), not full order payload.
- Click `Product` -> open product editor from catalog.
- Click `Supplier` -> open supplier editor from suppliers catalog.
- If catalog/supplier entity is not found, show explicit error toast.
- Click `#` must work for every supplier-order status when the order exists and the employee has supplier-order read access.
- If the linked item/order is already received/stocked or otherwise locked, `SupplierOrderModal` opens in read-only mode instead of refusing to open.

### 6.1) Supplier Order Item Numbering
- If supplier order has exactly one item, receipt row number is shown as base number without postfix: `<baseSupplierOrderNumber>`.
- If supplier order has 2+ items, receipt row numbers must use item postfix format: `<baseSupplierOrderNumber>-<N>`.
- `N` is 1-based item index in supplier order (`itemIndex + 1`), examples: `SO-1779142808517-1`, `SO-1779142808517-2`.
- Click by row number (with or without postfix, depending on item count) must open and process only that конкретное наименование товара (selected item), not all items from the supplier order.

### 6.2) Item-Level Suborder Status Model
- Supplier order with multiple items is treated in warehouse receipts as independent item-level suborders.
- Source of truth for receipt row status is `order.items[].receiptStatus`, not global `order.receiptStatus`.
- Initial status for each item is `new`.
- When operator takes on charge `...-N`, only selected `itemIndex` changes to `received`.
- Other items in the same supplier order (`...-2`, `...-3`, etc.) keep `new` until they are taken on charge individually.
- Receipt row status projection priority:
1. if `order.status = cancelled` OR `order.paymentStatus = cancelled` -> row status `cancelled`
2. otherwise -> `item.receiptStatus` (`new` / `approved` / `received`)

### 6.3) Supplier Order Modal Item List Editing
- In `SupplierOrderModal` (`src/widgets/dashboard/ui/SupplierOrderModal.tsx`), already added item rows must allow editing `К-сть`.
- Each already added item row must have remove action button `-` at row end.
- Remove action uses the same square toolbar visual style as add button `+`.
- Remove action deletes only selected row from current order item list.

### 7) Status/Cancel Projection
- Cancel action in receipt-linked supplier order must project receipt row status as `Cancelled`.
- Projection rule: if `status = cancelled` OR `paymentStatus = cancelled`, row state is `cancelled` regardless of previous `receiptStatus`.

### 8) Take-On-Charge Availability
- Action `Оприбуткувати` in receipt-linked supplier order is allowed regardless of payment state (`pending` / `paid`).
- Locks for action/edit:
1. selected item `receiptStatus = received`
2. `status = cancelled`
3. `paymentStatus = cancelled`

### 9) New Receipt Order Initial State
- New supplier order created from `Warehouse -> Receipts` starts as `approved` (not auto-`stocked`) to allow later receiving.
- Creating this receipt order is a supplier-order mutation and requires `supplierOrders.manage`.
- Receipt rows linked to supplier orders show the same row star as `Orders -> Supplier Order`.
- The `Warehouse -> Receipts` toolbar star button toggles starred supplier-order receipts only; manual receipt rows are excluded while this filter is active.
- Changing a receipt row star updates the linked supplier order favorite state and requires `supplierOrders.manage`.

### 10) Per-Unit Materialization
- Take-on-charge creates one product row per unit (`quantity = 1` each), each with unique `serialNumber`.
- For one item/suborder (`...-N`) all created units must share the same `article`.

### 11) Warehouse/Location Required On Take-On-Charge
- Operator must select `warehouse` and `location`.
- API payload must include `warehouseId` and `locationId`.
- Successful take-on-charge must invalidate/refetch supplier orders and product stock data so receipt status and stock balances stay in sync.

### 11.1) Article Behavior In Take-On-Charge Modal
- In `Оприходование` modal, checkbox `Автогенерация артикулов` is disabled by default.
- When enabled: backend generates one article for the selected item (suborder) in sequence `A000001`, `A000002`, ... and applies this single article to all units of that item quantity.
- When disabled: UI shows one manual `article` input; entered value is applied as-is to all units of that item quantity.
- When disabled and input is empty: take-on-charge is still allowed, and products are stored with empty `article`.
- Article is not required to be globally unique.
- `SO-*` pattern is not used for article generation anymore (legacy branch removed).

### 11.2) Manual Status Change To `Оприбутковано` In `Warehouse -> Supplier Order`
- Scope: only manual status change in `Orders -> Supplier Order` list (`Status` badge/window in row).
- Status field in row must stay manually editable through the supplier-order status window for all supplier order statuses.
- Edit lock exception: when `paymentStatus = cancelled`, status control is disabled.
- If operator changes status to `stocked` (`Оприбутковано`) from that list:
1. UI must skip take-on-charge modals.
2. UI must call take-on-charge flow directly (not plain status update).
3. Target warehouse/location: default warehouse pair (first active warehouse and its first location).
4. Serial numbers: auto-generated (equivalent to modal flow where user keeps defaults and clicks `Оприбуткувати`).
- For all other flows and entry points, existing сценарий must stay unchanged (modals + explicit operator choices).
- Status window visual/scroll behavior is documented in `ORDER_FLOW.md` under `Supplier Order Row Status Window`.

## Transfers Requirements

### 12) Transfer Purpose
- `Warehouse -> Transfers` moves existing stock items between configured warehouses and locations.
- Target warehouse/location options are loaded from `Warehouse -> Settings -> Warehouses`.
- Locations created later in settings must become available in transfer target selectors without code changes.
- Warehouse settings are loaded through the TanStack Query `warehouseSettings` cache; the panel may mirror them into editable local form state while the operator is changing settings.

### 12.1) Transfer Item Selection
- The right-side stock list shows filtered stock items for the current `Transfers` tab.
- Each visible row is clickable as a whole row.
- Clicking a row selects that product into the transfer `Product` field.
- The selected row must be visually highlighted.
- Keyboard selection must work with `Enter` or `Space` on the focused row.
- The `Product` select may include all currently filtered stock items, not only the current visible page.

### 12.2) Transfer Pagination
- `Transfers` uses the shared top page arrows from the warehouse toolbar.
- Page size for the right-side transfer stock list is fixed at `8` rows.
- Paging in `Transfers` must advance/return by 8 stock rows.
- This transfer page size does not change the user-selected page size for `Stock balances` or `Receipts`.

### 12.3) Transfer Validation
- Operator must choose a product, target warehouse, and target location.
- Transfer action is disabled until all required values are present.
- Transfer to the same current warehouse/location is blocked with an explicit error.
- Current location is displayed from product warehouse metadata.

### 12.4) Transfer Persistence
- Transfer saves to product warehouse metadata:
1. `product.warehouseId = target warehouse id`
2. `product.locationId = target location id`
- If operator enters a transfer note, it is appended to product note as transfer context.
- After successful transfer, product data must be refreshed from API/query cache.
- Successful transfer is recorded in the local session transfer history table with:
1. date
2. product/serial
3. source warehouse/location
4. target warehouse/location
5. operator
6. note

### 12.5) Transfer Scroll Behavior
- The right-side transfer stock list may keep its own horizontal scrollbar if table width exceeds available space.
- `Transfers` stock list must opt out from the global fixed horizontal scrollbar to avoid a second parasitic scrollbar over the transfer history header.
- Transfer history must not render a horizontal scrollbar by default.

## Global UI Requirement

### 13) Horizontal Scrollbar Accessibility
- If horizontal overflow appears, scrollbar must remain accessible at the bottom of app window.
- Implemented via global shared component `GlobalHorizontalScrollbar`.
- The component is mounted once in `DashboardPage` and synchronizes with visible `.catalog-table-wrap`.
- Wrappers may opt out with `data-global-scrollbar="off"` when the local view already provides an appropriate scrollbar and the fixed bar would overlap nearby content.

## Notes
- This document is normative for warehouse UI/UX and data mapping.
- Any warehouse behavior changes must update this file in the same task.
