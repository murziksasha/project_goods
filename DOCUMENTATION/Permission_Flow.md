# Permission Flow

## Purpose
This document defines employee access rules for Project Goods. The source of truth is backend authorization; frontend visibility is only a convenience layer.

## Core Principles
- Every authenticated employee has a `role` and a list of string `permissions`.
- `owner` has backend bypass for all permission checks.
- `owner` must always retain `employees.manage`; the checkbox is locked in the UI and backend normalization re-adds it if a direct payload omits it.
- UI must hide unavailable actions, but backend must still return `401` or `403` when access is missing.
- Permissions are additive: a non-owner employee may do an action only when their explicit permission allows it.
- Existing employees are not auto-migrated. Their permissions update when an owner or allowed employee edits them.

## Roles And Default Permissions

Defaults are applied by backend when an employee is created or updated with an empty permissions list. In the employee form, changing `Role` also activates that role's default permission checkboxes so the visible checkboxes match the selected role.

| Role | Default permissions | Intent |
| --- | --- | --- |
| `owner` | all permissions | Full system owner and recovery role. |
| `manager` | `orders.view`, `orders.manage`, `orders.chat`, `supplierOrders.view`, `supplierOrders.manage`, `clients.manage`, `finance.cashboxes.view`, `finance.transactions.deposit` | Operational manager who can create/manage orders, supplier orders, add Live feed comments, and accept client payments. |
| `master` | `orders.view`, `orders.chat`, `repairs.execute` | Repair employee who can work with assigned repair flow and add Live feed comments. |
| `accountant` | `orders.view`, `supplierOrders.view`, `supplierOrders.manage`, `sales.manage`, full finance permissions | Finance role for accounting workspace, supplier-order flow, and cashbox operations. |
| `warehouse` | `orders.view`, `supplierOrders.view`, `supplierOrders.manage`, `inventory.manage` | Warehouse/stock operations including supplier-order receipt. |
| `sales` | `orders.view`, `sales.manage`, `clients.manage`, `finance.cashboxes.view`, `finance.transactions.deposit` | Sales employee who can sell and accept client payments. |
| `support` | `orders.view` | Basic read-oriented service role. |

## Permission Catalog

### Orders And Sales
| Permission | Allows |
| --- | --- |
| `orders.view` | View order/sale context where the UI exposes it. |
| `orders.manage` | Create and manage orders; used by order creation flows. |
| `orders.chat` | Add manual `Live feed` comments in order cards. System-generated timeline entries continue to come from the underlying order/payment/stock actions. |
| `supplierOrders.view` | View supplier orders and supplier-order information. |
| `supplierOrders.manage` | Create, edit, cancel, change status, and take supplier orders on charge. |
| `repairs.execute` | Be assigned/executed as repair master. |
| `sales.manage` | Manage sale-oriented workflows. |

### Clients And Inventory
| Permission | Allows |
| --- | --- |
| `clients.manage` | Manage clients and client-related records. |
| `inventory.manage` | Manage warehouse/stock-oriented workflows. |

### Finance
| Permission | Allows |
| --- | --- |
| `finance.view` | Open Accounting workspace, read transactions, reports, and supplier payment queue. |
| `finance.cashboxes.view` | Read active cashboxes, mainly for payment/refund forms outside Accounting. |
| `finance.cashboxes.manage` | Create, rename, deactivate, and reactivate cashboxes. |
| `finance.transactions.deposit` | Create deposit transactions, including accepting client payments from Orders. |
| `finance.transactions.withdraw` | Create withdraw transactions, including client refunds/returns. |
| `finance.transactions.transfer` | Transfer money between cashboxes. |
| `finance.supplierOrders.pay` | Pay supplier orders from Accounting queue. |
| `finance.supplierOrders.issueWithoutPayment` | Mark supplier orders as issued without payment. |

### Employees
| Permission | Allows |
| --- | --- |
| `employees.manage` | Create, edit, and delete non-owner employees. |

### System
| Permission | Allows |
| --- | --- |
| `printForms.manage` | Edit print form templates in Settings (`Друковані форми` tab). Does not grant company, dashboard, or backup settings. |
| `system.backups.manage` | Manage backups in Settings (`Резервні копії` tab). Only owners can grant this permission. |

## Employee Management Rules
- `owner` can create, edit, and delete employees except deleting their own account.
- `owner` can create/edit `owner` accounts.
- `owner` can grant or revoke `employees.manage`.
- `owner` accounts cannot lose `employees.manage`.
- A non-owner with `employees.manage` can create, edit, and delete non-owner employees.
- A non-owner with `employees.manage` cannot:
  - create an employee with role `owner`,
  - edit an existing `owner`,
  - delete an existing `owner`,
  - grant `employees.manage`.
- Temporary Admin is the active `owner` account with username `admin`.
- Temporary Admin may be changed or deleted only after at least one other active employee has `employees.manage`.

## Backend Authorization Matrix

### Employees
| Endpoint | Required access |
| --- | --- |
| `POST /employees` | `owner` or `employees.manage`; owner-only constraints still apply. |
| `PUT /employees/:employeeId` | `owner` or `employees.manage`; owner-only constraints still apply. |
| `DELETE /employees/:employeeId` | `owner` or `employees.manage`; cannot delete self; owner deletion is owner-only. |

### Demo Data Erase
| Endpoint | Required access |
| --- | --- |
| `POST /demo/erase` | Temporary Admin only; creates a safety backup before erase. |
| `POST /demo/seed?kind=erase` | Temporary Admin only; legacy erase path with the same safety backup rule. |

### Finance
| Endpoint | Required access |
| --- | --- |
| `GET /finance/cashboxes` | `finance.cashboxes.view` or `finance.view`. |
| `POST /finance/cashboxes` | `finance.cashboxes.manage`. |
| `PATCH /finance/cashboxes/:cashboxId` | `finance.cashboxes.manage`. |
| `GET /finance/transactions` | `finance.view`. |
| `POST /finance/transactions` with `type = deposit` | `finance.transactions.deposit`. |
| `POST /finance/transactions` with `type = withdraw` | `finance.transactions.withdraw`. |
| `POST /finance/transactions` with `type = transfer` | `finance.transactions.transfer`. |
| `PATCH /finance/transactions/:transactionId` | `finance.view`. (allows editing the note on active transactions) |
| `GET /finance/report` | `finance.view`. |
| `GET /finance/supplier-orders` | `finance.view`. |
| `POST /finance/supplier-orders/:supplierOrderId/pay` | `finance.supplierOrders.pay`. |
| `POST /finance/supplier-orders/:supplierOrderId/issue-without-payment` | `finance.supplierOrders.issueWithoutPayment`. |

### Cross-Module Finance Mutations
| Flow | Required access |
| --- | --- |
| Orders: accept client payment to cashbox | `finance.transactions.deposit`. |
| Orders: refund client payment | `finance.transactions.withdraw`. |
| Sales return flows that create finance withdraw transaction | `finance.transactions.withdraw`. |
| Supplier-order fallback `POST /supplier-orders/:supplierOrderId/issue-without-payment` | `finance.supplierOrders.issueWithoutPayment`. |

### Supplier Orders
| Endpoint | Required access |
| --- | --- |
| `GET /supplier-orders` | `supplierOrders.view` or `supplierOrders.manage`. |
| `POST /supplier-orders` | `supplierOrders.manage`. |
| `PUT /supplier-orders/:supplierOrderId` | `supplierOrders.manage`. |
| `PATCH /supplier-orders/:supplierOrderId/favorite` | `supplierOrders.manage`. |
| `POST /supplier-orders/:supplierOrderId/cancel` | `supplierOrders.manage`. |
| `POST /supplier-orders/:supplierOrderId/take-on-charge` | `supplierOrders.manage`. |

### Sales / Orders
| Endpoint | Required access |
| --- | --- |
| `PATCH /sales/:saleId/favorite` for repair orders | `orders.manage`. |
| `PATCH /sales/:saleId/favorite` for product sales | `sales.manage`. |

### Settings
| Endpoint | Required access |
| --- | --- |
| `GET /settings` | Authenticated session (read-only for all active employees). |
| `PUT /settings` | `owner` only. |
| `PUT /settings/print-forms` | `owner` or `printForms.manage`. |

## Frontend Visibility Rules
- Sidebar shows `Employees` when employee is `owner` or has `employees.manage`.
- Sidebar shows `Accounting` when employee is `owner` or has `finance.view`.
- Sidebar always shows `Main`.
- Sidebar shows `Orders` when employee is `owner` or has one of `orders.view`, `orders.manage`, `repairs.execute`, `sales.manage`, `supplierOrders.view`, `supplierOrders.manage`.
- Sidebar shows `Clients & suppliers` when employee is `owner` or has `clients.manage`.
- Sidebar shows `Warehouse` and `Products & Services` when employee is `owner` or has `inventory.manage`.
- Sidebar shows `Settings` when employee is `owner` or has `system.backups.manage` or `printForms.manage`.
- Settings `Company` and `Dashboard` tabs require `owner`.
- Settings `Print forms` tab requires `owner` or `printForms.manage`.
- Settings `Backups` tab requires `system.backups.manage`.
- Main `Erase all data` is visible only to Temporary Admin.
- Main product export is visible only to `owner` or employees with `inventory.manage`.
- Accounting cashbox settings gear, create cashbox, edit cashbox, and archive/reactivate controls require `finance.cashboxes.manage`.
- Accounting direct operation buttons require their matching transaction permission:
  - Deposit: `finance.transactions.deposit`
  - Withdraw: `finance.transactions.withdraw`
  - Transfer: `finance.transactions.transfer`
- Accounting supplier-order payment action requires `finance.supplierOrders.pay`.
- Accounting supplier-order issue-without-payment action requires `finance.supplierOrders.issueWithoutPayment`.
- Orders payment modal requires `finance.transactions.deposit`.
- Orders refund/return flows that return money require `finance.transactions.withdraw`.
- Cashbox list loading in payment/refund forms requires `finance.cashboxes.view` or `finance.view`.
- Orders `Supplier Order` and `Information` tabs require `supplierOrders.view` or `supplierOrders.manage`.
- Supplier-order create, edit, cancel, status change, and take-on-charge actions require `supplierOrders.manage`.
- Starred supplier-order state is visible with supplier-order read access, but changing the star requires `supplierOrders.manage`.
- Starred Orders/Sales state is visible with order read access; changing repair-order stars requires `orders.manage`, and changing product-sale stars requires `sales.manage`.
- Warehouse supplier-order-backed receipt rows require `supplierOrders.view` or `supplierOrders.manage` to load; receipt-order create/edit/cancel/take-on-charge actions require `supplierOrders.manage`.

## Maintenance Notes
- Backend and frontend permission lists must stay in sync:
  - backend: `backend/src/domain/employee/constants.ts`
  - frontend: `frontend/src/entities/employee/model/types.ts`
- Role defaults are normalized in backend parser logic:
  - `backend/src/shared/lib/parsers.ts`
- Frontend permission checks should use:
  - `frontend/src/entities/employee/model/permissions.ts`
- New money-moving flows must map to one of the finance transaction permissions before implementation.
