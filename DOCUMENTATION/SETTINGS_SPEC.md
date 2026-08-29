# Settings workspace

Related: [Permission_Flow.md](./Permission_Flow.md) · [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md) · [BUSINESS_DASHBOARD.md](./BUSINESS_DASHBOARD.md) · [DATA_RETENTION.md](./DATA_RETENTION.md) · [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) · [index](./README.md)

Admin page `page=settings`. Sidebar **Settings**. Host: `SettingsPanel`.

## UI entry points

| Piece | File |
| --- | --- |
| Shell / tabs | `frontend/src/widgets/dashboard/ui/settings/SettingsPanel.tsx` |
| Company | `CompanySettingsSection.tsx` |
| Dashboard | `DashboardSettingsSection.tsx` |
| Print forms | `PrintFormsSection.tsx` + `PrintFormBuilder.tsx` |
| Backups | `BackupsSection.tsx` |
| Database | `DatabaseReportSection.tsx` |
| Domain CSS | `frontend/src/shared/styles/domains/settings.css` |
| Locales | `frontend/scripts/settings-locale-en.json` / `uk.json` (merged into `locales`) |

## Tabs

| Tab | Key | Who sees it | Save button |
| --- | --- | --- | --- |
| Company | `company` | `owner` (`canEditSettings`) | Yes |
| Print forms | `print` | `owner` or `printForms.manage` | Yes |
| Dashboard | `dashboard` | `owner` | Yes |
| Backups | `backups` | `system.backups.manage` | No |
| Database | `database` | `system.backups.manage` | No |

Active tab is stored in `localStorage` (`project-goods.settings-tab`). If the stored tab is hidden by permission, the first visible tab is selected.

Tablist uses `role="tab"` / `aria-selected` / `aria-controls`. Arrow Left/Right moves the active tab.

## Company

Two groups:

1. **Appearance** — service name in the topbar; table density (`html[data-ui-density]`, this browser only).
2. **Company identity** — name, ID, address, IBAN, e-mail, site. These fill print tokens `{{company}}`, `{{company_id}}`, `{{company_address}}`, `{{company_iban}}`, `{{company_email}}`, `{{company_site}}`. Tokens are shown as chips next to labels (not interpolated inside i18n strings).

Validation: name ≥ 2 characters; optional address/ID/IBAN use the shared client-field rules. Invalid fields disable **Save settings**.

## Dashboard

Server defaults for the home-page market/weather widget (`dashboardPreferences` in Mongo `settings`). Local widget-drawer overrides stay in `localStorage` (`project-goods.dashboard-widget-overrides`) and are **not** saved here.

Groups: widget visibility, exchange rates, weather. Rate chips are disabled when rates are off; weather location/provider/animation/forecast are disabled when weather is off.

## Print forms

Template picker lives in the section toolbar. Add / Duplicate are header actions. Block layout editing is described in [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md).

Save writes template **content** to the API. Per-employee layout (margins, page/label size, orientation) is written to `project-goods.print-form-overrides.{employeeId}` only on **Save settings**.

## Backups

Create, download, delete, restore, restore-from-file. Confirm restore by typing `RESTORE`. Cards show status/type badges, size, author. Scheduled retention is ops policy in [DATA_RETENTION.md](./DATA_RETENTION.md).

## Database

Read-only Mongo health + collection sizes (`GET /api/system/db-health`, `GET /api/system/db-stats`). Collections table uses `table-card-stack` on tablet/phone.

## Persistence

| Surface | Where | When |
| --- | --- | --- |
| Company + Dashboard | `PUT /api/settings` | Save |
| Print content | `PUT /api/settings` or `PUT /api/settings/print-forms` | Save |
| Print layout overrides | `localStorage` per employee | Save |
| Table density | `localStorage` | Immediate |
| Active tab | `project-goods.settings-tab` | Tab click |
| Backups / Database | own APIs | Their buttons |

## Adaptive

| Width | Settings behavior |
| --- | --- |
| >1024 | 2-col identity grid; print editor + sticky preview; backup card row |
| ≤1024 | Horizontal tab scroll; groups 1-col; db table stacks into cards |
| ≤720 | Full-width header actions; backup actions wrap |
| ≤480 | 44px tabs; single-column KPIs |

CSS uses design tokens only (`domains/settings.css`). Light and dark themes follow `html[data-theme]`.
