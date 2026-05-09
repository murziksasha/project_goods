# Sale Card Rules

## Sections And Defaults

- Sale card uses two collapsible line-item sections:
  - `Products`
  - `Services`
- Default state for sale card:
  - `Products`: open
  - `Services`: hidden

## Collapse Headers

- Section headers use compact collapse indicators (`⌃` / `⌄`).
- Header interaction toggles only current section.

## Line Items Table

- Table columns:
  - `Name`
  - `Price`
  - `Qty`
  - `Warranty`
  - `Action`
- Product rows can be returned (instead of remove) when paid-sale conditions are met.

## Add Line Item UX

- Entry controls stay in one fixed row.
- Search suggestions are always shown below the row.
- Suggestion list has fixed max height and internal vertical scroll.
- Long suggestion result sets must not shift `Price/Qty/Warranty/Add` controls.

## Product Entry

- Product suggestion selection pre-fills line values and stores selected `productId`.
- Manual value entry is still allowed.

## Service Entry

- Service suggestion selection pre-fills line values and stores selected `serviceId`.
- If no matching service exists, `Add service` action can open create-service flow.

## Payment Panel Position

- In desktop layout, payment panel is displayed in the right column beside line-item sections.
- In responsive layout, payment panel falls back to normal vertical flow.

## Payment Discount

- `Payment` panel contains editable `Discount` row under `Repair cost`.
- `Discount` supports toggle modes:
  - `%` for percentage discount from total sale amount
  - `₴` for fixed discount amount
- The same editable `Discount` control is shown in `Accept payment` modal summary.
- Discount affects `To pay` immediately and is stored in workspace state.
