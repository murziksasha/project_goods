# New Barcode repair label — plan (2026-11-18)

Status: implemented on `feat/newBarcode`. Decisions were agreed with the owner in a grill-me session; the private session log is `.grill/new-barcode-label.md` (gitignored).

Specs that own the rules after this change:

- Templates, variables, visibility: [PRINT_FORMS_SPEC.md § New Barcode label](./PRINT_FORMS_SPEC.md#new-barcode-label-2026-11-18) and [§ Print menu visibility](./PRINT_FORMS_SPEC.md#print-menu-visibility-2026-11-18)
- Settings persistence: [SETTINGS_SPEC.md § Print forms](./SETTINGS_SPEC.md#print-forms)
- Kit field: [ORDER_FLOW.md § Device kit](./ORDER_FLOW.md#device-kit-2026-11-18), [ORDER_CARD.md § Kit](./ORDER_CARD.md#kit-2026-11-18)

## Goal

A 40x25 mm repair-intake sticker without a QR code, built from print-constructor blocks:

```
┌──────────────────────────────────────┐
│ #124                      10.11.2026 │
│ (very large, bold)             16:00 │
│──────────────────────────────────────│  solid ~0.5 mm divider
│ Ноутбук DNS            (bold)        │
│ ЗП, сумка              (kit, 1 line) │
│ Сергій                               │
│ 050-662-81-44                        │
│          ||||||||||||||||            │  "(with bar)" only: narrow, ~5 mm
└──────────────────────────────────────┘
```

## Decisions

| # | Decision |
| --- | --- |
| 1 | Two new default templates: **New Barcode (with bar)** and **New Barcode (without bar)**. No QR code. The old `Barcode` and `Product barcode` templates are unchanged. |
| 2 | Page setup copies the working Barcode setup: label 40x25, landscape, margins top 0.45 / right 1.5 / bottom 0.45 / left 5 mm. |
| 3 | Top row is a `columns` block with the `wide-left` layout: `#124` at size `hero`, bold, on the left; `{{acceptedDate}}` / `{{acceptedTime}}` right-aligned on two lines. Then a `divider`, then paragraphs: device (bold), kit, client name, client phone. |
| 4 | The with-bar variant adds a `barcode` block with the new `slim` size: centred, about 5 mm high, about 75 % of the content width, encoding the full order number (`r000124`). |
| 5 | New variables: `acceptedDate` (`dd.MM.yyyy`), `acceptedTime` (`HH:mm`) from order `createdAt` in Europe/Kyiv; `orderNumberShort` (`r000124` → `#124`); `kit` (comma-joined). |
| 6 | Kit is a separate order field `kit: string[]`. List input with "+" and "×" in Create Order and in the order card. Card edits write an order-history (timeline) entry. Old orders fall back to `(kits: ...)` parsed from the system note. No DB migration. |
| 7 | Per-template "Show in print menu" checkboxes: Sale / Repair / Warehouse (product). New templates default to Repair only. Templates without the setting behave as before. All unchecked = hidden from menus, kept in the constructor. |

## Minimal builder additions

The layout could not be expressed with existing options, so three small, optional properties were added. Old templates are unaffected because each property is optional and defaults to the previous rendering.

- Heading / paragraph `size`: `normal` (default) | `large` | `xlarge` | `hero`.
- Columns `layout`: `equal` (default, 50/50) | `wide-left` (left takes the free space, right column fits its content).
- Barcode `size`: adds `slim` next to `compact` / `standard` / `large`.
- Label `divider` now renders as a solid black ~0.5 mm full-width line (it was a 14 px-margin document rule before, unusable on labels).

## Work breakdown

1. Frontend print model (`entities/settings/model/printForms.ts`): variables, default templates and layouts, sizes, columns layout, slim barcode, visibility helpers, group seeding of the new templates, label CSS (print window) and preview CSS (`settings.css`).
2. Print data (`orders-workspace-shared.ts`): `acceptedDate`, `acceptedTime`, `orderNumberShort`, `kit`; slim barcode rendering; visibility filter in the order print dialog; warehouse label form selection honours visibility.
3. Settings preview sample data and builder UI: size / layout selects, visibility checkboxes.
4. Kit field: backend model, payload normalisation and validation (max 20 items, 80 chars each), formatter, workspace-permission comparisons; frontend types, `StringListInput` shared UI, Create Order, order card with history entry, note fallback.
5. Backend settings: persist `printMenuVisibility`.
6. Tests and docs.

## Deleting one of the two templates

Built-in templates are re-seeded when missing. The two New Barcode templates are seeded as a group: if at least one of them is present in saved settings, a deleted sibling is not re-added. Delete the unwanted one and press Save.

## Manual check

1. `git fetch origin && git checkout feat/newBarcode && git pull`.
2. Start dev, open Settings → Print forms: both New Barcode templates exist, Repair checked only.
3. Create a repair order with a kit of two items; open the order card, add/remove a kit item, check the history entry.
4. Print → the two New Barcode templates appear for repairs, not for sales. Print on the 40x25 printer, check centring and barcode scan.
