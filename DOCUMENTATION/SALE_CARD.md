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
- Product and service rows use unified `Remove` action label.

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

## Sale Status Mapping

- In `Orders -> Sales` list and inside opened sale card, status label must stay consistent.
- If record has status `issued`, card status selector must show `Issued` (must not fallback to `New sale`).
- Sales status set includes:
  - `New sale`
  - `Reserved`
  - `Paid`
  - `Issued`
  - `Completed`
  - `Returned`

## Read-Only Lock For Sales Card

- Sales card is editable only when status is one of:
  - `new`
  - `reserved`
  - `paid`
- For any other sales status (`issued`, `completed`, `returned`, etc.) card becomes read-only.
- In read-only mode, block:
  - status change in card header
  - line item add/edit/remove
  - serial binding changes
  - comments add
  - payment/refund actions
  - main info save actions

## Product Remove/Return Rules (Money vs Stock)

- In sales card, product return is split into two distinct steps:
  1. `Refund to client` (finance operation)
  2. `Remove` on product row (stock operation via return-to-warehouse modal)
- Product `Remove` opens stock-return modal (warehouse destination only).
- Product `Remove` must NOT open refund modal.
- Product `Remove` is enabled only when all conditions are true:
  - order is not paid (`paidAmount = 0`)
  - card status is editable (`new`, `reserved`, `paid`)
  - line item has no bound serial numbers
- If any condition is not met, `Remove` is disabled and shows tooltip with block reason.
- Required refund amount for stock return validation remains discount-aware (line share in discounted order total).

## Service Remove Rules

- Service line `Remove` is enabled only when:
  - order is not paid (`paidAmount = 0`)
  - card status is editable (`new`, `reserved`, `paid`)
- In paid orders, service removal is blocked until refund is completed.
