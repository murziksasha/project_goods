# CLIENTS RULES

## Client Status Localization Rule
- Keep client status values in original English.
- Do not translate client status enums in UI labels, API payloads, or documentation.

## Automatic Status (Effective Status) Rule
- Stored `status` on a Client can be empty (`''`, UI label `-`) or one of: `new`, `ok`, `opt`, `vip`, `blacklist`.
- Auto-managed stored values: `''` and legacy/default `new` (created before manual override).
- Manual overrides (automation never changes these): `ok`, `opt`, `vip`, `blacklist`.
- `getEffectiveClientStatusLogic(storedStatus, visitCount)` determines what to display:
  - If stored === 'blacklist' → always 'blacklist'.
  - If stored is a manual override (`ok`, `opt`, `vip`) → use stored as-is.
  - If stored is auto-managed (`''` or `new`) → derive:
    - visits >= 10 → 'vip'
    - visits >= 5 → 'opt'
    - visits >= 3 → 'ok'
    - otherwise → 'new'
- New clients are created with stored status `''` (auto mode). Employee sets `ok` / `opt` / `vip` / `blacklist` to pin a status; set back to `-` (`''`) to resume automation.
- The effective value (not raw stored) is used for badges in lists/tables, status filters, and sale `clientSnapshot.status` at order create/update time.
- Visit count is derived from the number of sales/repairs linked to the client.

## Client Profit / Revenue (Total for Concrete Client)
- Per-client totals use the same order-total logic as dashboard analytics: sum of `getSaleTotal(sale)` per linked sale (line items when present, otherwise `salePrice * quantity`, minus discounts).
- "Client income" column in the clients list uses the aggregate from all known sales for that client.
- When viewing a concrete client's history/card, a total Revenue / profit summary must be shown for the visible rows (in addition to per-row amounts).
- The server-side `/clients/:id/history` returns `stats.totalRevenue` for the full lifetime; the UI may filter by period and recompute for the selection.

