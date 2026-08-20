# Repair Kanban Spec

Live Kanban board for **repair orders only** (`sale.kind = repair`). There is no separate Kanban persistence model: cards are the existing repair sales.

## Navigation

- Sidebar / command palette / mobile bottom nav: `PageKey = kanban` (`?page=kanban`).
- Orders workspace tab: `OrdersTab = kanban` (`?page=orders&ordersTab=kanban`).
- Both entry points render the same board UI inside `OrdersWorkspace`.
- Access mirrors repair orders visibility (`orders.view` / `orders.manage` / `repairs.execute` / related repair-capable permissions).

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

- Count label `Orders: N` / `Замовлень: N` (no pagination arrows).
- Search + favorites star.
- Simplified Filter panel fields: **Master**, **Date from/to** (+ inline **Save filter** after Date to).
- **Saved filters** reuse the same per-employee Orders saved-filter API (`scope=orders`, `tab=kanban`): list / save drawer / delete.
- No table columns gear.

## Interactions

- **Drag & drop** between visible columns (no transition matrix; no confirm dialog).
- **Click** card (outside master control) opens the existing Order Detail panel/modal while staying on the Kanban page/tab.
- **Master select** on the card uses the same employee options as Order Detail (`master` role or `repairs.execute`); change persists via the same main-info workspace save and stays in sync with the open order card.

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
- Status sets: `frontend/src/widgets/dashboard/ui/orders/workspace/orders-workspace-shared.ts`
- Nav: `PageKey` / `OrdersTab` in `frontend/src/pages/dashboard/model/types.ts`

## Change log

- 2026-08-20: Initial Kanban + `notPickedUp` status rules.
- 2026-08-20: Simplified Kanban toolbar/filter; removed `notPickedUp` column from board.
- 2026-08-20: Re-enabled per-user saved filters on Kanban (`tab=kanban`).
- 2026-08-20: Dropped Repair type from Kanban filter; moved Save filter after Date to.
- 2026-08-20: Inline master select on Kanban cards (synced with order detail).
