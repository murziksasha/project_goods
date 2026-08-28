# Repair Kanban Spec

Related: [ORDER_FLOW.md](./ORDER_FLOW.md) · [ORDER_CARD.md](./ORDER_CARD.md) · [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md) · [index](./README.md)

Live Kanban board for **repair orders only** (`sale.kind = repair`). There is no separate Kanban persistence model: cards are the existing repair sales.

## Navigation

- Kanban is **only** an Orders workspace tab: `?page=orders&ordersTab=kanban`.
- There is **no** sidebar, mobile nav, or command-palette page item for Kanban.
- Legacy `?page=kanban` (optional `saleId`) remaps to `?page=orders&ordersTab=kanban`.
- Access mirrors repair orders visibility (`orders.view` / `orders.manage` / `repairs.execute` / related repair-capable permissions).
- The workspace tab strip can hide Kanban per employee (`uiPreferences.hiddenOrdersTabs`).

## Data sync

- Board reads the in-memory sales list already loaded for the dashboard (same source as Orders).
- Creating a new repair order with status `new` automatically shows a card in the **New** column after the sale appears in state (no extra Kanban create API).
- Status changes via drag & drop call the existing sale workspace update (`PATCH /sales/:id/workspace`) with optimistic UI + refetch/invalidate through the normal `onSaleUpdate` path.
- No WebSocket/SSE requirement for MVP.

## Columns

Visible pipeline (left → right):

1. `new`
2. `diagnostics`
3. `waitingParts`
4. `clientApproved`
5. `inRepair`
6. `refinement`
7. `ready`
8. `paid`

Hidden (no column): `issued`, `issuedWithoutRepair`, `clientRejected`, `notPickedUp`.

`notPickedUp` remains available in Orders list status select/filters, but is **not** a Kanban column.

## Toolbar (Kanban only)

- Count label `Orders: N` / `Замовлень: N` (no pagination arrows). `N` is the number of cards currently shown on the board: search + toolbar filters, summed across visible columns. Hidden statuses (`issued`, `issuedWithoutRepair`, `clientRejected`, `notPickedUp`) are excluded.
- When the search field is non-empty and `N === 1`, the count is a button: click (or Enter/Space) opens that order the same way as clicking the Kanban card. The same single-search open applies on the Orders list tab (the left count / `Orders: 1` chip). Empty search + one visible card stays a static label.
- Search + favorites star.
- Simplified Filter panel fields: **Master**, **Date from/to** (+ inline **Save filter** after Date to). Master options and matching use the assigned repair master (`sale.master`) only — never the order creator (`sale.manager`).
- **Saved filters** reuse the same per-employee Orders saved-filter API (`scope=orders`, `tab=kanban`): list / save drawer / delete.
- No table columns gear.

## Interactions

- **Drag & drop** between visible columns (no transition matrix; no confirm dialog). Cards are column drop targets, not a sortable list: overlay follows the pointer, the source stays as a hidden spacer, the hover column shows a placeholder, and the card lands in the target column immediately (reverts if status did not persist, e.g. Paid opening the payment modal).
- **Desktop (fine pointer):** whole-card drag, `distance: 6`. Empty columns can collapse to a 72px rail (header toggle); a column auto-expands if a card lands in it. Collapse set persists in `localStorage` (`project-goods.kanban-collapsed-columns`).
- **Touch / coarse pointer:** drag **only** from the 44px handle (`touch-action: none` on the handle, not the card). The card body pans the board/column and tap still opens the order. Activation: delay 120ms / tolerance 12px.
- **≤1024 navigator:** sticky status chips with counts. Tap jumps the board to that column. While dragging, chips are droppables (`rail:{status}`) and win collision over a peeking column body. `scroll-snap` is disabled for the duration of the drag (`data-dragging`). Horizontal auto-scroll is limited to `.repair-kanban-board`.
- **Move sheet:** every card with `canUpdateStatus` has **Move**. Opens a bottom sheet of the 8 visible statuses and calls the same `onStatusChange` path as a drop.
- **Layout:** phone ≤720 one full-width column (no 86vw peek); tablet 721–1024 two 50% columns; desktop ~260px columns. Column height uses `--kanban-chrome-offset` so the last card clears the mobile bottom nav.
- **Click** card (outside master, handle, and Move) opens the existing Order Detail panel/modal while staying on the Kanban tab.
- **Device name** on the card uses primary-blue (`--color-primary-strong`) so the appliance is scannable.
- **Total** (`formatCurrency(getSaleTotal(sale))`) is shown on the card only when `sale.lineItems.length > 0` (includes discount). Empty line items → no amount.
- **Master select** on the card uses the same employee options as Order Detail (`master` role or `repairs.execute`); change persists via the same main-info workspace save and stays in sync with the open order card.
- Column/card left accent uses status color tokens (aligned with the Home repair funnel).

## Status `notPickedUp`

| Concern | Rule |
|---|---|
| API/DB | Ordinary string status on sale (same as other repair statuses; no separate enum collection) |
| UI lists / filters / status select / i18n | Included like other repair statuses |
| `finalRepairStatuses` | Yes (grouped with finals for list/final UI) |
| `stockLockedRepairStatuses` | No — behaves like `ready` (no stock commit) |
| Issued / received-by capture | No — use `handoffRepairStatuses` only (`issued`, `clientRejected`, `issuedWithoutRepair`) |
| Yearly archive `SALES_TERMINAL_STATUSES` | No — device still on site |

## Implementation anchors

- Board UI: `frontend/src/widgets/dashboard/ui/kanban/RepairKanbanBoard.tsx`
- Navigator / move sheet: `RepairKanbanNavigator.tsx`, `RepairKanbanMoveSheet.tsx`
- Drop ids: `column:{status}` and `rail:{status}` in `repair-kanban.ts` (`kanbanCollisionDetection` prefers rail hits)
- Status sets: `frontend/src/widgets/dashboard/ui/orders/workspace/orders-workspace-shared.ts`
- Nav: `OrdersTab` in `frontend/src/pages/dashboard/model/types.ts`; `parseDashboardLocation` remaps `page=kanban`

## Change log

- 2026-08-20: Initial Kanban + `notPickedUp` status rules.
- 2026-08-20: Simplified Kanban toolbar/filter; removed `notPickedUp` column from board.
- 2026-08-20: Re-enabled per-user saved filters on Kanban (`tab=kanban`).
- 2026-08-20: Dropped Repair type from Kanban filter; moved Save filter after Date to.
- 2026-08-20: Inline master select on Kanban cards (synced with order detail).
- 2026-08-20: Fixed Kanban drag animation (column droppables + overlay; no sortable shuffle / fly-back).
- 2026-08-20: Toolbar `Orders: N` counts currently visible board cards (filters + visible columns), not all repair orders.
- 2026-08-20: Kanban Master filter lists master-capable employees and matches `sale.master` only.
- 2026-08-20: Kanban is tab-only (no sidebar/mobile/command-palette page). Device name is blue; total shows when line items exist. Search with exactly one match makes `Orders: 1` open that order.
- 2026-08-28: Touch/tablet board: no 86vw peek, drag handle, sticky navigator + rail droppables, Move sheet, auto-scroll, empty-column collapse on desktop, status accent colors.
