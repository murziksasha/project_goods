# Suggestions Behavior Spec

## Scope
Applies to all lookup/autocomplete suggestion lists in the project.

## Rule
When a user selects an entity from suggestions:
1. The selected entity data must be applied with existing business logic (unchanged).
2. The suggestion list must hide immediately in UI.
3. Suggestions may appear again only after user starts a new manual edit in the related input.

## Notes
- This rule applies uniformly for clients, products, devices, suppliers, services, and merge selectors.
- Debounce/min-symbol thresholds for loading suggestions are configured per field and do not change this rule.
