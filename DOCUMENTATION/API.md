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

- Sale/order responses include `isFavorite`, a boolean used by the Orders and Sales quick star filters.
- `PATCH /api/sales/:saleId/favorite`
  - Permission: `orders.manage` for repair orders, `sales.manage` for product sales.
  - Body: `{ "isFavorite": boolean }`.
  - Updates only the persistent favorite/star state and returns the formatted sale/order.

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
- Настройки хранятся в MongoDB (модель `Settings`, коллекция `settings`). Вкладка **Settings → Dashboard** на фронтенде редактирует вложенный объект `dashboardPreferences`; сохранение — только по кнопке **Save settings** (`PUT /api/settings`). Локальные переопределения виджета Market & weather (сворачивание, скрытие валют и т.д.) в API не попадают — они в `localStorage` (`project-goods.dashboard-widget-overrides`). Подробнее: [BUSINESS_DASHBOARD.md](./BUSINESS_DASHBOARD.md#settings-storage-dashboard-tab-vs-widget-drawer).
- Settings payload includes `dashboardPreferences` for business home page widget defaults:
  - `marketWeatherEnabled`, `exchangeRatesEnabled`, `weatherEnabled`, `weatherAnimationEnabled`
  - `defaultWeatherLocation` (`chornomorsk` | `odesa`, default `chornomorsk`)
  - `weatherProvider` (`open-meteo` | `openweather`)
  - `openWeatherApiKey`
  - `currencies` (for example `["USD","EUR"]`)
  - `rateProviders` (`nbu`, `privat`, `mono`)
  - `defaultForecastView` (`today` | `tomorrow` | `fiveDay`)

## Market Rates (Business Dashboard)

- `GET /market/rates?providers=nbu,privat,mono&currencies=USD,EUR`
  - Proxies NBU / PrivatBank / Monobank exchange APIs
  - Normalizes quotes to `{ currency, provider, official?, buy?, sell?, fetchedAt }`
  - In-memory cache TTL: 15 minutes

## Weather Forecast (Business Dashboard)

- `GET /weather/forecast?lat=<number>&lon=<number>&provider=open-meteo|openweather&apiKey=<optional>`
  - Proxies Open-Meteo (default) or OpenWeatherMap (requires API key)
  - Returns current conditions plus up to 5 daily forecast entries
  - Frontend passes coordinates from the selected weather preset (`chornomorsk` or `odesa`); device geolocation is not used
  - Invalid/missing coordinates fall back to Chornomorsk (46.3013, 30.6531)
  - Each forecast day (`current`, `tomorrow`, `daily[]`) includes:
    - `condition` — normalized scene key: `clear`, `partly-cloudy`, `cloudy`, `fog`, `rain`, `thunder`, `snow`
    - `intensity` — optional precipitation/fog intensity: `light`, `moderate`, `heavy`
    - `windSpeed` — km/h (Open-Meteo native; OpenWeather converted from m/s)
    - `windGust` — km/h gusts when available
    - `windDirection` — degrees (0 = north, 90 = east)
    - `weatherCode` — representative WMO code used for mapping (OpenWeather `weather.id` is normalized server-side)
  - Open-Meteo uses WMO codes via `mapWeatherCodeToScene`; OpenWeather uses `mapOpenWeatherIdToScene` so both providers drive the same frontend animation vocabulary

## Finance

- `GET /finance/cashboxes` - список касс. Cashbox responses include `enabledCurrencies`, for example `{ "UAH": true, "USD": false }`.
- `POST /finance/cashboxes` - создать кассу
- `PATCH /finance/cashboxes/:cashboxId` - update cashbox metadata and global per-cashbox currency settings. `UAH` is always enabled; every non-UAH currency is disabled by default and can be toggled with `enabledCurrencies.<CODE>`.
- `GET /finance/currencies` - list finance currencies. Currency responses include `code`, `isSystem`, and `isArchived`.
- `POST /finance/currencies` - create or restore a finance currency. New currencies are full transaction currencies and are backfilled into every cashbox as disabled with zero balance.
- `PATCH /finance/currencies/:currencyCode` - archive or restore a currency with `{ "isArchived": boolean }`; `UAH` cannot be archived.
- `GET /finance/transactions` - список финансовых операций
- `POST /finance/transactions` - создать финансовую операцию; optional `idempotencyKey` deduplicates repeated manual submissions.
- `PATCH /finance/transactions/:transactionId` - update a finance transaction. Currently supports updating the `note` field (`{ "note": "..." }`). Trims the value; max 300 characters. Not allowed on cancelled transactions.
- `GET /finance/report` - получить финансовый отчет

## Supplier Orders

- Supplier order responses include `isFavorite`, a boolean used by the Supplier Order quick star filter and Warehouse receipt filters.
- `PATCH /api/supplier-orders/:supplierOrderId/favorite`
  - Permission: `supplierOrders.manage`.
  - Body: `{ "isFavorite": boolean }`.
  - Updates only the persistent favorite/star state and returns the formatted supplier order.

- `GET /supplier-orders` - list supplier orders; requires `supplierOrders.view` or `supplierOrders.manage`.
- `POST /supplier-orders` - create supplier order; requires `supplierOrders.manage`.
- `PUT /supplier-orders/:supplierOrderId` - update supplier order; requires `supplierOrders.manage`.
- `POST /supplier-orders/:supplierOrderId/cancel` - cancel supplier order; requires `supplierOrders.manage`.
- `POST /supplier-orders/:supplierOrderId/take-on-charge` - receive supplier order into stock; requires `supplierOrders.manage`.
- `POST /supplier-orders/:supplierOrderId/issue-without-payment` - finance fallback for issue without payment; requires `finance.supplierOrders.issueWithoutPayment`.

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

## Sale Serial Returns (2026-05-17)

- `PATCH /sales/:saleId/return-line-item-serials`
  - Partial return for a product line item by selected serial numbers.
  - Request body:
    - `lineItemId: string`
    - `serialNumbers: string[]` (one or more, unique, must be bound to line item)
    - `cashboxId: string`
    - `refundAmount: string`
    - `warehouse: string`
    - `author: string`
  - Behavior:
    - returns selected quantity to stock (`serialNumbers.length`)
    - deducts `paidAmount` by `refundAmount`
    - appends refund transaction and timeline entry
    - keeps non-returned serials in the line item

## Sale Workspace Serialized Line Items (2026-05-28)

- `PATCH /sales/:saleId/workspace`
  - Manual `Live feed` comment-only saves require `orders.chat`.
  - System-generated timeline entries attached to other workspace actions are still authorized by those actions, not by `orders.chat`.
  - Serialized stock product line items are validated as atomic units.
  - If a product line item has `serialNumbers.length > 0`:
    - `quantity` must be `1`
    - `serialNumbers` must contain exactly one normalized serial
    - `productId` must reference an existing stock `Product`
    - referenced `Product.serialNumber` must match `serialNumbers[0]`
  - A stock `Product` with a serial number cannot be persisted as one line item with `quantity > 1`.
  - Selling multiple serialized units requires multiple product line items, one per stock serial.

## Warehouse Flow Guard (2026-05-10)

- Until receipt (оприходування) workflow is implemented, no flow may place items into stock balances.
- This includes:
  - `Products & Services -> Products` name creation/editing (catalog-only)
  - Supplier order draft creation
- Warehouse stock balances must contain only real received stock (`quantity > 0`).

## Supplier Order Take-On-Charge Warehouse/Location (2026-05-17)

- `POST /supplier-orders/:supplierOrderId/take-on-charge`
  - Request body supports:
    - `autoGenerateSerialNumbers?: boolean`
    - `serialNumbers?: string[]`
    - `warehouseId?: string`
    - `locationId?: string`
  - Behavior:
    - creates stock products per unit (`quantity=1` rows)
    - persists `warehouseId` and `locationId` on each created product
    - sets `purchasePlace` to selected warehouse name
  - Defaults (if IDs are not passed or invalid):
    - warehouse -> first warehouse from `warehouse-settings`
    - location -> first location of selected/default warehouse

## Product Warehouse Fields (2026-05-17)

- Product API shape now includes optional location metadata fields:
  - `warehouseId?: string`
  - `locationId?: string`
- Legacy compatibility:
  - old products may have only `purchasePlace`
  - consumers must support fallback mapping from `purchasePlace` when IDs are empty
