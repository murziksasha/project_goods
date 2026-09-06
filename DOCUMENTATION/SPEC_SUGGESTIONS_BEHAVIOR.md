# Suggestions Behavior Spec

Related: [ORDER_FLOW.md](./ORDER_FLOW.md) · [SALE_FLOW.md](./SALE_FLOW.md) · [ORDER_CARD.md](./ORDER_CARD.md) · [SALE_CARD.md](./SALE_CARD.md) · [CLIENTS_RULES.md](./CLIENTS_RULES.md) · [SUPPLIER_ORDER_FLOW.md](./SUPPLIER_ORDER_FLOW.md) · [index](./README.md)

## Scope

Applies to all lookup/autocomplete suggestion lists in the project.

## Rule

When a user selects an entity from suggestions:

1. The selected entity data must be applied with existing business logic (unchanged).
2. The suggestion list must hide immediately in UI.
3. Suggestions may appear again only after user starts a new manual edit in the related input.

## Dismiss Without Select Rule

Canonical UI rule for every lookup/autocomplete list (clients, devices, products, services, suppliers, merge selectors).

Does **not** apply to always-visible chooser lists:

- `SerialBindModal` serial checklists
- `OrderDetailDeviceModal` device picker (`.order-device-options`)

When a suggestion list is open:

1. Pointer down outside that field’s **input and list** hides the list.
2. Escape hides the list and must not close the parent modal/page on that same keypress (window capture + `stopPropagation`).
3. The input value is unchanged; no suggestion is applied; no entity is bound.
4. Clicking the same field input does not hide the list.
5. After hide (dismiss **or** select), the list stays hidden until the operator adds or deletes at least one character in that field.
6. Focus-only does not re-open a dismissed list.
7. Debounce, min-length, ranking, and select-apply rules are unchanged.

**Device #1 example:** operator types `Телевізор Samsung`, longer catalog names stay in the list (`… 32`, `… 55`). Click Issue / Paid / other form chrome (or Escape) -> list gone, field still `Телевізор Samsung`. Save uses that typed name. Typing or deleting one character re-opens lookup.

**Create new:** dismissing the list does **not** mean “no active matches”. `Create new` on Device #1 stays disabled while active catalog matches exist (see **Create Order Device Rule**).

Implementation: `frontend/src/shared/lib/useDismissibleSuggestions.ts`. Attach `rootRef` to the widget that contains the input; attach `panelRef` when the list is not a DOM child of that widget. Visibility is `isActive && dismissedQuery !== query`.

## Product Lookup Rule (Create Order Sales Tab)

For `Create order -> Sales order` product rows (not rapid sale):

1. Lookup uses `buildOrderDetailProductSuggestions` — see **Card And Create-Order Products Lookup Rule** below.
2. Rapid sale uses a separate builder and rules — see **Rapid Sale Product Lookup Rule**.

## Rapid Sale Product Lookup Rule

For `Rapid sale` (`RapidSaleModal` product search):

1. Builder: `buildRapidSaleStockSuggestions` in `frontend/src/widgets/dashboard/model/rapid-sale-line-items.ts` (wraps `buildCreateOrderProductSuggestions`).
2. **Stock only** — no catalog fallback; non-selectable rows are filtered out.
3. Warehouse-scoped via `filterProductsByWarehouse` on the selected warehouse.
4. Lookup matches normalized `name`, `article`, `serialNumber`, and stock `note`.
5. Minimum query length: 2 characters; debounce: 200 ms.
6. Ranking: exact serial, exact article, partial serial, partial article, partial name.
7. Suggestions render inline below the product entry row (`.rapid-sale-suggestions`), not as a floating overlay — fixed max-height with internal scroll.
8. Suggestions are hidden while `selectedProductId` is set **or** the list was dismissed without select; they return only after the operator edits the search input (which also clears the product binding). Dismiss without select keeps the typed query (see **Dismiss Without Select Rule**).
9. Selection is two-step: click suggestion → pre-fill entry row → operator clicks `Add product` to move line into draft.

## Rapid Sale Serial Dedup Rule

For `Rapid sale` product suggestions (`buildRapidSaleStockSuggestions`):

1. Before calling `buildCreateOrderProductSuggestions`, collect occupied serial numbers from:
   - `draftItems[]` already confirmed with `Add product`
   - `pendingSerialNumbers[]` currently bound in the active product entry row
2. When the occupied set is non-empty, merge an in-memory pseudo-sale built by `buildInMemorySerialUsageSale` (`frontend/src/widgets/dashboard/model/order-line-serials.ts`) into the `sales` argument with `currentSaleId: ''`.
3. Reuse existing `getSaleSerialUsage` / `getProductSerialAvailability` rules; do not duplicate availability logic in the modal.
4. Occupied serials must not appear as selectable stock suggestions.
5. Removing a draft line frees its serial for suggestions again.
6. `validateRapidSaleDraft` and `Add product` must reject duplicate serial numbers inside the same rapid-sale draft (`orders.rapidSale.errors.duplicateSerial`).

## Card And Create-Order Products Lookup Rule

For `Create order -> Sales order`, opened **sale card**, and **repair order card** -> `Products` add-row input:

1. Lookup must **never** match `note` on stock or catalog rows.
2. Minimum query length is 2 characters; suggestions are debounced per field (250 ms).
3. Input placeholder: `orders.detail.lineItems.addProductPlaceholder` (`Name, serial or article` / `Назва, серійний номер або артикул`).
4. Mode split:
   - **Stock mode** (query matches at least one stock `serialNumber` or `article`, exact or partial): show selectable warehouse stock rows only.
   - **Catalog mode** (all other queries, including product name): show `catalog-products` matches by `name` only.
5. Stock mode ranking: exact serial, exact article, partial serial, partial article.
6. Stock suggestion rows must show warehouse name in bold, then `price / article / serial / availability`.
7. Frontend helper: `buildOrderDetailProductSuggestions` in `frontend/src/widgets/dashboard/model/create-order-products.ts`.
8. Selection behavior:
   - **Opened cards**:
     - Stock suggestion with a bound `serialNumber`: click immediately adds one atomic row (`quantity = 1`, `productId`, `serialNumbers[]`).
     - Stock suggestion without `serialNumber`: click pre-fills name/price only; operator confirms with `Add product`; serial binding uses the existing `Serials` modal flow.
     - Catalog suggestion: click pre-fills name/price and stores `catalogProductId`; operator confirms with `Add product`; serial binding uses the `Serials` modal flow.
     - Catalog suggestion with matching selectable warehouse stock by `name`: always pre-fills to stock (`selectedProductId`, retail price, `priceTier: retail`); operator confirms with `Add product`; serial binding uses the `Serials` modal flow (no immediate atomic add).
   - **Create order -> Sales order**:
     - Stock suggestion with `serialNumber`: pre-fills the active product row with `productId` and bound serial (`quantity = 1`).
     - Stock suggestion without `serialNumber`: pre-fills the active row with `productId`, name, and retail price (`getRetailSalePrice` / `formatRetailSalePrice`; fallback to purchase `product.price` when retail is missing or `<= 0`).
     - Catalog suggestion: pre-fills the active row with `catalogProductId`.
     - Catalog suggestion with matching selectable warehouse stock by `name`: pre-fills stock price hints (`productId` for R/W toggle, retail price via `getRetailSalePrice`) but does **not** bind `serialNumber`; operator may edit `qty > 1`; save omits `productId` when serialized stock is matched and `qty > 1` until serial binding in the opened card.

## Modal Layout Rule

In modal forms with lookup fields (supplier/client/product/service/device):

1. Suggestion dropdowns must be rendered out of document flow (overlay/absolute layer).
2. Dropdown must be visually attached to its input and open directly below the field.
3. Opening/closing suggestions must not change modal grid height or shift surrounding controls.
4. This is a presentation-only rule and must not alter existing search, debounce, or selection business logic.

**Exception — `Rapid sale`:** product/service suggestion lists stay in normal document flow below their entry rows (`.rapid-sale-suggestions`). Height is capped with internal scroll so the entry panel layout stays stable. Background page scroll is locked while the modal is open (`useLockBodyScroll`).

## Notes

- This rule applies uniformly for clients, products, devices, suppliers, services, and merge selectors.
- Debounce/min-symbol thresholds for loading suggestions are configured per field and do not change this rule.

## Create Order Device Rule

For `Create order` -> `Repair order` -> `Device #1`:

1. `Create new` must be disabled when an existing device is selected from suggestions.
2. `Create new` must be disabled when input has an exact existing device match (case-insensitive).
3. `Create new` must stay disabled while active catalog matches exist, even if the suggestion list was dismissed without a select.
4. This prevents accidental overwrite/update flows for existing catalog devices and avoids duplicate-creation confusion.
5. Repair Save still accepts the typed device name (≥ 2 characters) without selecting a suggestion.
