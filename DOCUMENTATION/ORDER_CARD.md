# Order Card Rules

## Header

- Repair order cards and sale cards share the same header shell (`order-detail-header`).
- Header actions order: `Status` dropdown, `Create order`, close (`x`).
- `Create order` reuses the toolbar entry flow:
  - repair card opens `Create order -> Repair order`;
  - sale card opens `Create order -> Sales order`;
  - requires `orders.manage`; without permission the control stays visible but disabled with the denial tooltip.
- Clicking `Create order` closes the current detail card and opens the create-order page (`createOrder` query param, `saleId` cleared).

### Header Layout (Responsive)

- Desktop: title block on the left; actions stay on one row (`Status` + `Create order` + close).
- `<=1024px`: header wraps; actions row spans available width; status select and button group shrink before overflowing.
- `<=720px`: header stacks vertically; status select becomes full width; `Create order` and close share one row (`Create order` grows, close stays fixed `32px`).
- `<=480px`: same stack as `720px` with tighter title/action spacing; long `Create order` labels may wrap inside the button.
- Breakpoint family matches `create-order-header-actions` / `SALE_FLOW.md` rapid-sale header rules so order and sale surfaces behave consistently on tablet and phone.

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
- Messages are grouped by date with separator lines in the format `-------------- DD/MM/YYYY-------` (e.g. `-------------- 28/06/2026-------`) shown above each day's entries in the live feed.

## Products Section

- `Products` section contains only attached products/parts/services used for the order work.
- `Products` is collapsed by default in order card; saved expanded/collapsed state may override that default on later opens.
- Add-row product input placeholder: `Name, serial or article` (`orders.detail.lineItems.addProductPlaceholder`).
- Product search in the add-row input uses the shared `buildCreateOrderProductSuggestions` helper (same ranking and availability rules as `Create order -> Sales order` and `Rapid sale`).
- Lookup matches warehouse stock by `name`, `article`, `serialNumber`, and `note`; catalog fallback matches `catalog-products` by `name` and `note`.
- Stock suggestion rows show `price / article / serial / availability`; catalog rows show `price / Product List`.
- Selecting a stock suggestion by serial query auto-adds one atomic row (`quantity = 1`, bound `serialNumbers[]`).
- Selecting a stock suggestion by article or name pre-fills name, price, and `productId`; operator confirms with `Add product`.
- Accepted repair device is not a product line item.
- Clearing a product row `Price` input while editing must not remove the product line item; explicit `Remove` remains the only row-removal action.
- Serialized warehouse products attached to an order follow the same atomic row rule as sales: one bound stock serial is stored as one product line item with `quantity = 1`, one `serialNumbers[]` value, and matching `productId`.
- If multiple serials are bound to a legacy multi-quantity product line, the card must split it into one product row per serial before saving.
- Clicking a product line item name opens the shared product model modal for `lineItems[].name`.
- The product model modal is exact-name only, shows warehouse stock summary, and saves shared stock-row fields to matching `Product` rows only.
- Serial binding/removal controls keep their existing behavior and are separate from opening the product model modal.
- **Serial bind modal** (Products action column → `Serials`): includes a warehouse dropdown; available serial numbers are filtered to the selected warehouse (default: first created active warehouse). Applies to opened repair orders and sales.
- `Auto-select oldest` in the serial bind modal must select only serials from the currently selected warehouse, ordered by oldest stock date (`purchaseDate`, fallback `createdAt`) within that warehouse, up to the line-item quantity. Changing the warehouse dropdown clears selections that are not visible in the new warehouse.

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
- Discount mode toggle is available from both controls in the `Payment` panel:
  - round badge next to the `Discount` label
  - mode button inside the discount input field (right side)
- Both controls call the same toggle logic and stay in sync.
- Discount reduces final order amount before `To pay` calculation.
- `To pay` formula:
  - `max((Repair cost - Discount) - Paid, 0)`
- Discount is persisted in sale/order workspace and reused across card and payment modal views.
- `Refund to client` availability for repair orders:
  - NOT allowed when status is `issued`, `client rejected`, or `issued without repair`.
  - For all other repair statuses, refund modal can be opened.
