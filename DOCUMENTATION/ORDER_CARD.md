# Order Card Rules

## Main Information

- Accepted device is stored and displayed only in `Main information` (`Device` + `S/N`).
- Accepted device must not be auto-added to `Products`.
- `Device` is shown as plain text in card.
- `Edit` button near `Device` opens a modal based on `Clients goods` (`client-devices`) for current client.
- Modal allows selecting existing client device or creating/updating one, then applying it to order card.
- `Clients goods` stores unique device names per client (case-insensitive).
- Uniqueness is enforced by canonical `nameKey` (trim + collapsed spaces + lowercase).
- Different clients may have the same device name.
- `Clients goods` does not store or bind `S/N`.
- On `Save changes`, edited `Device` is synced to `Clients goods` for the same client.
- If a device with the same canonical name already exists for this client, system reuses that record (no duplicates).
- `S/N` may be empty and can be added later.
- `S/N` is stored in order card snapshot/history and used as suggestion for repeat requests of the same client/device.
- Empty `S/N` is a valid value and must not block `Save changes` (including status-only updates).

## Status And Issued

- Status in card is draft-only until `Save changes`.
- `Issued` employee is set only when saved status is one of:
  - `issued`
  - `client rejected`
  - `issued without repair`
- For any other saved status, `Issued` employee is cleared.

## Live Feed

- Status changes and system actions are logged to `Live feed`.
- `Live feed` composer (`Comment` + `Add`) is fixed at the bottom of the panel.
- System-generated messages use gray text.
- Manually entered comments use blue text.

## Products Section

- `Products` section contains only attached products/parts/services used for the order work.
- Accepted repair device is not a product line item.

## Payment And Discount

- `Payment` block in order card contains:
  - `Repair cost`
  - `Discount`
  - `Paid`
  - `To pay`
- `Discount` is editable only in the right `Payment` panel of the card.
- In `Accept payment` modal summary, `Discount` is read-only and informational.
- `Discount` supports two modes switched in the card control:
  - `%` (percentage from total)
  - `₴` (fixed amount in currency)
- Discount reduces final order amount before `To pay` calculation.
- `To pay` formula:
  - `max((Repair cost - Discount) - Paid, 0)`
- Discount is persisted in sale/order workspace and reused across card and payment modal views.
- `Refund to client` availability for repair orders:
  - NOT allowed when status is `issued`, `client rejected`, or `issued without repair`.
  - For all other repair statuses, refund modal can be opened.
