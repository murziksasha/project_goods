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
- Exception: for `issued` sale with bound serials, product row action switches to `Return`.

## Add Line Item UX

- Entry controls stay in one fixed row.
- Search suggestions are always shown below the row.
- Suggestion list has fixed max height and internal vertical scroll.
- Long suggestion result sets must not shift `Price/Qty/Warranty/Add` controls.

## Product Entry

- Product suggestion selection pre-fills line values and stores selected `productId`.
- Manual value entry is still allowed.
- Lookup in an existing sale card product row must match stock `Product` rows by `name`, `article`, and `serialNumber`.
- When the user types an explicit serial number, the matching stock row must appear first when available.
- Suggestion rows must show whether the stock row is free, already linked to the current order, linked to another order, or unavailable because it has no free stock.
- Only active/free stock rows may be selected from suggestions.
- In create-order sales flow, clicking the name of an already selected product row opens the shared product model modal; suggestion clicks still only select products.
- In an existing sale card, clicking a product line item name opens the same exact-name product model modal for `lineItems[].name`.
- The modal updates matching stock `Product` rows only and never creates missing stock or updates `CatalogProduct`.

## Serialized Product Rows

- Serialized warehouse products are atomic in sale card data:
  - one sold serial number = one `lineItems[]` product row
  - serialized row must have `quantity = 1`
  - serialized row must have exactly one `serialNumbers[]` value
  - `lineItems[].productId` must reference the stock `Product` with the same `serialNumber`
- Selecting a product suggestion by serial number must immediately add an atomic product row with `quantity = 1` and `serialNumbers = [serial]`.
- Direct `Qty` changes are blocked for product rows that already have a bound serial number.
- To sell two units of the same serialized model, the operator must bind/add two concrete serial numbers; data is persisted as two product rows, not as one row with `quantity = 2`.
- If a legacy/non-serialized product row has `quantity > 1` and the operator binds multiple serial numbers, the save flow must split it into one atomic row per selected serial.
- Backend workspace validation must reject serialized rows with `quantity > 1`, more than one serial, or a `productId`/`serialNumber` mismatch.

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
- In `Accept payment` modal, `Discount` is read-only and shown for reference.
- Discount is edited only in sale card `Payment` panel and affects `To pay` immediately.
- Discount value is stored in workspace state and reused across card and payment modal.

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

## Product Rows Removal (2026-05-24)

- In `Sales card -> Products`, removing the last product row is allowed in editable statuses.
- After last-row removal, `lineItems` may remain empty; UI must not auto-inject a default product row back.
- When `lineItems` are explicitly empty after removal, order total and `To pay` must be calculated as `0` (no fallback to previous base sale price).
- For any other sales status (`issued`, `returned`, etc.) card becomes read-only.
- In read-only mode, block:
  - status change in card header
  - line item add/edit/remove
  - serial binding changes
  - comments add
  - payment actions
  - main info save actions
- Exception: for `issued` sale with `paidAmount > 0`, `Refund to client` action remains available.

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
- `Remove` deletes line item from sale card only (no warehouse receive modal and no stock movement).
- For `issued` sale, product stock acceptance must use `Return` action and warehouse modal.
- For `issued` sale return completion:
  - after required refund is completed and product is received back to stock,
  - if product line items are fully returned and `paidAmount = 0`,
  - status is auto-switched to `returned`.

## Service Remove Rules

- Service line `Remove` is enabled only when:
  - order is not paid (`paidAmount = 0`)
  - card status is editable (`new`, `reserved`, `paid`)
- In paid orders, service removal is blocked until refund is completed.
