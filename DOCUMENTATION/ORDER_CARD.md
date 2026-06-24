# Order Card Rules

## Main Information

- Accepted device is stored and displayed only in `Main information` (`Device` + `S/N`).
- Accepted device must not be auto-added to `Products`.
- `Device` is shown as a compact change control in repair order cards.
- `Change` near `Device` opens a modal based on active `Clients goods` (`client-devices`) for current client.
- Device search in the modal uses the same global active `Clients goods` lookup as `Create order -> Device #1`; empty search may show current-client devices.
- Modal allows selecting an existing client device or creating a new one, then applying it to the order-card draft.
- Each listed client device also has an `Unbind` action:
  - if the device is not used in orders/sales (`canRemove = true`), unbind deletes the `client-devices` record after confirmation;
  - if the device is used in orders/sales, unbind deactivates it (`isActive = false`) after confirmation;
  - unbind does not apply the device name to the order-card draft.
- Existing client-device editing remains in `Clients goods`; the order-card modal does not update existing device records.
- Applying a device can optionally clear the order-specific `S/N`; preserving `S/N` is the default.
- `Clients goods` stores unique device names per client (case-insensitive).
- Uniqueness is enforced by canonical `nameKey` (trim + collapsed spaces + lowercase).
- Different clients may have the same device name.
- `Clients goods` does not store or bind `S/N`.
- On `Save changes`, selected `Device` is persisted to the order snapshot/history.
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
- If attached product line items are not fully paid, saving status `issued` is blocked.
- If product line items still have bound warehouse serials, saving status `client rejected` or `issued without repair` is blocked until the client is refunded for those serials and the serials are returned/unbound to stock.

## Live Feed

- Status changes and system actions are logged to `Live feed`.
- `Live feed` composer (`Comment` + `Add`) is fixed at the bottom of the panel and requires `orders.chat`.
- System-generated messages use gray text.
- Manually entered comments use green text and are allowed only for employees with `orders.chat`.
- New timeline entries store explicit source: `manual` for composer comments and `system` for generated actions. Legacy entries without source keep the existing message-text fallback.

## Products Section

- `Products` section contains only attached products/parts/services used for the order work.
- `Products` is collapsed by default in order card; saved expanded/collapsed state may override that default on later opens.
- Accepted repair device is not a product line item.
- Clearing a product row `Price` input while editing must not remove the product line item; explicit `Remove` remains the only row-removal action.
- Serialized warehouse products attached to an order follow the same atomic row rule as sales: one bound stock serial is stored as one product line item with `quantity = 1`, one `serialNumbers[]` value, and matching `productId`.
- If multiple serials are bound to a legacy multi-quantity product line, the card must split it into one product row per serial before saving.
- Clicking a product line item name opens the shared product model modal for `lineItems[].name`.
- The product model modal is exact-name only, shows warehouse stock summary, and saves shared stock-row fields to matching `Product` rows only.
- Serial binding/removal controls keep their existing behavior and are separate from opening the product model modal.

## Payment And Discount

- `Payment` block in order card contains:
  - `Repair cost`
  - `Discount`
  - `Paid`
  - `To pay`
- `Discount` is editable only in the right `Payment` panel of the card.
- In `Accept payment` modal summary, `Discount` is read-only and informational.
- After a successful modal action (`Accept to cashbox`, `Accept and issue`, or `Issue without payment` / paid equivalent), the payment modal closes automatically.
- `Print` from the payment modal opens the print flow only and keeps the payment modal open.
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
