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

## Blacklist Status Rule
- `blacklist` is a manual priority client status and must not be replaced by automatic visit-based status logic.
- Clients list rows with `blacklist` status must be visually marked with a red warning treatment and the `blacklist` badge.
- Client lookup suggestions in order creation must visually mark `blacklist` clients before the operator selects them.
- The blacklist warning in order creation must open the matched client card when clicked, so the operator can inspect the note/reason.
- `blacklist` is a warning state, not a hard validation block: creating repair and sale orders remains allowed.

## Additional Client Phones

### Goal

Allow operators to add any number of additional phone numbers directly in the
client card Main tab. The existing `phone` field remains the primary phone and
continues to be shown in tables, headers, order snapshots, and print forms unless
a later feature explicitly adds phone selection per order.

### User Experience

- In the client card Main tab, the Phone field should become a phone list.
- The first row is the primary phone and is always present.
- A small icon-style `+` button beside the phone section adds another phone row.
- Each added row has its own input and a small remove button.
- Removing an additional phone must not remove or clear the primary phone.
- Empty additional rows should be allowed while editing, but should be ignored
  when saving.
- Duplicate phone numbers inside the same client card should be blocked before
  save.
- Duplicate phone numbers across different clients should show the same style of
  validation feedback as the current primary-phone uniqueness error.
- The modal header should keep showing the primary phone. Additional phones can
  be shown in the Main tab only for this first implementation.
- The Add client panel may stay primary-phone-only unless the implementation
  intentionally expands that flow too; the requested scope is the client card.

### Data Contract

- Add `phones: string[]` to the client API shape.
- Keep `phone: string` as the canonical primary phone for backward
  compatibility.
- `phones[0]` must always equal `phone` after normalization.
- Existing clients without `phones` are interpreted as `{ phone, phones:
  [phone] }`.
- API create/update payloads should accept either the old `{ phone }` shape or
  the new `{ phone, phones }` shape.
- Normalization must trim, normalize Ukrainian phone formats, remove empty
  additional entries, and de-duplicate after normalization.
- A payload with only additional phones and an empty primary phone is invalid.

### Backend Plan

1. Extend `backend/src/domain/shared/types.ts` with optional `phones`.
2. Extend `normalizeClientPayload` in `backend/src/shared/lib/parsers.ts` to
   normalize a phone array and force the first normalized phone into `phone`.
3. Extend `backend/src/domain/client/model.ts`:
   - add `phones: { type: [String], default: [] }`;
   - keep `phone` required and unique;
   - include `phones` in `searchText`;
   - add validation that `phones` is non-empty after normalization and has no
     duplicates.
4. Add a unique index strategy for additional phones. Preferred approach:
   create a separate normalized `phoneIdentities: string[]` field with a unique
   multikey index. This protects primary and additional phones across all
   clients. If MongoDB index constraints conflict with empty arrays or existing
   duplicates, add a migration/repair step before enabling the index.
5. Update `assertUniqueClientPhone` in
   `backend/src/domain/client/service.ts` to check all normalized phone
   identities, not only `phone`.
6. Sale snapshots store `phones: string[]` for new and updated orders. Legacy
   orders without `phones` in the snapshot still match by primary phone only.
7. Update client import/export after the core change:
   - export additional phones as a separate semicolon-delimited column;
   - import the column into `phones`;
   - keep old workbooks compatible.

### Frontend Plan

1. Extend `frontend/src/entities/client/model/types.ts`:
   - `Client.phones: string[]`;
   - `ClientFormValues.phones?: string[]` or a required array once every caller
     is migrated.
2. Extend `ClientMainForm` and `ClientDraft` in
   `frontend/src/widgets/dashboard/model/clients-workspace.ts`.
3. When opening a client card, hydrate the form as:
   - `phones = client.phones?.length ? client.phones : [client.phone]`;
   - `phone = phones[0]`.
4. In `frontend/src/widgets/dashboard/ui/ClientCardModal.tsx`, replace the
   single Phone label with a compact phone-list component:
   - primary input;
   - repeated additional inputs;
   - icon-style add/remove controls;
   - per-row validation text.
5. Keep `onValidatePhone` behavior but adapt it to validate all non-empty phone
   rows. It should return false if any row is invalid or duplicated.
6. Update client search/filter helpers so query matching includes additional
   phones.
7. Update blacklist matching to compare the input phone against every phone on
   blacklist clients.
8. Client lookup, merge search, client filters, and order filters must match
   any stored phone. Suggestion rows may show all phones compactly; selected
   client fields keep the primary phone for display.

### Merge Rule

- Client 1 is the merge target and keeps its primary phone.
- All phones from Client 2 are appended to Client 1 unless already present.
- Client 2 is deleted after merge.
- Sales and history from Client 2 move to Client 1.
- Merge fails if any merged phone already belongs to a third client.

### Search Rule

- Every normalized phone on a client is globally unique.
- Search by any phone must find that client in clients list, merge lookup,
  order creation lookup, and order filters.
- Use `backend/src/scripts/backfill-client-phones.ts` with dry-run before
  applying legacy phone backfill in production.

### Tests

- Backend parser tests:
  - legacy `{ phone }` payload still works;
  - `{ phone, phones }` normalizes primary and additional phones;
  - empty additional values are removed;
  - duplicates collapse or fail according to the final validation decision.
- Backend service tests:
  - cannot create two clients where one client's additional phone equals the
    other client's primary phone;
  - cannot update a client to use another client's additional phone;
  - updating a client's own phones does not falsely trigger uniqueness errors.
- Frontend model tests:
  - client filters match additional phones;
  - blacklist matching detects additional phones.
- Component tests:
  - clicking `+` adds a phone row;
  - remove deletes only additional rows;
  - Save is disabled or blocked when an additional phone is invalid.
