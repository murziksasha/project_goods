# Order Creation Rules

## Create Order Modal

- Clicking `Create order` opens the modal.
- `Client phone` + `Client name` perform lookup in clients.
- If client is not found and valid phone+name are entered, a new client is created automatically when user focuses `Device #1` (to bind `clientId` before device actions).
- Client phone is unique. If uniqueness fails, order creation is rejected.

## Repair Order Device Behavior

- `Device #1` searches in `Products & Services -> Clients goods` (client devices), globally across all clients (no `clientId` filter).
- Search returns only active client devices.
- Device suggestions in `Create order` are deduplicated by canonical device name (case-insensitive).
- If current `Device #1` value already exactly matches a suggested device name, that suggestion is hidden (no repeated selected item in dropdown).
- `Create new` button is visible but disabled until:
  - tab is `Repair order`
  - a client is selected from suggestions (required only for creating a new device card)
  - device name has at least 2 chars
  - no active matches are found
- New device is created in `client-devices` collection, not in warehouse products.

## Urgent Term

- If `Urgent repair` flag is selected during repair order creation, order term is shown as `Urgent` in light red.
- Otherwise term is `Non-urgent`.

## Repair vs Stock Product Separation

- Repair order creation no longer creates warehouse products from customer devices.
- Customer device name is stored in `Clients goods`; serial is stored only in order context/history.
- Field `Kit` from `Create order` is order-scoped and must not be written to `Clients goods.note`.
- On order creation, `Kit` is prepended to order `Notes` in format `(kits: ...)` as the first line.
- No automatic `Repair` service line item is injected into new repair orders.
- Removing service line items from order card is allowed and persisted.

## Prepayment

- Prepayment logic is fully removed from `Create order`.
- There is no prepayment input block in the create-order modal.
- New orders are created with `paidAmount = 0` and empty `paymentHistory`.

## Orders List Columns (`Orders` tab)

- Column `Received` is renamed to `Issued`.
- Column `Master` is added.
- `Issued` displays only the employee who performed the status change to one of final repair statuses:
  - `issued`
  - `client rejected`
  - `issued without repair`
- If no such status transition happened yet, `Issued` shows `-`.
- Every status change action is recorded in `Live feed` with author and timestamp.
- `Ready date` in the orders list is treated as completion date and is set from the timestamp of transition to one of:
  - `issued`
  - `client rejected`
  - `issued without repair`
- Completion timestamp source is the corresponding status-change entry in `Live feed` (timeline).

## Order Card Editing Rules

- In order card `Main information`, `Device` is read-only (no `Edit` button and no device-edit modal in order card).
- In order card `Main information`, `S/N` is editable.
- `S/N` must remain editable at any time, including empty value.
- `Save changes` from order card does not modify device name.
- `Master` is editable in order card via dropdown list of active employees with role `master` (or users with repair execution rights).
- `Manager` remains informational.
- `Article` is removed from order card main information.
- `Save changes` button appears only when main information or status was modified (dirty state), and persists changes atomically.
- Status in order card is applied on `Save changes` (not immediately on select).
- If saved status is NOT one of final issued statuses:
  - `issued`
  - `client rejected`
  - `issued without repair`
  then `Issued` worker is cleared in both orders list and order card.
- Saving order card main information does not provide device editing via order-card modal; device management is performed via `Clients goods`.
- `S/N` in order card remains order-specific and must not be written to `Clients goods`.
- In order card device modal, if no exact device-name match is found in `Clients goods`, the form must stay in `New device` mode.
- The modal must not auto-select the first available client device as fallback.
- `Live feed` composer (comment input + `Add` button) is fixed at the bottom of the live feed panel and must not shrink.

## Clients Goods (`Products & Services` first tab)

- First tab is named `Clients goods`.
- Fields shown: `ID`, `Name`, `Activity`, `Date`.
- Device `Name` must be unique in `Clients goods` list view (case-insensitive).
- When creating an order, if a device with the same canonical name already exists in `Clients goods`, it must be reused from suggestions and no duplicate record is created.
- Serial numbers are not stored or edited in `Clients goods`; they are handled in order card context/history only.
- Clicking `Name` opens edit modal.
- Create/Edit modals for `Clients goods` include only device name, note and activity.
- Modal allows toggling `active/inactive`.
- Inactive devices are excluded from order device lookup.
- A device is considered "used" if it appears in at least one order/sale history entry for the same client (including order snapshot and line items).
- If a device is used in orders/sales, `Remove` is forbidden; only deactivation is allowed.
- `Remove` is enabled only when device is not used in orders/sales.
- `Remove` action asks for confirmation.
