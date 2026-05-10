# API Overview

## Базовый URL

Локальный base URL по умолчанию:

```text
http://localhost:5000/api
```

## Health

- `GET /health` - проверка доступности backend и состояния подключения к MongoDB

## Products

- `GET /products` - список товаров, поддерживает `query`
- `POST /products` - создать товар
- `PUT /products/:productId` - обновить товар
- `DELETE /products/:productId` - удалить товар
- `GET /products/export` - экспорт товаров в Excel
- `POST /products/import` - зарезервировано под импорт Excel, сейчас возвращает `501`

## Clients

- `GET /clients` - список клиентов, поддерживает `query` и `status`
- `POST /clients` - создать клиента
- `PUT /clients/:clientId` - обновить клиента
- `DELETE /clients/:clientId` - удалить клиента
- `GET /clients/:clientId/history` - получить историю клиента

## Sales

- `GET /sales` - список продаж и заказов
- `POST /sales` - создать продажу или заказ
- `PUT /sales/:saleId` - обновить продажу или заказ
- `DELETE /sales/:saleId` - удалить продажу или заказ

## Employees

- `GET /employees` - список сотрудников, поддерживает `query` и `role`
- `POST /employees` - создать сотрудника
- `PUT /employees/:employeeId` - обновить сотрудника
- `DELETE /employees/:employeeId` - удалить сотрудника

## Settings

- `GET /settings` - получить текущие настройки компании или системы
- `PUT /settings` - обновить настройки

## Finance

- `GET /finance/cashboxes` - список касс
- `POST /finance/cashboxes` - создать кассу
- `GET /finance/transactions` - список финансовых операций
- `POST /finance/transactions` - создать финансовую операцию
- `GET /finance/report` - получить финансовый отчет

## Demo Data

- `POST /demo/seed` - заполнить систему демо-данными для локальной разработки

## Интеграционные замечания

- все маршруты смонтированы под `/api`
- большинство endpoint-ов возвращают JSON
- endpoint экспорта возвращает бинарный Excel-файл
- ошибки приходят с полем `message`

## Локальные origin-ы

- frontend origin: `http://localhost:5173`
- backend origin: `http://localhost:5000`

Эти значения можно изменить через переменные окружения, описанные в [DEVELOPMENT.md](./DEVELOPMENT.md).

Client status localization rule: keep client status values in original English (do not translate status enums in UI, API payloads, or docs).

## Client Devices (Clients goods) Notes

- Endpoints: `GET /client-devices`, `POST /client-devices`, `PUT /client-devices/:deviceId`, `DELETE /client-devices/:deviceId`.
- In current flow, `serialNumber` for `Clients goods` is deprecated and should be treated as empty.
- Device serial numbers are maintained in order context/history (`Order card`), not in `Clients goods`.
- For repair orders, `serialNumber` in order context (`productSnapshot.serialNumber`) is optional: empty value is valid and must not fail `PATCH /sales/:saleId/workspace` / `Save changes`.

## Catalog Products Update (2026-05-09)

- Added new API resource for suggestion products used by sales/order search flows.
- Endpoints:
  - `GET /catalog-products`
  - `POST /catalog-products`
  - `PUT /catalog-products/:catalogProductId`
- Data source is backend auto-sync from:
  - order card product rows
  - sales card product rows
  - sales flow create-order product rows
- Manual create is also supported via `POST /catalog-products` (name + note + isActive).
- Returned fields: `id`, `name`, `note`, `isActive`, `sourceTags`, `lastSeenAt`, `createdAt`, `updatedAt`.

## Product Serial Number Sequence (2026-05-10)

- `POST /products/serial-number/next`
  - Reserved for Warehouse receipt flow only.
  - Returns the next unique product serial number from DB sequence.
  - Example response: `{ "serialNumber": "S000001", "pattern": "^S\\d+$" }`
- `POST /products`
  - Stock product creation/updates belong to warehouse flows.
  - Catalogization flows must use `/catalog-products` and must not create stock entries.

## Warehouse Flow Guard (2026-05-10)

- Until receipt (оприходування) workflow is implemented, no flow may place items into stock balances.
- This includes:
  - `Products & Services -> Products` name creation/editing (catalog-only)
  - Supplier order draft creation
- Warehouse stock balances must contain only real received stock (`quantity > 0`).
