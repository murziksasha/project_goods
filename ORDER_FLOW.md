# Order Creation Rules

## Create Order Modal

- Clicking `Create order` opens the modal.
- `Client phone` + `Client name` perform lookup in clients.
- If client is not found, a new client is created automatically on save.
- Client phone is unique. If uniqueness fails, order creation is rejected.

## Repair Order Device Behavior

- `Device #1` searches in `Products & Services -> Clients goods` (client devices).
- Search returns only active client devices.
- `Create new` button is visible but disabled until:
  - tab is `Repair order`
  - a client is selected from suggestions
  - device name has at least 2 chars
  - no active matches are found
- New device is created in `client-devices` collection, not in warehouse products.

## Urgent Term

- If `Urgent repair` flag is selected during repair order creation, order term is shown as `Urgent` in light red.
- Otherwise term is `Non-urgent`.

## Repair vs Stock Product Separation

- Repair order creation no longer creates warehouse products from customer devices.
- Customer device name/serial are stored as order context and in client devices.
- No automatic `Repair` service line item is injected into new repair orders.
- Removing service line items from order card is allowed and persisted.

## Clients Goods (`Products & Services` first tab)

- First tab is named `Clients goods`.
- Fields shown: `ID`, `Name`, `Activity`, `Date`.
- Clicking `Name` opens edit modal.
- Modal allows toggling `active/inactive`.
- Inactive devices are excluded from order device lookup.
- `Remove` is enabled only when device is not used in orders/sales.
- `Remove` action asks for confirmation.
