# Sale Flow Rules

## Create Order Modal (Sale Tab)

- Tab `Sales order` is used to create sale requests.
- Sale detail card header also exposes `Create order` (same permission and navigation rules as the toolbar button; responsive layout is documented in `ORDER_CARD.md` -> `Header`).
- Client lookup is performed by `Client phone` + `Client name`.
- If the entered phone or exact client name matches a client with status `blacklist`, the sales order form shows a non-blocking warning directly below the client fields.
- The blacklist warning must include the client name/phone and must not prevent saving the sales order.
- Clicking the blacklist warning opens the matched client card so the operator can read the client note/reason before continuing.
- If client does not exist and valid phone+name are provided, client can be created automatically in the same flow.

## Rapid Sale (2026-06-24, UX updates 2026-06-30)

Compact counter-sale flow for walk-in customers: no client form, warehouse stock products + services only, immediate issue path.

### Entry And Visibility

- Entry point: `Create order -> Sales order` tab, header button `Rapid sale` (`orders.rapidSale.openButton`).
- Button is shown only on the **Sales order** tab when `onRapidSale` handler is wired (dashboard `saveRapidSale`).
- Button sits in `create-order-header-actions` next to the close control; layout wraps on tablet/phone and must not break the create-order header.
- Opens `RapidSaleModal` — smaller than the full create-order page, reuses `catalog-edit-modal` shell classes for header/footer styling.

### Modal Shell And Scroll

- Modal grid rows: `header | entry panel | draft list | footer` (`.rapid-sale-modal`).
- Width `min(640px, 100vw - 28px)`; max-height `calc(100vh - 32px)`; outer shell uses `overflow: hidden`.
- While the modal is open, background page scroll is locked via `useLockBodyScroll()` (`document.body.style.overflow = hidden`; restored on close/unmount).
- Only the entry panel scrolls vertically; footer and draft block stay visible in the modal viewport.

### Modal Layout (Responsive)

- Scrollable entry panel (`.rapid-sale-body`) contains **only** Products and Services sections (no `catalog-edit-body` class on the scroll container).
- Draft items table (`.rapid-sale-items`) is a **sibling** between `.rapid-sale-body` and footer — always visible without scrolling the entry forms.
- Long draft lists scroll inside `.rapid-sale-items` (`max-height: min(220px, 32vh)`); horizontal scroll on narrow screens when needed.
- Product/service entry rows (`.rapid-sale-entry-row`) use the same breakpoint family as `sale-item-row`:
  - **wide:** search + price + qty + warranty + add action on one row
  - **`<=1024px`:** two columns; search and add action span full width
  - **`<=480px`:** single column stack; footer buttons full width
- Price grid column: `minmax(120px, 1.15fr)` so the stepper stays readable on desktop/tablet.
- Product suggestion lists (`.rapid-sale-suggestions`) keep fixed max height with internal scroll (no layout jump in the entry panel).

### Product Entry (Stock Only)

- Product section includes a **Warehouse** dropdown (`WarehouseSelectField`, active warehouses from `warehouse-settings`).
- Default warehouse: first created active warehouse (`getDefaultWarehouseId`).
- Product search and stock suggestions are scoped to the selected warehouse (`filterProductsByWarehouse`: `product.warehouseId`, with `purchasePlace` name fallback for legacy rows).
- Changing warehouse clears the in-progress product entry row (search, price, tier, qty, warranty, selected product/serials).
- Product search: min 2 characters, 200 ms debounce.
- Suggestions: `buildRapidSaleStockSuggestions` — **warehouse stock only** (`source: stock`, `selectable: true` rows). No catalog fallback.
- Catalog-only rows and manual product text are rejected on save (`orders.rapidSale.errors.stockOnly`).

#### Suggestion selection

- Clicking a stock suggestion pre-fills the active product entry row; operator confirms with `Add product` (two-step, not immediate draft insert).
- Pre-fill applies: `productId`, name, retail price (`salePriceOptions[0]`), `priceTier: retail`, qty `1`, warranty from product.
- If the suggestion has a serial, it binds in the entry row (`selectedSerialNumbers`) and locks qty stepper to `1` until add or search reset.
- Suggestions hide while `selectedProductId` is set; they reappear only after the operator edits the search field (which clears the product binding).
- Suggestion row format: `name / article / serial / availabilityLabel`.

See also [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md) -> Rapid Sale Serial Dedup Rule.

#### Serial numbers in draft

- Serial numbers already in the draft table, or currently bound in the active entry row (`pendingSerialNumbers`), are treated as occupied and **excluded** from stock suggestions (`orders.serialAvailability.alreadyInThisOrder`).
- Implementation: `getRapidSaleOccupiedSerialNumbers` + in-memory pseudo-sale `buildInMemorySerialUsageSale` merged into `sales` for `getSaleSerialUsage`.
- One serial maps to one draft line. Duplicate binding is blocked:
  - on `Add product` → `orders.rapidSale.errors.duplicateSerial`
  - on `Issued` → `validateRapidSaleDraft` returns the same error key
- Removing a draft line frees its serial for suggestions again.

#### Price and Retail / Wholesale toggle

- Entry price uses `ProductSalePriceField` with `tierTogglePlacement: label` and `fieldClassName: field rapid-sale-price-field`.
- When `salePriceOptions[1] > 0`, compact **R** / **W** badges render in the **Price label row** (next to the label text), not below the stepper — entry row height stays stable across stock selections.
- Stepper occupies the full price column width; label row keeps `min-height: 22px`.
- Default tier on stock selection: **retail**. Wholesale fills `salePriceOptions[1]`; manual edits allowed.
- Wholesale toggle is **not** shown in the draft items table (plain `NumberStepper` for post-add price override).

### Service Entry

- Service search: `getServiceCatalogItems`, min 2 characters, 350 ms debounce.
- Missing service names may be auto-created on add (same `missingService` helpers as create-order).
- Operator confirms with `Add service`.

### Draft Items List (Pinned Section)

- Added products and services appear in a pinned table between entry panel and footer: `Name`, `Price`, `Qty`, `Remove`.
- Product names show bound serials inline: `Name (S000003)`.
- **Price is editable** in the draft table via `NumberStepper` (manual override after add). Running total updates immediately (`orders.rapidSale.total`).
- `Qty` is display-only in the draft table (change qty before add, or remove and re-add).
- `Issued` stays disabled until `validateRapidSaleDraft` passes (at least one line, valid stock products, no duplicate serials, finite total).

### Draft Validation Errors (i18n)

| Key | When |
|-----|------|
| `orders.rapidSale.errors.noItems` | Empty draft on `Issued` |
| `orders.rapidSale.errors.stockOnly` | Product line without `productId` |
| `orders.rapidSale.errors.duplicateSerial` | Same serial in multiple draft lines or re-add attempt |
| `orders.rapidSale.errors.invalidTotal` | Non-finite or negative total |
| `orders.rapidSale.errors.serviceName` | Service name shorter than 2 chars |

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
- Frontend duplicate-serial protection applies to the draft only; backend `assertSerialNumbersNotBoundToOtherSales` checks other **saved** sales.

### Key Implementation Files

| Layer | Path | Role |
|-------|------|------|
| Modal UI | `frontend/src/widgets/dashboard/ui/orders/create-order/RapidSaleModal.tsx` | Layout, entry rows, draft table, scroll lock |
| Draft helpers | `frontend/src/widgets/dashboard/model/rapid-sale-line-items.ts` | Suggestions, validation, line-item builder |
| Serial occupancy | `frontend/src/widgets/dashboard/model/order-line-serials.ts` | `buildInMemorySerialUsageSale`, `collectOccupiedSerialNumbers` |
| Warehouse filter | `frontend/src/widgets/dashboard/model/warehouse-serial-filter.ts` | Scoped products, default warehouse |
| Shared price UI | `frontend/src/shared/ui/ProductSalePriceField.tsx` | Retail/wholesale stepper + `tierTogglePlacement` |
| Scroll lock | `frontend/src/widgets/dashboard/ui/product-catalog/product-catalog-shared.ts` | `useLockBodyScroll` |
| Styles | `frontend/src/shared/styles/layout.css`, `responsive.css` | `.rapid-sale-*`, `.rapid-sale-price-field` |
| List client label | `frontend/src/widgets/dashboard/model/sale-client-display.ts` | `Rapid sale` list label and search aliases |
| Entry button | `frontend/src/widgets/dashboard/ui/orders/create-order/CreateOrderCard.tsx` | Opens modal (sales tab only) |
| Create + payment | `frontend/src/pages/dashboard/ui/DashboardPage.tsx` | `handleRapidSaleCreated`, `pendingPaymentSale` |
| Save action | `frontend/src/pages/dashboard/model/dashboard-actions.ts` | `saveRapidSale` |
| System client | `backend/src/domain/client/rapid-sale-client.ts` | `getOrCreateRapidSaleClient()` |
| Create rules | `backend/src/domain/sale/service.ts` | `assertRapidSaleLineItems` |

Related: [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md) (URL behavior), [API.md](./API.md) (`POST /sales` payload), [SALE_CARD.md](./SALE_CARD.md) (opened card rules), [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md) (lookup + serial dedup).

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
- In `Sales order`, `Product search` uses the same split lookup rules as opened sale/repair cards (see [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md)):
  - serial/article query -> warehouse stock suggestions with bold warehouse name
  - name query -> `catalog-products` by `name` only
  - `note` is never matched
- Operator may type a product by:
  - product name
  - serial number
  - article

## Services During Create (Sales order)

- Below grouped `Products`, `Create order -> Sales order` shows a collapsible `Services` section.
- Default state: `Services` collapsed; `Products` always expanded.
- Expanded `Services` reuses existing service-catalog lookup (`getServiceCatalogItems`, debounce 350 ms, min 2 chars) and missing-service creation rules (`missingService` helpers).
- Operator may add multiple service rows before `Save order`; saved sale persists them as `lineItems[]` with `kind: service`.

## Product Suggestions

- Product search starts from 2+ characters.
- `Create order -> Sales order` and opened sale/repair card `Products` use `buildOrderDetailProductSuggestions`.
- `Rapid sale` keeps `buildRapidSaleStockSuggestions` / warehouse-scoped stock lookup.
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

## Wholesale Price Toggle (2026-06-30)

When a stock product is linked in a sale product entry row and `salePriceOptions[1] > 0`, the price field shows a compact **Retail / Wholesale** toggle (`ProductSalePriceTierToggle`: badges **R** / **W**).

| Surface | Toggle placement | Notes |
|---------|------------------|-------|
| `Create order -> Sales order` product rows | In the **Price** label row (`tierTogglePlacement: label`) | Class `sale-item-price-field sale-price-field-labeled`; price column ~130px |
| Opened sale/repair card add-row | Above the stepper (`tierTogglePlacement: compact`) | No duplicate **Price** label — table header provides the column title; entry row grid matches `.order-detail-table-wide-product` |
| Opened sale/repair card line-item table | Above the stepper (`tierTogglePlacement: compact`) | Shown only when line has `productId` and wholesale price is configured |
| `Rapid sale` entry row | In the **Price** label row (`tierTogglePlacement: label`) | Stepper full width below; column `minmax(120px, 1.15fr)`; class `sale-price-field-labeled rapid-sale-price-field` |
| Legacy `SaleForm` | In the **Sale price** label row (`tierTogglePlacement: label`) | Class `sale-price-field-labeled` |

### Behavior

- Default tier on stock selection: **retail** (`getRetailSalePrice`: `salePriceOptions[0]` when `> 0`, otherwise `product.price`).
- Clicking **Wholesale** fills the entry price with `salePriceOptions[1]`.
- Clicking **Retail** restores the retail price.
- Manual edits in the price stepper remain allowed; if the entered value no longer matches either tier, neither toggle button stays highlighted.
- Toggle is shown only when a concrete stock `productId` / `selectedProductId` is known and wholesale price is configured.
- Catalog-only or manual text rows keep the plain price stepper without toggle.

### Scope

1. `Create order -> Sales order` product rows (`CreateOrderSaleSection`)
2. Opened sale/repair card product entry row (`OrderDetailLineItemsPanel`)
3. Opened sale/repair card product line-item price cells when wholesale is configured (`OrderDetailLineItemsPanel`, `tierTogglePlacement: compact`)
4. `Rapid sale` product entry row (`RapidSaleModal`)
5. Legacy dashboard `SaleForm`

### Retail price pre-fill fix (bulk stock, 2026-06-30)

When selecting a warehouse stock suggestion **without** a bound serial in `Create order -> Sales order`, the active row must bind `productId` and pre-fill price via `formatRetailSalePrice` / `getRetailSalePrice`. Previously `productId` was cleared and price stayed empty when `suggestion.price` was `0`.

### Catalog name lookup with stock resolve (2026-06-30)

`Create order -> Sales order` name queries still use catalog suggestions (`buildOrderDetailProductSuggestions` catalog mode). On selection, `findSelectableStockProductByName` checks for a selectable warehouse product with the same normalized `name`:

- **Match found:** apply stock row (`productId`, retail/purchase price, optional R/W toggle).
- **No match:** keep catalog-only row (`catalogProductId`, price `0`).

Suggestion rows may show the resolved retail price before click when matching stock exists.

### Implementation References

- price helpers: `frontend/src/entities/product/lib/sale-prices.ts`
- shared UI: `frontend/src/shared/ui/ProductSalePriceField.tsx`
- styles: `frontend/src/shared/styles/layout.css` (`.sale-price-field-labeled`, `.product-sale-price-field-compact`, `.product-sale-price-tier-toggle`)

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

