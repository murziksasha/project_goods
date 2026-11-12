# Browser Navigation (SPA History)

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [ORDER_FLOW.md](./ORDER_FLOW.md) · [index](./README.md)

## Purpose

This document describes how the React SPA handles browser **Back**, **Forward**, and **Refresh** without leaving the application. Navigation stays client-side via the native **History API** (`pushState` / `popstate`). React Router is not used.

## Architecture

```text
User action (sidebar, tab, open card)
        |
        v
DashboardPage.navigateTo()
        |
        +--> update React state (active page, tabs, saleId, ...)
        |
        +--> navigateDashboard() -> history.pushState (default)
                                      or replaceState (auth / normalize)

Browser Back / Forward
        |
        v
window "popstate" (single listener in DashboardPage)
        |
        v
parseDashboardLocation() -> applyLocationToState()
```

### Core module

- `frontend/src/pages/dashboard/model/dashboard-navigation.ts`
  - `parseDashboardLocation(search)` — read location from query string
  - `buildDashboardHref(location)` — build shareable URL
  - `navigateDashboard(location, { replace? })` — write history entry
  - `getOrderLink(saleId, kind)` — deep-link helper for order/sale cards

### Orchestrator

- `frontend/src/pages/dashboard/ui/DashboardPage.tsx`
  - `navigateTo()` — user-initiated navigation (state + history)
  - `applyLocationToState()` — restore UI from URL on `popstate`
  - One unified `popstate` listener (replaces per-widget listeners)

### What is NOT stored in history

- API payloads, client history, workspace lists, or other heavy data
- `history.state` stays `null` for ordinary navigation. The only exception is the orders client-card overlay, which pushes `{ clientCardOverlay: true }` so Back can close just the modal. The client id itself lives in the `clientCard` query param, not in `history.state`.
- Business data stays in React state / TanStack Query and is re-fetched as needed after refresh

## URL contract

All dashboard views share one path (`/` or the deployed SPA root). Section state is encoded in query parameters:

| Parameter | When present | Values / notes |
|-----------|--------------|----------------|
| `page` | Non-home sections | `orders`, `clients`, `employees`, `settings`, `accounting`, `catalog`, `warehouse` |
| `ordersTab` | `page=orders` | `orders`, `kanban`, `sales`, `supplierOrders`, `supplierInformation`, `ordersReports` |
| legacy `page=kanban` | parse only | remapped to `page=orders&ordersTab=kanban` (keeps `saleId`) |
| `createOrder` | Create-order card open | `repair`, `sale`. Not offered when `ordersTab` is `supplierInformation` or `ordersReports`. |
| `saleId` | Order/sale detail card open | Sale document id. Omitted while `createOrder` is set. |
| `clientCard` | Client card opened from Orders | Client id. Kept only while `page=orders`. May sit beside `saleId` or `createOrder`. Dropped on every other page, including the Clients menu. Sidebar links do not include it. |
| `accountingTab` | `page=accounting` | `cashboxes`, `transactions`, `orders`, `information`, `reports` |
| `inviteToken` | Invitation registration | Unrelated to dashboard navigation; preserved on auth flows |

Examples:

- Home: `/`
- Orders workspace: `/?page=orders&ordersTab=orders`
- Open repair card: `/?page=orders&ordersTab=orders&saleId=<id>`
- Client card over that repair: `/?page=orders&ordersTab=orders&saleId=<id>&clientCard=<clientId>`
- Client card over Create sale: `/?page=orders&ordersTab=sales&createOrder=sale&clientCard=<clientId>`
- Create sale: `/?page=orders&ordersTab=sales&createOrder=sale`
- Orders Information: `/?page=orders&ordersTab=supplierInformation`
- Orders Reports: `/?page=orders&ordersTab=ordersReports`
- Accounting transactions: `/?page=accounting&accountingTab=transactions`
- Accounting reports: `/?page=accounting&accountingTab=reports`
- Accounting information: `/?page=accounting&accountingTab=information`

## pushState vs replaceState

| Action | History method |
|--------|----------------|
| Sidebar page change | `pushState` |
| Orders / supplier tab change | `pushState` |
| Open / close create-order card | `pushState` |
| Open / close order or sale detail card | `pushState` |
| Open client card from Orders, Sales, an order/sale card, or Create-order blacklist | `pushState` with `{ clientCardOverlay: true }`. Sidebar stays on Orders. |
| Close that overlay with Back, Esc, X, Cancel, or backdrop | `history.back()` when the current entry has the overlay flag. Otherwise `replaceState` strips `clientCard` (refresh / direct load). |
| **Client list** from that overlay | `replaceState` to `page=clients` (no `clientCard`). Back returns to the previous order screen. |
| Left-click an order/sale from that overlay (list or open card, not Create order) | `replaceState` to that `saleId` and drop `clientCard`. Back does not reopen the overlay. |
| Accounting sub-tab change | `pushState` |
| Warehouse stock → client order link (left click) | `pushState` |
| Login / logout / invite cleanup | `replaceState` |
| Permission redirect to home | `replaceState` |
| Initial URL normalization on first authenticated load | `replaceState` |
| Unauthenticated session (force home URL) | `replaceState` |

Duplicate entries are skipped: if the target URL equals the current URL, no history write occurs.

## Back / Forward behavior

- Each in-app navigation pushes a new history entry, so **Back** walks through prior dashboard views (pages, tabs, open cards) inside the SPA.
- **Forward** restores entries after Back.
- If Back leaves the site (e.g. returns to Google), the app was not building a client-side stack (full reloads or `replaceState`-only updates). The current implementation avoids that for normal in-app clicks.
- Middle-click / Ctrl+click on sidebar links still opens the correct URL in a new tab (full load + SPA bootstrap). Ordinary left-click uses `preventDefault` and `navigateTo()`.

## localStorage fallback

`localStorage` remains a secondary persistence layer for convenience on empty URLs and refresh:

- `project-goods.dashboard-page` — last active main page
- `project-goods.orders-tab` — last orders workspace tab
- `project-goods.accounting-tab` — last accounting sub-tab

Which orders workspace tabs are shown (gear checkboxes after Reports) is **not** in localStorage. It is stored per employee in MongoDB (`uiPreferences.hiddenOrdersTabs`) and loaded with `GET /auth/me`. A hidden `ordersTab` in the URL falls back to the first still-visible permitted tab.

On **Back / Forward**, the URL is authoritative. `localStorage` must not override URL-derived state during `popstate`.

## Workspace-specific rules

### Orders / Sales

- Opening a card updates `saleId` in the URL and pushes history; closing the card clears `saleId` and pushes again so Back can reopen the card.
- **Rapid sale** (`Create order -> Sales order -> Rapid sale -> Issued`):
  - Before issue: URL may include `createOrder=sale` while the create-order shell is open.
  - After successful issue, `handleRapidSaleCreated` navigates to `/?page=orders&ordersTab=sales` with `createOrder` and `saleId` both cleared.
  - Payment modal opens on the sales list via React state `pendingPaymentSale` (not encoded in the URL).
  - `saleId` stays unset until the operator opens the sale card manually from the list; Back/Forward does not replay the payment modal.
  - See [SALE_FLOW.md](./SALE_FLOW.md#rapid-sale-2026-06-24) for full UX rules.
- Deep links from client card, warehouse stock table, and in-app cross-links use `getOrderLink()` / `navigateTo()`.
- Create-order sidebar request numbers still open in a **new browser tab** (`target="_blank"`) by design; see [ORDER_FLOW.md](./ORDER_FLOW.md).

### Client card

- `Clients & suppliers -> Client card -> Orders` / `Sales` numbers expose a valid `href` via `getOrderLink(saleId, kind)` (`ordersTab=orders` for repair, `ordersTab=sales` for sale). `getOrderLink` never includes `clientCard`.
- **Clients menu.** Left click opens the order/sale card inside the SPA (`onOpenSaleCard` → `navigateTo()` push), closing the client modal. The Clients menu does not push the overlay history flag.
- **Orders overlay** (`clientCard` on `page=orders`). Left click of a history row or number replaces the overlay entry with that order and closes the modal. From Create order (`createOrder` still set), the same left click opens the link in a new tab and leaves the overlay and the draft in place.
- **Right-click** shows the native browser “Open link in new tab”. **Middle click / Ctrl+click** opens the deep-link URL in a new tab (`?page=orders&ordersTab=...&saleId=...`) and is not handled as an in-app or forced-new-tab click.
- Number-cell clicks always `stopPropagation` so a modified click does not also fire the row handler in the current tab.
- Hover copy icon on the number copies the visible `recordNumber` and does not navigate. Spec: [UI_DESIGN_SYSTEM.md — Hover copy icon](./UI_DESIGN_SYSTEM.md#hover-copy-icon).
- Full overlay rules (Client list button, no page change, save patch): [CLIENTS_RULES.md](./CLIENTS_RULES.md#client-card-tabs).

### Accounting

- Sub-tab changes call `navigateTo({ page: 'accounting', accountingTab })`.
- `useAccountingPreferences` no longer owns its own `popstate` listener; it registers a sync callback with `DashboardPage` and accepts `syncedAccountingTab` from the parent on history navigation.

### Warehouse

- `Client order` links in `Stock balances` expose a valid `href` for new-tab opens.
- Left click calls `onOpenSaleCard` → `navigateTo()` (SPA navigation, no full reload).
- Hover copy icon on `Client order` / `Supplier order` copies the visible number and does not navigate. Spec: [UI_DESIGN_SYSTEM.md — Hover copy icon](./UI_DESIGN_SYSTEM.md#hover-copy-icon).

## Deployment / backend

- **Dev:** Vite dev server serves the SPA; `/api` is proxied to the Node backend.
- **Prod:** `frontend/scripts/serve-with-api-proxy.mjs` serves `dist/` and falls back to `index.html` for unknown paths (SPA refresh on deep links).
- **Backend:** Express is API-only (`/api/*`). No server-side route changes are required for client history.

## Adding new navigable state

1. Extend `DashboardLocation` and `parseDashboardLocation` / `buildDashboardHref` in `dashboard-navigation.ts`.
2. Wire `navigateTo()` from the user action in `DashboardPage` (or pass a callback down).
3. Ensure `applyLocationToState()` restores the new field on `popstate`.
4. Use `pushState` for user steps; reserve `replaceState` for silent corrections.
5. Do not put large objects in `history.state`.
6. Add unit tests in `dashboard-navigation.test.ts`.

## Tests

- `frontend/src/pages/dashboard/model/dashboard-navigation.test.ts` — parse/build/navigate helpers
- `frontend/src/pages/dashboard/ui/DashboardPage.test.tsx` — push + popstate integration
- `frontend/src/widgets/dashboard/ui/accounting/useAccountingPreferences.test.tsx` — accounting tab navigation callbacks

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — frontend orchestration overview
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) — tab persistence vs URL authority
- [ORDER_FLOW.md](./ORDER_FLOW.md) — order deep-link URL shape
- [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) — warehouse → order links
- [ACCOUNTING.md](./ACCOUNTING.md) — accounting tab URL and cross-workspace links