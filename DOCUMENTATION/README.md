# Documentation

One topic → one source of truth. Other files **link**, they do not copy the rule.

| Topic | Read this | Details / UI |
| --- | --- | --- |
| Local run / Docker / tests | [DEVELOPMENT.md](./DEVELOPMENT.md) | [DEPLOYMENT.md](./DEPLOYMENT.md), [TESTING.md](./TESTING.md) |
| Architecture / repo layout | [ARCHITECTURE.md](./ARCHITECTURE.md) | [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) |
| HTTP API | [API.md](./API.md) | [SECURITY.md](./SECURITY.md), [Permission_Flow.md](./Permission_Flow.md) |
| Repair orders | [ORDER_FLOW.md](./ORDER_FLOW.md) | [ORDER_CARD.md](./ORDER_CARD.md), [REPAIR_KANBAN_SPEC.md](./REPAIR_KANBAN_SPEC.md) |
| Sales / Rapid sale | [SALE_FLOW.md](./SALE_FLOW.md) | [SALE_CARD.md](./SALE_CARD.md) |
| Warehouse / serials | [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) | [SERIAL_NUMBER_SEQUENCE_SPEC.md](./SERIAL_NUMBER_SEQUENCE_SPEC.md) |
| Bind serial occupancy | [WAREHOUSE_FLOW.md §4.3.0](./WAREHOUSE_FLOW.md#430-bind-modal-occupancy-opened-repair-and-sale-cards) | API: `GET /sales/occupied-serials` in [API.md](./API.md) |
| Product lookup suggestions | [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md) | create-order / cards / Rapid Sale |
| Print | [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md) | warehouse serial labels in WAREHOUSE_FLOW §4.5 |
| Finance | [ACCOUNTING.md](./ACCOUNTING.md) | — |
| Supplier orders | [SUPPLIER_ORDER_FLOW.md](./SUPPLIER_ORDER_FLOW.md) | — |
| Clients | [CLIENTS_RULES.md](./CLIENTS_RULES.md) | — |
| Employees / RBAC | [EMPLOYEES_SPEC.md](./EMPLOYEES_SPEC.md) | [Permission_Flow.md](./Permission_Flow.md) |
| Settings | [SETTINGS_SPEC.md](./SETTINGS_SPEC.md) | [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md), [BUSINESS_DASHBOARD.md](./BUSINESS_DASHBOARD.md) |

## 1. Start here

- [DEVELOPMENT.md](./DEVELOPMENT.md) — local run, env, commands
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Docker prod, env, Mongo replica set
- [TESTING.md](./TESTING.md) — tests, CI
- [DEMO_DATA.md](./DEMO_DATA.md) — seed data
- [../AGENTS.md](../AGENTS.md) — AI agent rules

## 2. Platform

- [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, data flow
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) — repo tree, file map
- [API.md](./API.md) — endpoints, auth matrix
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) — TanStack Query, SSE, concurrency
- [SECURITY.md](./SECURITY.md) — auth, RBAC, LAN
- [Permission_Flow.md](./Permission_Flow.md) — roles and permission keys
- [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md) — History API, URL params
- [BUILD_VERSION_SPEC.md](./BUILD_VERSION_SPEC.md) — build SHA
- [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) — tokens, breakpoints
- [DATA_RETENTION.md](./DATA_RETENTION.md) — hot/cold sales, finance snapshots

## 3. Orders and sales

- [ORDER_FLOW.md](./ORDER_FLOW.md) — create/save repair + shared order rules
- [ORDER_CARD.md](./ORDER_CARD.md) — opened repair card UI
- [REPAIR_KANBAN_SPEC.md](./REPAIR_KANBAN_SPEC.md) — Kanban tab
- [SALE_FLOW.md](./SALE_FLOW.md) — create sale, Rapid sale
- [SALE_CARD.md](./SALE_CARD.md) — opened sale card UI
- [SPEC_SUGGESTIONS_BEHAVIOR.md](./SPEC_SUGGESTIONS_BEHAVIOR.md) — lookup/autocomplete

## 4. Warehouse, serials, print

- [WAREHOUSE_FLOW.md](./WAREHOUSE_FLOW.md) — stock models/units, receipts, transfers, information, occupancy, labels
- [SERIAL_NUMBER_SEQUENCE_SPEC.md](./SERIAL_NUMBER_SEQUENCE_SPEC.md) — `S000001` assignment on receipt
- [PRINT_FORMS_SPEC.md](./PRINT_FORMS_SPEC.md) — print templates
- [CATALOG_PRODUCT_CREATE_MODAL_SPEC.md](./CATALOG_PRODUCT_CREATE_MODAL_SPEC.md) — Product List modal (not stock)

## 5. Procurement, finance, people, home

- [SUPPLIER_ORDER_FLOW.md](./SUPPLIER_ORDER_FLOW.md)
- [ACCOUNTING.md](./ACCOUNTING.md)
- [CLIENTS_RULES.md](./CLIENTS_RULES.md)
- [EMPLOYEES_SPEC.md](./EMPLOYEES_SPEC.md)
- [SETTINGS_SPEC.md](./SETTINGS_SPEC.md) — Company, Print, Dashboard, Backups, Database
- [BUSINESS_DASHBOARD.md](./BUSINESS_DASHBOARD.md) — analytics, rates, weather
