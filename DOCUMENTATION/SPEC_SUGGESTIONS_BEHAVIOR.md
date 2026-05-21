# Suggestions Behavior Spec

## Scope
Applies to all lookup/autocomplete suggestion lists in the project.

## Rule
When a user selects an entity from suggestions:
1. The selected entity data must be applied with existing business logic (unchanged).
2. The suggestion list must hide immediately in UI.
3. Suggestions may appear again only after user starts a new manual edit in the related input.

## Product Lookup Rule
For product suggestion fields in sales flows:
1. Lookup must match by `name`, `article`, and `serialNumber`.
2. This applies to both:
3. `Create order` -> `Sales order` product field.
4. Product search in existing sales card line-item editor.

## Modal Layout Rule
In modal forms with lookup fields (supplier/client/product/service/device):
1. Suggestion dropdowns must be rendered out of document flow (overlay/absolute layer).
2. Dropdown must be visually attached to its input and open directly below the field.
3. Opening/closing suggestions must not change modal grid height or shift surrounding controls.
4. This is a presentation-only rule and must not alter existing search, debounce, or selection business logic.

## Notes
- This rule applies uniformly for clients, products, devices, suppliers, services, and merge selectors.
- Debounce/min-symbol thresholds for loading suggestions are configured per field and do not change this rule.
