# UI Design System

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [index](./README.md)

Project Goods uses a custom CSS design system (no Bootstrap). Tokens live in [`frontend/src/shared/styles/base.css`](../frontend/src/shared/styles/base.css); domain layout rules are split under [`frontend/src/shared/styles/domains/`](../frontend/src/shared/styles/domains/).

## Design tokens

Tokens are defined on `:root` (light) and remapped under `html[data-theme='dark']` in `base.css`. **UI CSS must use tokens for surfaces/text/borders** — never hard-code `#fff` / light grays for app chrome (print HTML is the exception).

| Token | Light (example) | Usage |
|-------|-----------------|-------|
| `--color-primary` | `#2d8ae3` | Primary actions, links |
| `--color-danger` | `#dc3545` | Errors, destructive emphasis |
| `--color-success` | `#10b981` | Success states, opt client badge |
| `--color-on-accent` | `#ffffff` | Ink on solid primary/success/status badges (**not** `--bg-card`) |
| `--radius-panel` | `10px` | Cards, panels, workspace shells |
| `--sidebar-width` | `250px` | Dashboard grid first column |
| `--bg-card` | `#ffffff` / dark slate | Elevated card surfaces |
| `--bg-input` | white / dark | Form inputs, steppers |
| `--bg-zebra` | `#f7f7f7` / dark | Table even rows |
| `--bg-soft-primary` | blue wash | Soft highlights, selected rows |
| `--bg-soft-success` / `--bg-soft-danger` / `--bg-soft-warning` | tints | Soft status chips |
| `--bg-button-secondary` / `--bg-button-ghost` | pastels / slate | Secondary & ghost buttons |
| `--bg-shell-from` / `--bg-shell-to` | shell gradient | `.dashboard-shell` |
| `--bg-workspace` | `#f1f4f8` | Orders/warehouse page backgrounds |
| `--color-text-body` | `#4d637a` | Table cells, detail lists |
| `--color-line-panel` | `#cfd8e3` | Panel borders |
| `--space-1` … `--space-8` | `4px` … `32px` | Spacing scale |
| `--text-xs` … `--text-lg` | `0.76rem` … `1.125rem` | Type scale |
| `--focus-ring` | blue glow | `:focus-visible` rings |

Semantic aliases (`--accent-blue`, `--line-soft`) remain for backward compatibility.

### Dark mode rules

1. Theme attribute: `html[data-theme=light|dark]` (`project-goods.ui-theme` in localStorage; pre-paint script in `frontend/index.html` + `ThemeSwitcher`).
2. Prefer tokens over `html[data-theme='dark'] .foo` one-offs.
3. Never use `color: var(--bg-card)` as white text — use `--color-on-accent`.
4. Bulk helper: `frontend/scripts/replace-theme-tokens.mjs` (does not rewrite `base.css`).

## Typography

- **UI:** `Bahnschrift`, `Trebuchet MS`, `Segoe UI`
- **Headings:** `Cambria`, `Palatino Linotype`
- **Section labels:** uppercase, `0.95rem`, muted gray (`--color-text-label`)

## Buttons

CSS classes in [`forms.css`](../frontend/src/shared/styles/forms.css):

| Class | Role |
|-------|------|
| `.primary-button` | Main action |
| `.secondary-button` | Secondary confirm |
| `.ghost-button` | Neutral / modal close |
| `.success-button` | Positive commit |
| `.warning-button` | Caution |
| `.danger-button` | Destructive |

React wrappers: [`frontend/src/shared/ui/Button.tsx`](../frontend/src/shared/ui/Button.tsx), exported from [`shared/ui/index.ts`](../frontend/src/shared/ui/index.ts).

## Panels and modals

- `.panel`, `.panel-header`, `.panel-subtitle` — workspace sections
- React: `Panel`, `PanelHeader`
- Modals: `.modal-backdrop` + `.catalog-edit-modal`; React `Modal` component
- **Save-filter drawer** (orders / warehouse / clients shared classes in `domains/orders.css`):
  - `.orders-filter-drawer-backdrop` is `position: fixed; inset: 0` with **`z-index: 120`** so it stacks **above** sticky `.topbar` (`z-index: 90`) and the filter name field is not clipped under the site header
  - Used by `OrdersWorkspaceFilterPanel`, `SavedFiltersPanel`, and warehouse save-filter UI

## Status badges

CRM client palette (aligned with [`entities/client/model/constants.ts`](../frontend/src/entities/client/model/constants.ts)):

| Status | Token | Color |
|--------|-------|-------|
| new | `--status-new` | gray |
| vip | `--status-vip` | amber |
| opt | `--status-opt` | emerald |
| blacklist | `--status-blacklist` | red |
| ok | `--status-ok` | blue |

React: `StatusBadge` with `clientStatus` or `tone` prop.

Product model serial table (`ProductModelModal`, `layout.css`):

| Class | Role |
|-------|------|
| `.product-model-serial-purchases-table` | Compact `Purchase by serial` table: Serial #, Purchase, Receipt date, Supplier order |
| `.product-model-latest-batch-badge` | Newest receipt batch (`--bg-soft-primary-strong`) |
| `.product-model-reserved-badge` | Bound on another order (`--bg-soft-danger`, `--color-danger-soft`) |
| `.product-model-serial-row-reserved` | Reserved row wash; wins over latest/selected row background |
| `.product-model-serial-empty` | `—` for missing supplier-order provenance |

## Tables

Shared table primitives: `.catalog-table`, `.catalog-table-wrap`, zebra rows, compact variants in [`lists.css`](../frontend/src/shared/styles/lists.css).

## Hover copy icon

**Source of truth** for hover-to-copy on list/table values. Domain docs **link** here; they do not restate the rules.

Shared control: [`frontend/src/shared/ui/CopyableValue.tsx`](../frontend/src/shared/ui/CopyableValue.tsx). Clipboard helper: [`frontend/src/shared/lib/clipboard.ts`](../frontend/src/shared/lib/clipboard.ts). Catalog **names** wrap it via [`CatalogCopyableName.tsx`](../frontend/src/widgets/dashboard/ui/product-catalog/CatalogCopyableName.tsx). CSS: `.copyable-value` / `.copyable-value-copy` in [`layout.css`](../frontend/src/shared/styles/layout.css) (aliases `.catalog-name-copy-button` remain).

### Interaction

- Hover or `:focus-within` on the **value wrapper** (not the whole row) shows a copy icon as an inline sibling after the text.
- Only the icon copies. Clicking the value keeps the current flow: open order/sale/client/model/supplier, `tel:`, or row click.
- Icon click uses `preventDefault` + `stopPropagation` so star, expand, delete, and row handlers do not run.
- Empty / whitespace-only values have no icon.
- The icon is **not** `position: absolute` and must not cover the star, expand chevron, status badge, delete `×`, next column, or modal close.
- Hidden until hover by collapsing width (`width: 0`). On `@media (hover: none)` the icon stays visible.
- Success state (~1.4s) uses `--color-success` on the icon button.
- Labels: `common.copy` / `common.copied` / `common.copyFailed`. Catalog **name** idle label is `catalog.tables.copyName` (keep `copyName` / `copied` / `copyFailed` in `frontend/scripts/catalog-locale-*.json` so locale merge does not drop them).

### Clipboard payload

| Value | Copied text |
| --- | --- |
| Name, serial, order number | Visible string |
| Phone | Stored canonical value (`+380…`), not the grouped display |

### Surfaces

| Place | Hover targets | Wiring |
| --- | --- | --- |
| `Orders` / `Sales` tables | Order number, client phone | `OrdersWorkspace.tsx` |
| `Supplier Order` table | Order number (parent and child) | `SupplierOrdersWorkspaceSections.tsx` |
| Warehouse `Receipts` | Order number (lines + grouped parent) | `WarehouseTables.tsx` |
| Warehouse `Stock balances` | Name, Serial #, Client order, Supplier order (**not** Article / Note) | `WarehouseTables.tsx` |
| Product model modal `Purchase by serial` | Serial #, Supplier order number (order click still opens `SupplierOrderModal`; Latest/Reserved stay outside the serial copy target) | `ProductModelModal.tsx` |
| `Clients & suppliers` → Clients / Suppliers | Name, phone | `ClientsTable.tsx`, `ClientsSuppliersWorkspace.tsx` |
| Client card header | Blue `tel:` phone | `ClientCardModal.tsx` |
| Products & Services → Client devices / Products / Services | Name | `CatalogCopyableName` in `ProductCatalogTables.tsx` |
| Products & Services → **Suppliers** | Name **and** phone (`tel:` stays on the number; icon copies; row click still opens the supplier) | `ProductCatalogTables.tsx` `SuppliersTable` |

### Out of scope

- Product model modal title copy (separate `.product-model-copy-button` control)
- Warehouse Stock `Article` / `Note`
- Employee phones
- Client-card history order numbers
- Kanban cards

Domain links: [ORDER_FLOW.md](./ORDER_FLOW.md) · [SALE_FLOW.md](./SALE_FLOW.md) · [SUPPLIER_ORDER_FLOW.md](./SUPPLIER_ORDER_FLOW.md) · [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) · [CLIENTS_RULES.md](./CLIENTS_RULES.md) · [CATALOG_PRODUCT_CREATE_MODAL_SPEC.md](./CATALOG_PRODUCT_CREATE_MODAL_SPEC.md)

## Breakpoints

From [`responsive.css`](../frontend/src/shared/styles/responsive.css):

| Name | Max width | Notes |
|------|-----------|-------|
| Desktop | > 1024px | Default dashboard grid |
| Tablet | 1024px | Phone shell (drawer + bottom nav); tables stack into labeled cards; Kanban shows two 50% snap columns + sticky navigator (no 86vw peek); weather widget collapsed |
| Mobile | 720px | Stacked toolbars; create menu instead of two topbar buttons; Accounting tabs scroll/wrap; cashboxes stack; topbar title shrinks; Kanban is one full-width snap column |
| Finance refine | 530px | Extra full-width finance controls / tab padding |
| Phone | 480px | Tighter spacing, full-width controls, smaller finance tabs/title |

## Tier toggle (R / W)

`ProductSalePriceTierToggle` in order/create/sale flows:

- `role="group"` with `aria-pressed` per tier
- Arrow Left/Right switches retail ↔ wholesale when focused in the group
- Stepper step: 1 UAH (`PRICE_STEPPER_STEP`); see [`SALE_FLOW.md`](./SALE_FLOW.md)

## Component catalog (`shared/ui`)

| Component | File |
|-----------|------|
| `Button` | `Button.tsx` |
| `Panel`, `PanelHeader` | `Panel.tsx` |
| `StatusBadge` | `StatusBadge.tsx` |
| `Modal` | `Modal.tsx` (focus trap, Escape, backdrop/Escape close, restore focus; `subtitle`, `headerActions`, `shellClassName`, `headerClassName`) |
| `EmptyState` | `EmptyState.tsx` |
| `LoadingState` | `LoadingState.tsx` |
| `InlineError` | `InlineError.tsx` |
| `TableSkeleton` | `TableSkeleton.tsx` |
| `AccessDeniedPanel` | `AccessDeniedPanel.tsx` |
| `PageHeader` | `PageHeader.tsx` (title / subtitle / actions / toolbar) |
| `ThemeSwitcher` | `ThemeSwitcher.tsx` (light/dark, topbar) |
| `sidebarNavIcons` | `NavIcons.tsx` |
| `PaginationPanel` | `PaginationPanel.tsx` |
| `ProductSalePriceField` | `ProductSalePriceField.tsx` |
| `ProductSalePriceTierToggle` | `ProductSalePriceTierToggle.tsx` |
| `NumberStepper` | `NumberStepper.tsx` |
| `PhonesField` | `PhonesField.tsx` |
| `LanguageSwitcher` | `LanguageSwitcher.tsx` |
| `CopyableValue` | `CopyableValue.tsx` — hover copy icon; see [Hover copy icon](#hover-copy-icon) |

### Feedback states

| Class / component | Role |
|-------------------|------|
| `.empty-state` / `EmptyState` | No data |
| `.loading-state` / `LoadingState` | In-progress copy (`role="status"`) |
| `.inline-error` / `InlineError` | Form/auth errors (`role="alert"`) |
| `.table-skeleton` / `TableSkeleton` | Table loading placeholder |
| `.offline-banner` | Persistent offline strip in page shell |
| `.page-header` | Module header row (F2) |
| `.mobile-bottom-nav` | Phone bottom tabs ≤720px |
| `html[data-ui-density=compact]` | Compact table/toolbar density (Settings → Company → Appearance) |
| `.settings-group` | Card group on Settings tabs (appearance / identity / widget blocks) |
| `.settings-token` | Print-form placeholder chip (`{{company}}`) next to Company fields |
| `html[data-theme=light\|dark]` | Color theme (`project-goods.ui-theme` in localStorage; topbar ThemeSwitcher) |

## CSS file map

```
shared/styles/
  base.css          # tokens, client badges
  layout.css        # shell, catalog, toast, hover-copy (`.copyable-value`), shared workspace
  forms.css         # buttons, fields, inline errors
  lists.css         # tables, pills
  responsive.css    # breakpoints
  domains/
    sidebar.css
    orders.css
    warehouse.css
    accounting.css
    employees.css
    settings.css         # Settings tabs, groups, print builder chrome, backups, db report
    adaptive-tables.css  # card-stack tables, kanban snap, create menu
```

## Reference screenshots

Placeholder guide: [`frontend/screenshots/README.md`](../frontend/screenshots/README.md).