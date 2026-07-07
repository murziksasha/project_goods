# Employees Module

The Employees section (`page=employees`) is available to `owner` and employees with `employees.manage`. It combines team management and performance analytics.

## UI entry points

- Page host: `frontend/src/pages/dashboard/ui/DashboardPage.tsx`
- Tabs wrapper: `frontend/src/widgets/dashboard/ui/settings/EmployeesPanel.tsx`
- Team management tab: `frontend/src/widgets/dashboard/ui/settings/EmployeeManagementPanel.tsx`
- Information tab: `frontend/src/widgets/dashboard/ui/settings/EmployeeInformationPanel.tsx`
- Analytics engine: `frontend/src/widgets/dashboard/model/employee-information.ts`

## Tabs

| Tab | Key | Purpose |
| --- | --- | --- |
| Employees | `employees` | Create, edit, delete employees and manage permissions |
| Information | `information` | Business report with KPIs, charts, and sortable table |

Active tab is persisted in browser `localStorage` (`project-goods.employees-active-tab`).

## Employee list: inactive badge

In the team list (`EmployeeManagementPanel`), inactive employees show an inline badge after the employee name:

- CSS class: `catalog-inactive-badge` (same pattern as catalog and warehouse inactive entities)
- i18n key: `employees.list.inactiveBadge`
- The separate status line (`Active` / `Inactive`) is not duplicated under the name

## Master assignment rules

Inactive employees must not be assignable as repair master:

- **Frontend**: `CreateOrderCard` and `OrderDetailCard` filter master options with `employee.isActive === true` and repair rights (`role === 'master'` or `repairs.execute`)
- **Backend**: `resolveEmployee()` in `backend/src/domain/sale/service.ts` rejects inactive `masterId` with `masterId employee not found or inactive.`

## Information tab

The Information tab follows the same interaction model as Warehouse Information and Accounting Information:

### Summary KPIs

- Active employees
- Orders in selected period
- Repairs in selected period
- Sales in selected period
- Sales revenue
- Repairs revenue

### Scope

Information always shows **active employees only** (`isActive === true`). Inactive team members are managed on the Employees tab but are excluded from analytics rows, charts, and export.

Each row represents one named employee (name + login) with individual achievements for the selected period.

### Views

| View | Attribution | Primary metrics |
| --- | --- | --- |
| Achievements (default) | per employee | orders created, repairs as master, completed repairs, sales, sales revenue, repairs revenue, latest activity |
| Orders created | `sale.manager.id` | order count, revenue, latest activity |
| Repairs | `sale.master.id` on `kind=repair` | repair count, completed count, revenue, latest activity |
| Sales | `sale.manager.id` on `kind=sale` | sale count, revenue, average ticket, latest activity |

Completed repairs use final statuses: `issued`, `issuedWithoutRepair`, `clientRejected`, `paid`.

### Period presets (header)

The Information header mirrors the business home period controls:

- **Whole** — all-time metrics for current active employees
- **Today** — default on first load
- **This month**, **Last month**, **This year**, **Last year**
- **Date** — custom `dateFrom` / `dateTo` range; overrides preset highlight until cleared (Clear resets to Today)

Preset ranges are applied to `sale.createdAt`. Shared period logic lives in `frontend/src/widgets/dashboard/model/stats-period.ts`.

### Filters and sorting

- Search by name, role, login, email, phone
- Role filter (all roles + each `EmployeeRole`)
- Achievements sort: orders created / repairs / sales / revenue / latest activity
- Detail views sort: count / revenue / latest activity
- Direction: ascending / descending

### Charts

- Horizontal distribution bars for top 8 performers (share vs leader)
- Vertical bar chart for top 3 comparison

### Table and export

- Full table without pagination (active employee count is expected to stay small)
- Achievements table lists every active employee, including those with zero activity in the period
- Export to Excel (`.xlsx`) with active filters and current view columns

## Data source

Information analytics are computed on the frontend from dashboard state:

- `allEmployees`
- `sales`

No dedicated backend analytics endpoint is required.

## Employee deletion and metrics retention

Deleting an employee is permanent. Their performance metrics must not survive in analytics or operational links.

When `DELETE /employees/:employeeId` succeeds, backend `purgeEmployeeOperationalLinks()` runs **before** the employee document is removed:

| Data | Cleanup |
| --- | --- |
| Sales `manager` | set to `null`, `managerSnapshot` removed |
| Sales `master` | set to `null`, `masterSnapshot` removed |
| Sales `issuedBy` | set to `null`, `issuedBySnapshot` removed |
| Warehouse administrators | row with matching `employeeId` removed |

Effects:

- Information tab rows/charts/export never show a deleted employee (rows are built only from the current active employee list).
- Historical orders/sales no longer attribute manager/master/issued metrics to the deleted account after cleanup.
- Frontend refreshes sales after delete so Information and order cards reflect cleared attributions immediately.

Implementation: `backend/src/domain/employee/service.ts` (`purgeEmployeeOperationalLinks`, `deleteEmployee`).

## Permissions

See [Permission_Flow.md](./Permission_Flow.md) for employee management authorization rules.