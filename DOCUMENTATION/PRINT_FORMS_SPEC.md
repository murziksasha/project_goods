# Print Forms Specification

This document is the living specification for built-in and corrected print templates.
When a print template is changed, add the intended behavior here before or together
with implementation updates.

## Layout Builder (Block-Based Templates)

Templates with `layoutVersion: 1` are edited in **Settings → Print forms** via the
block layout builder (`PrintFormBuilder`). Block definitions are stored in
`printForms[].layoutBlocks` on the server (MongoDB). The builder regenerates
`content` as HTML on each edit.

### Text Blocks

Two block types expose free-form text with shared typography controls:

| Builder label | Block type | HTML output |
|---|---|---|
| Heading | `heading` | `<h1>`–`<h3>` with class `print-block-heading` |
| Text | `paragraph` | `<p>` with classes `print-block-paragraph` and `print-block-paragraph-level-{1\|2\|3}` |

Editable fields for both types:

| Field | Property | Values | Default (new block) | Notes |
|---|---|---|---|---|
| Text | `text` | string | placeholder with `{{orderNumber}}` for paragraph | supports `{{variable}}` tokens |
| Level | `level` | `1`, `2`, `3` | `1` for heading, `3` for paragraph | controls font **size** (H1/H2/H3 or paragraph size tier) |
| Weight | `weight` | `light`, `normal`, `bold` | `normal` | controls font **weight**; see below |
| Align | `align` | `left`, `center`, `right` | `left` | omitted in HTML when `left` |

#### Font weight (`weight`)

- **Purpose:** let authors set text heaviness independently from Level (size).
- **UI labels:** Light / Normal / Bold (localized in `settings.printBuilder.weight*`).
- **CSS mapping:**

| `weight` | CSS class | `font-weight` |
|---|---|---|
| `light` | `print-block-weight-light` | 300 |
| `normal` | `print-block-weight-normal` | 400 |
| `bold` | `print-block-weight-bold` | 700 |

- **Rendering:** when `weight` is set, the class is appended to the heading or
  paragraph element. Label templates (`.print-label`) use higher-specificity rules
  so an explicit weight overrides built-in label defaults (e.g. heading `800`).
- **Backward compatibility:** blocks saved before this feature have no `weight`
  field. Normalization leaves `weight` unset; no weight class is emitted and
  existing print output is unchanged. The builder shows **Normal** in the dropdown
  for such blocks; choosing a value persists `weight` on save.
- **Implementation:** `PrintLayoutTextWeight` in `types.ts`; `clampTextWeight`,
  `normalizePrintLayoutBlock`, and `renderPrintLayoutBlocks` in `printForms.ts`;
  `WeightInput` in `PrintFormBuilder.tsx`; styles in `printDocumentStyles`,
  `printLabelDocumentStyles`, and `.settings-print-preview-page` preview CSS.

#### Regression tests

- `printForms.test.ts`: renders weight classes; legacy blocks without `weight`
  omit them; normalization keeps valid weights and drops invalid values.

### Other Block Types

Non-text blocks (field grid, tables, barcode, signatures, divider, spacer,
columns, etc.) are unchanged. Nested paragraphs inside **Columns** preserve
`level`, `align`, and `weight` when column text is edited.

## Product Barcode (Warehouse Stock Label)

### Purpose

The `Product barcode` form (`formId: warehouse-barcode`) prints identification
labels for **warehouse stock units** by serial number. It is used from:

- `Warehouse -> Stock balances` toolbar bulk print
- product model modal print action (opened from `Serial #`)
- optional print after supplier-order take-on-charge

Warehouse flow rules: [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md#45-serial-label-printing-stock-balances).

### Relationship To `Barcode`

1. `warehouse-barcode` is a separate built-in form from order `barcode`.
2. On first normalization after rollout, missing `warehouse-barcode` is created by
   copying layout settings from the stored `barcode` form:
   - `contentMargins`
   - `labelSize`
   - `orientation`
   - `pageSize`
   - `layoutBlocks`
   - `isActive`
3. After migration, the two forms evolve independently in Settings.

### Page Setup

- Same defaults as order `Barcode` unless overridden:
  - page size: `label`
  - default preset: `40 x 25 mm`
  - default orientation: `landscape`
- Each printed label uses oriented CSS variables on its own
  `.print-form-label` section.

### Data Rules

- `barcode` and `labelCode`: stock `Product.serialNumber`
- `labelTitle`: stock `Product.name`
- `labelContact`: stock `Product.article` (may be empty)

### Single vs Batch Print

| Count | Mode | HTML classes | Container behavior |
|---|---|---|---|
| 1 | single-label | `print-html-label`, `print-body-label` | `html/body` fixed to one label size, `overflow: hidden` |
| 2+ | batch-label | adds `print-html-label-batch`, `print-body-label-batch` | `html/body` auto height, `overflow: visible`; each `.print-form-label` breaks to a new physical page |

Batch mode is enabled automatically by `printWarehouseSerialLabels` when
`printableItems.length > 1`.

Implementation:

- `printWarehouseSerialLabels` in `orders-workspace-shared.ts`
- batch flag plumbed through `openOrderPrintWindow` / `buildOrderPrintHtml`
- batch CSS in `printLabelDocumentStyles`

### Builder Requirements

- Same block capabilities as order `Barcode` (barcode block sizes, margins,
  alignment, label preset/orientation).
- Edited in Settings under template name `Product barcode`.

### Acceptance Criteria

1. Bulk warehouse print of N serials produces N physical label pages.
2. Preview/print HTML contains N `print-form-label` sections and batch classes
   when `N > 1`.
3. Single warehouse print still uses one-page single-label container behavior.
4. Settings changes to `Product barcode` apply to warehouse prints on next run.

## Barcode Label (Order)

### Purpose

The `Barcode` form prints a small product/order identification label that is easy
to scan and read at the counter. It is used by **order print** flows
(`OrderPrintDialog`, payment modal `Print`). Distinct from warehouse
`Product barcode` above.

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

### Content Margins And Per-User Layout Storage

Print layout preferences are stored in two layers:

1. **Server (MongoDB, global)** — template content, blocks, titles, and other
   shared company settings saved through `PUT /api/settings`.
2. **Browser localStorage (per employee, per browser)** — personal layout tuning:
   - `contentMargins` (`topMm`, `rightMm`, `bottomMm`, `leftMm`)
   - `pageSize`
   - `labelSize`
   - `orientation`

Local storage key: `project-goods.print-form-overrides.{employeeId}`. Value:
`Record<formId, layoutOverride>`.

Layout overrides are **not** written while the user edits fields. They persist
only when the user clicks **Save settings** in the Settings panel. Until then,
preview changes stay in the in-memory settings form and are discarded on page
reload.

On load, the frontend merges stored overrides onto server `printForms` for the
logged-in employee. Order printing uses the merged forms from localStorage, not
unsaved editor drafts.

Default label content margins when no override exists: `0.45 / 1.25 / 0.45 /
1.25` mm (top / right / bottom / left). A4 document defaults are `0` mm.

### Builder Requirements

- Barcode blocks may define a custom value template.
- Barcode blocks may switch visual size between `compact`, `standard`, and `large`.
- Barcode blocks may show or hide the human-readable value below the barcode.
- Text blocks (`heading`, `paragraph`) should support Level (size), Weight
  (`light` / `normal` / `bold`, default `normal`), and Align (`left` / `center` /
  `right`).
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
- Unit test `print-form-local-overrides`:
  - `persistPrintFormLayoutOverrides` writes only layout fields per `formId`;
  - overrides are scoped per `employeeId` storage key;
  - `applyPrintFormLocalOverrides` merges stored values onto server forms.
- UI test `SettingsPanel`:
  - editing layout fields updates in-memory preview immediately;
  - `localStorage` is not updated until **Save settings** is clicked;
  - after Save, stored overrides survive reload for the same employee.
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
