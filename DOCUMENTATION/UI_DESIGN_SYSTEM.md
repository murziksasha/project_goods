# UI Design System

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

## Tables

Shared table primitives: `.catalog-table`, `.catalog-table-wrap`, zebra rows, compact variants in [`lists.css`](../frontend/src/shared/styles/lists.css).

## Breakpoints

From [`responsive.css`](../frontend/src/shared/styles/responsive.css):

| Name | Max width | Notes |
|------|-----------|-------|
| Desktop | > 1024px | Default dashboard grid |
| Tablet | 1024px | Order detail sections collapse |
| Mobile | 720px | Stacked toolbars; Accounting tabs scroll/wrap; cashboxes stack; topbar title shrinks |
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
| `html[data-ui-density=compact]` | Compact table/toolbar density (Settings → Company) |
| `html[data-theme=light\|dark]` | Color theme (`project-goods.ui-theme` in localStorage; topbar ThemeSwitcher) |

## CSS file map

```
shared/styles/
  base.css          # tokens, client badges
  layout.css        # shell, catalog, toast, shared workspace
  forms.css         # buttons, fields, inline errors
  lists.css         # tables, pills
  responsive.css    # breakpoints
  domains/
    sidebar.css
    orders.css
    warehouse.css
    accounting.css
```

## Reference screenshots

Placeholder guide: [`frontend/screenshots/README.md`](../frontend/screenshots/README.md).