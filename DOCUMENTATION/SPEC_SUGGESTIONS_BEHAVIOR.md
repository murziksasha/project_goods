# Suggestions Behavior Spec

## Scope
Applies to all lookup/autocomplete suggestion lists in the project.

## Rule
When a user selects an entity from suggestions:
1. The selected entity data must be applied with existing business logic (unchanged).
2. The suggestion list must hide immediately in UI.
3. Suggestions may appear again only after user starts a new manual edit in the related input.

## Product Lookup Rule
For product suggestion fields in sales/order flows:
1. Lookup must match by normalized `name`, `article`, `serialNumber`, and relevant stock `note`.
2. Minimum query length is 2 characters; suggestions are debounced per field.
3. Stock matches are ranked: exact serial, exact article, partial serial, partial article, partial name.
4. Selectable warehouse stock rows appear before catalog fallback rows with the same model name.
5. Unavailable stock models suppress duplicate catalog fallback suggestions.
6. This rule applies to all of the following surfaces:
   - `Create order` -> `Sales order` product field
   - `Rapid sale` product field
   - Opened **sale card** -> `Products` section add-row input
   - Opened **repair order card** -> `Products` section add-row input
7. All four surfaces share one frontend helper: `buildCreateOrderProductSuggestions` in `frontend/src/widgets/dashboard/model/create-order-products.ts`.
8. Opened order/sale card input placeholder: `orders.detail.lineItems.addProductPlaceholder` (`Name, serial or article` / `Назва, серійний номер або артикул`).
9. In opened order/sale cards, selecting a stock suggestion by serial query auto-adds one atomic serialized row; selecting by article or name pre-fills the entry row and requires `Add product`.

## Modal Layout Rule
In modal forms with lookup fields (supplier/client/product/service/device):
1. Suggestion dropdowns must be rendered out of document flow (overlay/absolute layer).
2. Dropdown must be visually attached to its input and open directly below the field.
3. Opening/closing suggestions must not change modal grid height or shift surrounding controls.
4. This is a presentation-only rule and must not alter existing search, debounce, or selection business logic.

## Notes
- This rule applies uniformly for clients, products, devices, suppliers, services, and merge selectors.
- Debounce/min-symbol thresholds for loading suggestions are configured per field and do not change this rule.

## Create Order Device Rule
For `Create order` -> `Repair order` -> `Device #1`:
1. `Create new` must be disabled when an existing device is selected from suggestions.
2. `Create new` must be disabled when input has an exact existing device match (case-insensitive).
3. This prevents accidental overwrite/update flows for existing catalog devices and avoids duplicate-creation confusion.
