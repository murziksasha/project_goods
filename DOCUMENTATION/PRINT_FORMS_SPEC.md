# Print Forms Specification

Related: [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) · [ORDER_CARD.md](./ORDER_CARD.md) · [SALE_CARD.md](./SALE_CARD.md) · [index](./README.md)

This document is the living specification for built-in and corrected print templates.
When a print template is changed, add the intended behavior here before or together
with implementation updates.

## Print Language (2026-11-07)

- **All printed documents use Ukrainian independently of the website language.**
  This applies to Receipt, Check, Warranty card, Completion act, both invoices,
  order/warehouse labels, their previews and the builder's sample preview.
- Generated values use the fixed Ukrainian translation function and `uk-UA`
  formatting from `shared/lib/printFormatting.ts`. This includes amounts in words,
  currency (`грн`, comma decimal separator), dates, status names, rapid-sale client
  labels, serial descriptions, signer position, notes and table headers.
- `{{total_written}}` always spells the gross amount in Ukrainian. For example,
  950.00 prints `дев'ятсот п'ятдесят гривень 00 копійок`. Hryvnia/thousand gender,
  plural forms and rounded kopecks are handled consistently in runtime and demo data.
- Printing never calls `changeLanguage` or changes the employee's stored website
  language. Document HTML declares `lang="uk"`; preview/print window titles also
  use Ukrainian. Builder controls and template-list names still follow their UI
  rules, including the English names **Invoice with VAT** / **Invoice without VAT**.
- Known legacy English system captions are translated before record data is
  inserted. Block normalization covers nested columns, fields, signatures and
  custom tables without changing block IDs, layout, typography or variable names.
  Legacy HTML captions and supplied table headers use the same language policy.
- Customer/company names, product/service names, serials, addresses, notes and
  other record data retain their original spelling. Arbitrary custom template
  prose remains author-controlled and should be written in Ukrainian in the builder;
  the migration only translates recognized system captions.
- Implementation: `entities/settings/model/print-language.ts` handles static
  captions; shared print formatting handles generated values. Sample print values
  use Ukrainian as well. Existing empty-section/grouping/VAT rules remain in force.

Validation: `printFormatting.test.ts` verifies English/Ukrainian UI independence,
gender/plurals and rounding; shared order-print tests compare the full generated
data across both site languages. `e2e/invoice-print.spec.ts` checks both invoices,
Receipt/Check/Warranty/Completion act, popup and builder preview in both languages.

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

### Inline Text Formatting (2026-11-10)

Authors can format individual words inside manually written print text with a
lightweight markup. Templates stay plain strings; no migration is needed.

| Markup | Output | Toolbar (uk / en) | Shortcut |
|---|---|---|---|
| `**text**` | `<strong class="print-inline-format">` | Ж / B | Ctrl+B |
| `*text*` | `<em class="print-inline-format">` | К / I | Ctrl+I |
| `__text__` | `<u class="print-inline-format">` | П / U | Ctrl+U |

**Where:** every manually written text field of the block builder.

| Block | Formattable fields | Toolbar |
|---|---|---|
| Heading | Text | own toolbar above the field |
| Text (`paragraph`) | Text | own toolbar above the field |
| Columns | each column text | own toolbar above each column field |
| Field row / Field grid | labels and values | one toolbar per block, applies to the last focused input (first input if none was focused) |
| Custom table | column labels and cells | one toolbar per block, last focused input |
| Line items / Invoice items | Title | own toolbar |
| Barcode | Caption (`label`) only | own toolbar |
| Signatures | Left and Right | own toolbar per field |
| Legacy HTML editor | whole HTML source | own toolbar; inserts `<strong>`, `<em>`, `<u>` tags instead of markup |

- The barcode **value** is machine data (it is encoded into the barcode and shown
  under it) and is never formatted: `A**1**` stays `A**1**`.
- Ctrl+B / Ctrl+I / Ctrl+U (Cmd on macOS) work in every formattable field,
  including inputs that share a block toolbar.
- Toolbar buttons keep focus in the field (`mousedown` is prevented), so the
  selection survives the click. Button tooltips show the shortcut.
- Legacy HTML editor toggle: a selection that is exactly `<strong>…</strong>`
  (or sits directly between those tags) is unwrapped; otherwise it is wrapped.
  Multi-line HTML selections are wrapped as one element.
- **Backward compatibility:** existing templates are plain text, no migration.
  Templates that already contain literal `**x**`, `*x*` or `__x__` now render them
  formatted; write `\*` / `\_` to keep them literal. Signature lines are safe
  (see the underscore rule below).

**Rendering rules** (`printInlineMarkup.ts`, used by `renderPrintLayoutBlocks`):

- Only template-authored text is parsed. `{{variable}}` tokens stay verbatim and
  are substituted later by `renderPrintTemplate` with HTML-escaped values, so
  data such as IBANs, articles or comments containing `*` or `__` is never
  interpreted as formatting.
- Formatting is line-scoped; markers never pair across a line break.
- An opening marker must be followed by non-whitespace, a closing marker must be
  preceded by non-whitespace (`2 * 3 * 4` stays literal). Unclosed or unmatched
  markers print literally.
- `_` forms underline only as an exact `__` run; longer runs such as signature
  lines `__________` stay literal. `*` runs longer than three stay literal.
- `\*` and `\_` produce literal `*` and `_`.
- Nesting works: `***x***` (bold + italic), `**__x__**`, `**a *b* c**`.
- All authored text is HTML-escaped first; only the three inline tags are emitted,
  and DOMPurify (`sanitizePrintHtml`) keeps them with their class.
- Block-level **Weight** still applies to the whole block; inline bold inside a
  bold block stays bold (no "un-bold"). Inline `<strong>` uses `font-weight: bolder`.
- Labels style bare `<strong>` as a full line; `.print-label strong.print-inline-format`
  keeps inline bold inline (print styles and builder preview).

**Toolbar behaviour** (`shared/lib/inlineTextFormat.ts`):

- Wraps the selection (surrounding whitespace stays outside the markers) and keeps
  the word selected. Applying the same format again removes it (toggle), whether
  the selection includes the markers or only the text between them.
- Multi-line selection wraps each non-empty line separately; it toggles off only
  when every selected line already has the format.
- Empty selection inserts an empty pair and puts the caret inside.
- Shortcuts use `KeyboardEvent.code`, so they work on the Ukrainian layout too.

**Editor layout:** in Heading and Text blocks the text field takes the full panel
width (`.print-formatted-field { flex: 1 0 100% }`) and Level / Weight / Align
wrap below it. The Text and Columns textareas can be resized down and right
(`resize: both`), capped at the panel width (`max-width: 100%`); after narrowing
the field it can be dragged right again up to the panel edge. The field size is
editor-only: it is not saved into the template, the server or `localStorage`,
and resets when another block is opened.

**Implementation:**

| Concern | File |
|---|---|
| Parser / HTML output | `frontend/src/entities/settings/model/printInlineMarkup.ts` (`renderPrintInlineMarkup`) |
| Block rendering | `printForms.ts`: `renderInlineTemplate` (formatted) and `renderPlainInlineTemplate` (barcode value / data attribute) |
| Wrap / toggle / shortcuts | `frontend/src/shared/lib/inlineTextFormat.ts` (`toggleInlineTextFormat`, `getInlineTextFormatShortcut`) |
| Toolbar and fields | `frontend/src/widgets/dashboard/ui/settings/PrintTextFormatting.tsx` (`PrintTextFormatScope`, `FormattableInput`, `FormattableTextArea`) |
| Builder wiring | `PrintFormBuilder.tsx` (`FormattedTextInput`, `FormattedTextAreaInput`) |
| Labels (i18n) | `settings.printBuilder.format*` in `en.json` (B / I / U) and `uk.json` (Ж / К / П) |
| Styles | `settings.css` (toolbar, field layout, preview), `printDocumentStyles` / `printLabelDocumentStyles` |

**Tests:** `printInlineMarkup.test.ts` (parser, escaping, variables, XSS,
nesting, escapes, line scope, DOMPurify), `inlineTextFormat.test.ts` (wrap /
toggle / multi-line / shortcuts), `PrintTextFormatting.test.tsx` (buttons,
shortcuts, shared toolbar, builder preview).

#### Інструкція для користувача (UA) / Инструкция для пользователя (RU)

- Над полями ручного тексту (Текст, Заголовок, Колонки, підписи й значення
  Field grid / Field row, таблиці, заголовки таблиць товарів і послуг, підпис
  штрих-коду, Підписи) є кнопки **Ж**, *К*, П. В английском интерфейсе — B, I, U.
- Выдели слово и нажми кнопку или Ctrl+B / Ctrl+I / Ctrl+U. Повторное нажатие
  снимает форматирование. Работает и на украинской раскладке.
- В поле это видно как `**жирный**`, `*курсив*`, `__подчёркнутый__`; в превью и
  печати — уже отформатировано. Можно сочетать: `***жирный курсив***`.
- В Field grid / Field row и пользовательской таблице одна панель на блок: она
  применяется к полю, в котором ты последний раз стоял курсором.
- Несколько выделенных строк оформляются каждая отдельно; форматирование не
  переходит на следующую строку. Незакрытые `**` печатаются как есть.
- Буквальная звёздочка или подчёркивание: `\*`, `\_`. Линии подписи
  `__________` не превращаются в подчёркивание.
- Значения переменных `{{...}}` вставляются как есть (звёздочки в IBAN или
  комментарии клиента не станут жирным). Оформить можно переменную целиком:
  `**{{clientName}}**`.
- Значение штрих-кода не форматируется — только его подпись.
- В старом HTML-редакторе кнопки вставляют теги `<strong>`, `<em>`, `<u>`.
- Поле «Текст» на всю ширину, Level / Weight / Align — под ним. Поле тянется за
  правый нижний уголок вниз и вправо до края панели; размер в шаблон не
  сохраняется. Weight по-прежнему задаёт начертание всего блока.

### Collapsible Template Variables (2026-11-11)

The **Template variables** picker (`VariablePicker` in `PrintFormBuilder.tsx`,
shared by **Heading**, **Text**, and **Barcode** block editors) can be
collapsed and expanded in the editor without affecting saved templates or API
payloads.

- **Control:** `<h3>` renders a keyboard-accessible `<button type="button">`
  labeled `Template variables` (`settings.printBuilder.templateVariables`) with
  `aria-expanded`, `aria-controls` when expanded, and an `aria-hidden`
  expand/collapse indicator (`⌃` / `⌄`).
- **Behavior:** defaults to expanded (`true`). Clicking the heading button or
  activating it from the keyboard (`Enter` / `Space`) hides all variable groups
  and entries together while keeping the heading visible; activating it again
  restores them. Variable insertion (`{{variable}}`) works the same as before.
- **Persistence:** local UI state only (`useState(true)` in `VariablePicker`) —
  not saved to `PrintForm`, `localStorage`, or MongoDB. Reopening the print form
  editor resets it to expanded.
- **Styles & tests:** `.settings-variable-catalog-toggle` and
  `.settings-variable-catalog-toggle-icon` in `settings.css`; covered by
  `PrintFormBuilder.test.tsx` and `e2e/print-builder-variables.spec.ts`.

### Other Block Types

Non-text blocks (divider, spacer, line-item tables) keep their previous
behaviour. Text inside field grids, custom tables, signatures, table titles and
the barcode caption supports inline formatting (see above). Nested paragraphs
inside **Columns** preserve `level`, `align`, and `weight` when column text is
edited.

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
- The **Template variables** catalog shared by `heading`, `paragraph`, and `barcode`
  editors defaults to expanded and collapses/expands via its accessible heading
  button in local UI state only; see
  [Collapsible Template Variables](#collapsible-template-variables-2026-11-11).
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
- Settings **Print forms** tab: `PageHeader` + template select in the toolbar; Add / Duplicate in header actions. Workspace chrome: [SETTINGS_SPEC.md](./SETTINGS_SPEC.md).
- Manual QA with the target printer:
  - print built-in Barcode form for order `r000050`;
  - compare standalone preview, Chrome print preview, and physical label;
  - scan the printed barcode with a scanner or phone scanner app.

## Line Items Grouping (Products)

Applies to order/sale print tokens `{{products_table}}` and `{{invoice_items_table}}`
(Receipt, Check, Warranty card, Completion act, Invoice). Display-only: persisted
`lineItems[]` stay atomic (one serial = one row).

### Merge rule

- Group **product** rows that share identity **and** unit price.
- Identity: `catalogProductId` when present, else normalized `name` (same as the
  order/sale card helper `groupProductLineItems`).
- Price: `Math.round(price * 100)` so `70` and `70.00` merge; `70` and `90` do not.
- Qty on the print row = sum of grouped `quantity`. Sum = `price * qty`.
- Different serial numbers do **not** split rows when the price matches.

### Split rule

- Same name / same catalog product / different unit price → separate print rows
  (individual serials may have different sale prices).
- **Services** are never grouped (`{{services_table}}` and service rows on Invoice).

### Invoice extras

- Grouped invoice product rows join unique serials in the description:
  `Серійний №: A, B, C`.
- Service rows keep `Послуга`; product rows without serials keep `Товар`.

### Out of scope

- `Barcode` and `Product barcode` labels: still one physical label per serial.
- Order/sale card accordion grouping does not require matching price; print does.
  Card spec: [ORDER_CARD.md](./ORDER_CARD.md) / [SALE_CARD.md](./SALE_CARD.md).

### Implementation

- `frontend/src/widgets/dashboard/model/order-line-item-groups.ts` — `groupPrintProductLineItems`
- `frontend/src/widgets/dashboard/ui/orders/workspace/orders-workspace-shared.ts` —
  `renderLineItemsTable` (`{{products_table}}`) and `renderInvoiceItemsTable`
  (`{{invoice_items_table}}`)

### Tests

- `order-line-item-groups.test.ts`: print key includes price cents; services stay split.
- `orders-workspace-shared.test.tsx`: Check/invoice HTML collapses same-price products
  and keeps different-price / service rows separate.

## Future Template Requirements

## Invoice Without VAT And Empty Sections (2026-11-07)

- New built-in form: **Invoice without VAT** (`invoice-no-vat`, type `invoice`),
  A4 portrait, editable with the existing block builder in Settings → Print forms.
  Missing defaults are added by frontend normalization; existing Invoice and custom
  layouts are preserved except for the explicitly requested Invoice redesign below.
  Saving settings persists the added form with the other forms.
- Layout follows the supplied invoice example: supplier, recipient, payer and due
  date, centered invoice number/date, separate services and products tables, one
  amount payable and total in words. It states **Без ПДВ**; no VAT is added.
- Number, customer, date, current line items and totals come from the selected sale
  or repair. These are separate record kinds; there is no independent invoice counter.
- `{{repair_order_reference}}` prints `Ремонтне замовлення №<record number>` for repairs
  only. Its standalone paragraph is removed for sales.
- `{{service_center_phone}}` resolves stock products by product ID or bound serial,
  then their warehouses and service centers. One unambiguous center supplies its
  phone. With no stock association, a single configured service center is used.
  Multiple matching centers, or multiple configured centers without an association,
  leave the phone empty. Orders currently have no persisted warehouse field.
- All existing forms, including custom and legacy HTML forms, hide an empty
  products/services table and its heading. No “No products” / “No services” message
  is printed. When both kinds have rows, both sections remain; when both are empty,
  both sections disappear. Combined invoice tables also disappear when empty.
- Builder table blocks wrap the title and token in `data-print-items` sections.
  Legacy HTML supports a heading immediately preceding the table token, optionally
  with the token in its own paragraph/container. Other text and totals are preserved;
  arbitrary detached explanatory headings cannot be inferred as table headings.
- Shared template rendering applies the rule equally to preview and print. Visibility
  is resolved before inserting escaped record values. Product grouping stays as above;
  services remain separate and no business records or stock quantities are changed.

Validation: `printForms.test.ts` covers builder/legacy visibility and saved-template
preservation; `orders-workspace-shared.test.tsx` covers record kinds, phone resolution
and empty current compositions. Browser coverage: `e2e/invoice-print.spec.ts`.

### Invoice Names And Ukrainian Captions

- The previous built-in `invoice` is now **Invoice with VAT**. Its layout is based
  on **Invoice without VAT**, with the same supplier contact, recipient, payer,
  date, repair reference and separate services/products sections. Its total block
  shows `{{net_amount}}`, `{{vat_amount}}` and `{{total_amount}}` (VAT 20%).
- Both form names stay in English in the template list. Static and generated
  document text follow the global [Print Language](#print-language-2026-11-07) rule.
  Variable names, item/customer data and the no-VAT block structure are unchanged.
- Saved no-VAT blocks translate recognized default English captions without
  changing IDs, block order, typography, alignment, custom wording or page setup.
  The previous built-in Invoice title triggers a one-time layout replacement;
  renamed custom invoice forms remain intact. Subsequent edits are preserved.
- **Invoice with VAT** (`invoice`) treats the current order total, after discounts,
  as inclusive of 20% VAT. Work in cents: VAT = `Math.round(grossCents / 6)`;
  net = gross minus VAT. Example: 1,200.00 UAH = 1,000.00 net + 200.00 VAT.
  This reconciles the two rounded components exactly to the gross total.
- Shared per-form data selection applies the breakdown in the builder, modal and
  standalone preview/print. Line prices, amount payable and total in words remain
  the gross order amounts. No VAT is added on top; orders/payments/accounting are
  not modified. **Invoice without VAT** and other print forms retain their original
  financial values. The 20% calculation is scoped to built-in form ID `invoice`.

Add sections here when updating other built-in templates.

### Receipt

Product lines use line-items grouping above.

### Check

Product lines use line-items grouping above.

### Warranty Card

Product lines use line-items grouping above.

### Completion Act

Product lines use line-items grouping above.

### Invoice

Product lines use line-items grouping above, including joined serials.
