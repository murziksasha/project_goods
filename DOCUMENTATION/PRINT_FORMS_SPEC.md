# Print Forms Specification

This document is the living specification for built-in and corrected print templates.
When a print template is changed, add the intended behavior here before or together
with implementation updates.

## Barcode Label

### Purpose

The `Barcode` form prints a small product/order identification label that is easy
to scan and read at the counter.

### Page Setup

- Page size: `label`.
- Default label preset: `40 x 25 mm`.
- Default orientation: `landscape`.
- Print CSS must emit a physical landscape page for labels, for example
  `@page { size: 40mm 25mm; margin: 0; }`.
- The label body must use the same oriented width and height in preview and print.
- The system/browser print flow must keep the physical label size. Screen-only
  preview windows may scale the label visually, but must not change `@page` or
  the print dimensions.

### Layout

- The built-in `Barcode` template, including the generated layout-builder
  version, must render inside `.print-label`, not `.print-document`.
- Top: one large CODE128 barcode, almost full label width.
- Middle: large readable code text.
- Bottom: one-line title/description with ellipsis when too long.
- Optional contact line: shown only when the label data includes it.
- Empty optional lines must not reserve visible space.
- JsBarcode must not render its own human-readable value for label barcodes;
  the visible code line is controlled by `labelCode` or an explicit barcode
  block `showValue` setting.

### Data Rules

- Repair order label:
  - `barcode` and `labelCode`: order number, for example `r0035760`.
  - `labelTitle`: accepted device name.
  - `labelContact`: client phone.
- Sale/product label:
  - If a product serial exists, `barcode` and `labelCode`: first product serial.
  - If no product serial exists, `barcode` and `labelCode`: order number.
  - `labelTitle`: product name.
  - `labelContact`: empty.

### Builder Requirements

- Barcode blocks may define a custom value template.
- Barcode blocks may switch visual size between `compact`, `standard`, and `large`.
- Barcode blocks may show or hide the human-readable value below the barcode.
- Text blocks should support left, center, and right alignment.
- Switching built-in templates in the print form builder must refresh the
  builder state and preview to the selected template.
- Existing custom print forms must not be overwritten by built-in migrations.

### Preview Requirements

- The order print modal preview should show label pages large enough for visual
  inspection, while still using label CSS variables for the oriented physical
  size.
- The standalone `Preview` window for labels should use a screen-only preview
  class that displays label pages on a gray background with page shadow, similar
  to the browser print preview.
- The `Print` action should open the browser/system print flow with the real
  label size and without screen preview scaling.

## Future Template Requirements

Add sections here when updating other built-in templates.

### Receipt

Pending.

### Check

Pending.

### Warranty Card

Pending.

### Completion Act

Pending.

### Invoice

Pending.
