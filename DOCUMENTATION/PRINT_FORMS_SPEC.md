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

### Planned Fix: Preview/Print Mismatch

Current observed behavior from the supplied screenshots:

- The standalone preview window shows a correct landscape `40 x 25 mm` label
  layout: barcode on top, large `r000050`, title, and phone/contact line.
- Chrome's print dialog/final output stretches the label into a portrait-like
  page area, places the content near the top, and leaves a large empty area.
- The physical printed label has the barcode and text too small and vertically
  compressed compared with the intended preview.

Likely root cause in the current print path:

- `buildOrderPrintHtml` dynamically injects the correct label `@page`, for
  example `@page { size: 40mm 25mm; margin: 0; }`.
- `printDocumentStyles` later injects a static rule:
  `@page { size: A4 portrait; margin: 12mm; }`.
- Because the static rule is included after the dynamic rule, it can override
  the label page rule in the final print document.
- Screen preview also uses `zoom: 3.6`, while print resets zoom to `1`; this is
  acceptable only if physical label CSS and `@page` remain identical in print.

Implementation plan:

1. Remove the static `@page { size: A4 portrait; margin: 12mm; }` from
   `printDocumentStyles`, or move page-rule generation fully into
   `buildOrderPrintHtml` so only one `@page` rule exists in a print document.
2. Keep A4 behavior by generating `@page { size: A4 portrait; margin: 12mm; }`
   only when `pageSize === 'A4'`.
3. For labels, generate `@page { size: <oriented-width>mm
   <oriented-height>mm; margin: 0; }`.
4. Ensure the generated label HTML sets the same CSS variables on `html`, `body`,
   `.print-form-label`, and nested `.print-label`.
5. Keep `screenPreview` scaling isolated to screen-only selectors. Print media
   must not use `zoom`, page shadows, gray backgrounds, or preview padding.
6. Update `.print-form-label` to be exactly the oriented label width and height,
   not only a container with a nested label.
7. Verify `buildOrderPrintBody` does not mix an A4-selected print dialog state
   with a label form. If any selected form is a label, the print settings should
   resolve to label page size before opening preview/print.
8. Ensure barcode generation runs after document write and before `print()`.
   If needed, wait for `requestAnimationFrame` or a short image/layout readiness
   promise after `JsBarcode` renders SVGs.
9. For label barcodes, explicitly set SVG width to the available label width and
   use a stable JsBarcode `height` in millimeters through CSS. Avoid relying on
   default SVG intrinsic dimensions.
10. Re-test both actions:
    - `Preview`: screen preview window can be visually enlarged, but the white
      label aspect ratio must remain `40 x 25`.
    - `Print`: Chrome print preview must show one physical label page sized
      `40 x 25` with no A4 or portrait fallback.

Acceptance criteria:

- Built-in Barcode form prints as a landscape `40 x 25 mm` label by default.
- The browser print preview and physical output match the standalone preview
  content order and aspect ratio.
- Barcode remains large and scannable; text below it remains readable.
- No large blank portrait page area appears for label printing.
- A4 receipt/check/warranty/completion-act/invoice forms keep A4 margins and do
  not inherit label sizing.
- Custom label sizes use their configured physical dimensions in both preview
  and print.

Regression tests:

- Unit test `buildOrderPrintHtml` for label output:
  - contains one effective label `@page` rule;
  - does not contain a later A4 `@page` rule;
  - includes `print-html-label` and label CSS variables.
- Unit test `buildOrderPrintHtml` for A4 output:
  - keeps an A4 page rule with `12mm` margin;
  - does not emit label-only html/body classes.
- Unit test default Barcode normalization:
  - remains `pageSize: 'label'`;
  - default size remains `40 x 25 mm`;
  - default orientation remains `landscape`;
  - generated layout renders inside `.print-label`.
- Manual QA with the target printer:
  - print built-in Barcode form for order `r000050`;
  - compare standalone preview, Chrome print preview, and physical label;
  - scan the printed barcode with a scanner or phone scanner app.

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
