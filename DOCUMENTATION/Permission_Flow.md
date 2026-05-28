# Permission Flow

## Purpose
This document defines employee access rules for Project Goods. The source of truth is backend authorization; frontend visibility is only a convenience layer.

## Core Principles
- Every authenticated employee has a `role` and a list of string `permissions`.
- `owner` has backend bypass for all permission checks.
- UI must hide unavailable actions, but backend must still return `401` or `403` when access is missing.
- Permissions are additive: a non-owner employee may do an action only when their explicit permission allows it.
- Existing employees are not auto-migrated. Their permissions update when an owner or allowed employee edits them.

## Roles And Default Permissions

Defaults are applied only when an employee is created or updated with an empty permissions list.

| Role | Default permissions | Intent |
| --- | --- | --- |
| `owner` | all permissions | Full system owner and recovery role. |
| `manager` | `orders.view`, `orders.manage`, `clients.manage`, `finance.cashboxes.view`, `finance.transactions.deposit` | Operational manager who can create/manage orders and accept client payments. |
| `master` | `orders.view`, `repairs.execute` | Repair employee who can work with assigned repair flow. |
| `accountant` | `orders.view`, `sales.manage`, full finance permissions | Finance role for accounting workspace and cashbox operations. |
| `warehouse` | `orders.view`, `inventory.manage` | Warehouse/stock operations. |
| `sales` | `orders.view`, `sales.manage`, `clients.manage`, `finance.cashboxes.view`, `finance.transactions.deposit` | Sales employee who can sell and accept client payments. |
| `support` | `orders.view` | Basic read-oriented service role. |

## Permission Catalog

### Orders And Sales
| Permission | Allows |
| --- | --- |
| `orders.view` | View order/sale context where the UI exposes it. |
| `orders.manage` | Create and manage orders; used by order creation flows. |
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

## Employee Management Rules
- `owner` can create, edit, and delete employees except deleting their own account.
- `owner` can create/edit `owner` accounts.
- `owner` can grant or revoke `employees.manage`.
- A non-owner with `employees.manage` can create, edit, and delete non-owner employees.
- A non-owner with `employees.manage` cannot:
  - create an employee with role `owner`,
  - edit an existing `owner`,
  - delete an existing `owner`,
  - grant `employees.manage`.

## Backend Authorization Matrix

### Employees
| Endpoint | Required access |
| --- | --- |
| `POST /employees` | `owner` or `employees.manage`; owner-only constraints still apply. |
| `PUT /employees/:employeeId` | `owner` or `employees.manage`; owner-only constraints still apply. |
| `DELETE /employees/:employeeId` | `owner` or `employees.manage`; cannot delete self; owner deletion is owner-only. |

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

## Frontend Visibility Rules
- Sidebar shows `Employees` when employee is `owner` or has `employees.manage`.
- Sidebar shows `Accounting` when employee is `owner` or has `finance.view`.
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

## Maintenance Notes
- Backend and frontend permission lists must stay in sync:
  - backend: `backend/src/domain/employee/constants.ts`
  - frontend: `frontend/src/entities/employee/model/types.ts`
- Role defaults are normalized in backend parser logic:
  - `backend/src/shared/lib/parsers.ts`
- Frontend permission checks should use:
  - `frontend/src/entities/employee/model/permissions.ts`
- New money-moving flows must map to one of the finance transaction permissions before implementation.
