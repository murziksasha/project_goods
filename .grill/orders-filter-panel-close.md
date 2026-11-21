# Filter panel close and Save filter sheet

## Outcome

The gray filter panel gets the existing top-right `×` (`.orders-filter-panel-close`). Clicking it only hides the panel. Draft and applied filters stay. The Save filter sheet on Supplier Order, Clients, and Catalog becomes the same full-height right sheet as Orders, above the table and the top bar.

## Decisions

- `×` goes on Orders, Kanban, Sales, Supplier Order, Information (same panel as Supplier Order), Clients, the Suppliers tab, Catalog, and Warehouse.
- `×` does not Apply, Clear, or revert the draft. The Filter button still toggles the panel.
- A click on the page outside the gray panel still does not close it. An open status menu still closes on an outside click, as it does today.
- Escape, on every panel above, closes in this order: Save filter sheet, then an open status menu, then the gray panel. Orders, Kanban, and Sales already do this. Draft is not reset.
- Save filter stays open until the save succeeds. An empty name or a failed request leaves it open. Save is disabled while the request runs so a second click cannot create a duplicate. `×`, Cancel, and Escape still close the sheet immediately; a request already in flight is not cancelled.
- If Save is already in flight and the sheet is closed and opened again before the response arrives, the successful save resolves for the prior session and does not close the reopened sheet or clear its newly entered name.
- Choosing a saved filter from inside the shared sheet applies it and closes the sheet. The gray panel is left as each screen already treats it: Supplier Order closes the panel; Clients and Catalog leave it open. Orders and Warehouse sheets stay open on that click, as they do today.
- Accounting, Analytics, Weather, and the employee date filter already have a close control. They stay as they are.

## Why the sheet hides under the table

`.orders-filter-panel` uses `transform`. A `position: fixed` descendant is then positioned against the panel, not the viewport. `SavedFiltersPanel` renders its sheet inside that panel, so the bottom (preview, saved list, Save / Cancel) slides under the table. Orders and Warehouse already render their sheet as a sibling outside the panel, which is why they are fine.

## Implementation Details

1. `SavedFiltersPanel`:
   - Portal the open sheet to `document.body` via `createPortal` with existing `.orders-filter-drawer-backdrop` (z-index 120).
   - Change `onSave` signature to `() => boolean | Promise<boolean>`.
   - Close the sheet only when `onSave()` resolves to `true`.
   - Maintain `isSaving` state to disable Save while pending.
   - Sheet closes immediately on preset selection click, sheet `×`, Cancel button, and Escape key.
   - Escape handler uses capture phase (`addEventListener('keydown', handler, true)`) and `event.stopPropagation()` so it runs before any panel handler.
   - Session tracking (`openSessionRef`): when Save is in flight, if the drawer is closed and opened again before the response arrives, the successful save resolves for the prior session and does not close the reopened drawer or clear its newly entered name.
2. Workspaces with `SavedFiltersPanel`:
   - Supplier Order (`SupplierOrdersWorkspace.tsx`): `saveCurrentFilter` returns `Promise<boolean>` (`false` on empty name or error after toast, `true` after preset creation and toast). Name clearing is managed by `SavedFiltersPanel` on session match.
   - Clients (`ClientsWorkspace.tsx`): `saveCurrentFilter` returns `Promise<boolean>` (`false` silently on empty name or error, `true` after preset creation).
   - Suppliers tab (`ClientsSuppliersWorkspace.tsx`): `saveSupplierFilter` returns `Promise<boolean>` (`false` silently on empty name or error, `true` after preset creation). Tab button has `role="tab"` and accessible label `Suppliers (count)`.
   - Catalog (`ProductCatalogPanel.tsx`): `saveCurrentFilter` returns `Promise<boolean>` (`false` silently on empty name or error, `true` after preset creation).
3. Panel Close `×` Button:
   - Add markup `<button type="button" className="orders-filter-panel-close" aria-label={t('orders.filters.closePanel')} onClick={onClose}>&times;</button>` inside gray panel.
   - New i18n key `orders.filters.closePanel`: EN "Close filters", UK "Закрити фільтри".
   - Wire `onClose` in `OrdersWorkspaceFilterPanel` (Orders, Kanban, Sales), `SupplierOrdersFilterPanel` (Supplier Order & Information), `ClientsFilterPanel`, `ClientsSuppliersWorkspace` (suppliers tab filter section), `CatalogFilterPanel`, and `WarehousePanel`.
4. Escape and Menu Closing:
   - Supplier Order: closes status menu, then payment menu, then panel. When panel closes, both menus are reset to closed.
   - Clients: panel closes on Escape.
   - Suppliers: panel closes on Escape.
   - Catalog: panel closes on Escape.
   - Warehouse: closes Save filter sheet, then receipt-status menu, then panel. When panel closes, receipt-status menu is closed.
5. Normative Documentation:
   - `DOCUMENTATION/SUPPLIER_ORDER_FLOW.md`
   - `DOCUMENTATION/REPAIR_KANBAN_SPEC.md`
   - `DOCUMENTATION/WAREHOUSE_FLOW.md`
   - `DOCUMENTATION/CLIENTS_RULES.md`
   - `DOCUMENTATION/STATE_MANAGEMENT.md`
