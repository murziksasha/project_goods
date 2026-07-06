# Project Structure

## Корень проекта

```text
project_goods/
|- backend/
|- frontend/
|- .local/
|- docker-compose.yml
|- package.json
|- README.md
|- DEVELOPMENT.md
|- PROJECT_STRUCTURE.md
|- ARCHITECTURE.md
|- API.md
```

## Назначение элементов верхнего уровня

- `backend/` - API, бизнес-логика, доступ к данным и запуск сервера
- `frontend/` - пользовательский интерфейс и клиентская оркестрация состояния
- `.local/` - локальные служебные артефакты и окружение
- `docker-compose.yml` - MongoDB для локальной разработки
- `package.json` - корневые orchestration-скрипты

## Структура backend

```text
backend/
|- server.ts
|- src/
|  |- app.ts
|  |- server.ts
|  |- config/
|  |- routes/
|  |- domain/
|  `- shared/
```

### Папки backend

- `server.ts` - bootstrap-файл, который проксирует запуск в `src/server.ts`
- `src/app.ts` - конфигурация Express, middleware и подключение маршрутов
- `src/server.ts` - запуск сервера и подключение к базе
- `src/config/` - переменные окружения и подключение к MongoDB
- `src/routes/` - HTTP-маршруты
- `src/domain/` - бизнес-модули по доменам
- `src/domain/*/model.ts` - модели Mongoose
- `src/domain/*/service.ts` - прикладная и доменная логика
- `src/shared/` - общие утилиты, demo data, парсинг, форматирование и обработка ошибок

### Домены backend

- `product`
- `client`
- `sale`
- `employee`
- `settings`
- `finance`
- `demo`
- `sequence`

## Структура frontend

```text
frontend/
|- public/
|- src/
|  |- app/
|  |- pages/
|  |- widgets/
|  |  `- dashboard/
|  |     |- model/
|  |     `- ui/
|  |        |- accounting/
|  |        |- analytics/
|  |        |- clients/
|  |        |- orders/
|  |        |  |- workspace/
|  |        |  |- create-order/
|  |        |  |- order-detail/
|  |        |  `- modals/
|  |        |- product-catalog/
|  |        |- settings/
|  |        |- supplier-orders/
|  |        |- warehouse/
|  |        |- weather/
|  |        |  `- scene/
|  |        |- shared/
|  |        `- index.ts
|  |- features/
|  |- entities/
|  `- shared/
```

### Папки frontend

- `src/app/` - корневая композиция приложения
- `src/pages/` - страницы верхнего уровня
- `src/pages/dashboard/model/dashboard-navigation.ts` - parse/build URL и History API для dashboard (Back/Forward внутри SPA)
- `src/widgets/` - крупные секции интерфейса
- `src/widgets/dashboard/model/` - бизнес-логика dashboard: аналитика, заказы, склад, клиенты, печать
- `src/widgets/dashboard/ui/` - UI dashboard, разбитый по тематическим подпапкам (см. раздел ниже)
- `src/widgets/dashboard/ui/index.ts` - barrel-экспорт верхнеуровневых панелей для `DashboardPage`
- `src/features/` - пользовательские сценарии и интерактивные потоки
- `src/entities/` - доменные сущности, API-модули, типы и UI-компоненты
- `src/shared/` - переиспользуемая инфраструктура: стили, утилиты, HTTP-слой
- `src/shared/lib/buildInfo.ts` - метка версии frontend-сборки (`getBuildSha`, `getBuildLabel`); см. [BUILD_VERSION_SPEC.md](./BUILD_VERSION_SPEC.md)

## Структурные соглашения

### Backend

- маршруты должны быть тонкими и делегировать работу сервисам
- бизнес-правила должны жить в доменных сервисах
- `shared` не должен становиться складом доменно-специфичной логики

### Frontend

- страницы координируют экранное состояние
- widgets собирают бизнес-секции из entities и features
- features описывают действия пользователя
- entities представляют устойчивые доменные концепции
- shared содержит только универсальную инфраструктуру

## Куда добавлять новый код

- новый API-ресурс: `model.ts`, `service.ts`, маршрут и подключение роутера
- новая бизнес-функция на frontend: сначала смотреть в `entities` или `features`, а не в `shared`
- новая крупная секция страницы: добавлять в `widgets`
- новая кросс-системная инфраструктура: добавлять в `shared`

## Чего стоит избегать

- смешивания логики запуска сервера с доменными сервисами
- размещения бизнес-специфичной логики в `shared`
- разрастания page-компонентов из-за прямого встраивания всей логики в JSX
- дублирования HTTP-логики по нескольким frontend-модулям

## Structure Update: Build Version Label (2026-07-06)

- `frontend/src/shared/lib/buildInfo.ts` — SHA + build time helpers
- `frontend/vite.config.ts` — inject `__APP_BUILD_SHA__`, `__APP_BUILD_TIME__`
- `frontend/src/pages/dashboard/ui/DashboardPage.tsx` — sidebar label below Settings
- `scripts/docker-up.mjs` — `npm run docker:up` passes `GIT_SHA` into compose build

Spec: [BUILD_VERSION_SPEC.md](./BUILD_VERSION_SPEC.md).

## Structure Update: Browser Navigation (2026-06-22)

### Frontend

- `frontend/src/pages/dashboard/model/dashboard-navigation.ts` — `DashboardLocation`, `parseDashboardLocation`, `buildDashboardHref`, `navigateDashboard`, `getOrderLink`
- `frontend/src/pages/dashboard/model/dashboard-navigation.test.ts` — unit tests for URL round-trip and push/replace behavior
- `frontend/src/pages/dashboard/ui/DashboardPage.tsx` — `navigateTo`, unified `popstate` handler

### Integration points

- `useAccountingPreferences` — accounting tab changes delegate URL updates to `DashboardPage`
- `WarehouseTables` / `WarehousePanel` — stock `Client order` links call `onOpenSaleCard`
- `frontend/src/widgets/dashboard/ui/orders/create-order/create-order-card-shared.ts` — re-exports `getOrderLink` from `dashboard-navigation`

Spec: [BROWSER_NAVIGATION.md](./BROWSER_NAVIGATION.md).

## Structure Update: Dashboard UI Decomposition (2026-06-28)

Ранее все ~105 файлов лежали в плоской папке `widgets/dashboard/ui/`. Теперь UI разбит по доменным зонам dashboard.

### Карта папок `widgets/dashboard/ui/`

```text
ui/
|- index.ts                    # barrel: AccountingPanel, OrdersWorkspace, CreateOrderCard, …
|- accounting/                 # финансы, кассы, транзакции, отчёты
|  |- AccountingPanel.tsx
|  |- AccountingCashboxesView.tsx
|  |- AccountingTransactionsView.tsx
|  |- useAccountingFinanceData.ts
|  |- useAccountingPreferences.ts
|  `- useTransactionForm.ts
|- analytics/                  # главная аналитика dashboard
|  |- AnalyticsHeroSection.tsx
|  |- AnalyticsDateFilterPanel.tsx
|  `- SalesPanel.tsx
|- clients/                    # клиенты и поставщики
|  |- ClientsSuppliersWorkspace.tsx
|  |- ClientsWorkspace.tsx
|  |- ClientCardModal.tsx
|  `- ClientsTable.tsx
|- orders/
|  |- workspace/               # список заказов/продаж, фильтры, shared-утилиты
|  |  |- OrdersWorkspace.tsx
|  |  |- orders-workspace-shared.ts
|  |  `- SavedFiltersPanel.tsx
|  |- create-order/            # создание заказа/продажи, rapid sale
|  |  |- CreateOrderCard.tsx
|  |  |- create-order-card-shared.ts
|  |  `- RapidSaleModal.tsx
|  |- order-detail/            # карточка открытого заказа/продажи
|  |  |- OrderDetailCard.tsx
|  |  |- OrderDetailLineItemsPanel.tsx
|  |  |- OrderDetailDeviceModal.tsx
|  |  |- order-detail-card-types.ts
|  |  `- order-detail-shared.ts
|  `- modals/                  # модалки, общие для заказов
|     |- SupplierOrderModal.tsx
|     |- SerialBindModal.tsx
|     |- ProductModelModal.tsx
|     |- OrderPrintDialog.tsx
|     `- PrinterIcon.tsx
|- product-catalog/            # каталог товаров (Product List)
|  |- ProductCatalogPanel.tsx
|  |- ProductCatalogTables.tsx
|  `- product-catalog-shared.tsx
|- settings/                   # настройки, сотрудники, конструктор печати
|  |- SettingsPanel.tsx
|  |- PrintFormBuilder.tsx
|  `- EmployeeManagementPanel.tsx
|- supplier-orders/            # заказы поставщикам
|  |- SupplierOrdersWorkspace.tsx
|  `- SupplierOrdersWorkspaceSections.tsx
|- warehouse/                  # склад, приёмка, перемещения
|  |- WarehousePanel.tsx
|  |- WarehouseTables.tsx
|  |- WarehouseToolbar.tsx
|  `- WarehouseSelectField.tsx
|- weather/                    # виджет погоды/рынка на главной
|  |- MarketWeatherWidget.tsx
|  |- WeatherVisual.tsx
|  |- WeatherAnimatedScene.tsx
|  `- scene/                   # слои анимированной сцены
|     `- WeatherScene*.tsx
`- shared/                     # мелкие общие UI-куски dashboard
   |- Notifications.tsx
   `- PhoneNumber.tsx
```

### Точки входа (host)

- `frontend/src/pages/dashboard/ui/DashboardPage.tsx` — монтирует панели из `widgets/dashboard/ui/*`
- Импорт панели: `widgets/dashboard/ui/<zone>/<Component>` или через `widgets/dashboard/ui` (barrel)

### Внешние зависимости от `orders/workspace/`

- `frontend/src/shared/lib/serialPrint.ts` — `printWarehouseSerialLabels` из `orders-workspace-shared.ts`

### Соглашения после декомпозиции

- новый UI заказов → `orders/workspace/`, `orders/create-order/`, `orders/order-detail/` или `orders/modals/`
- новый UI склада → `warehouse/`
- новый UI клиентов → `clients/`
- общие хелперы заказов (статусы, line items, печать) → `orders/workspace/orders-workspace-shared.ts` или `widgets/dashboard/model/`
- не добавлять файлы в корень `ui/` — только в тематическую подпапку + при необходимости экспорт через `index.ts`

Migration script (reference): `frontend/scripts/reorganize-dashboard-ui.mjs`

## Structure Update: Order/Sale Card Product Lookup (2026-06-26)

### Frontend

- `frontend/src/widgets/dashboard/model/create-order-products.ts` — product suggestion builders: `buildCreateOrderProductSuggestions` (rapid sale legacy/shared), `buildOrderDetailProductSuggestions` (create-order sales + opened card `Products`)
- `frontend/src/widgets/dashboard/ui/orders/create-order/CreateOrderSaleSection.tsx` — grouped `Products` section for create-order sales
- `frontend/src/widgets/dashboard/ui/orders/create-order/CreateOrderSaleServicesSection.tsx` — collapsible `Services` section for create-order sales
- `frontend/src/widgets/dashboard/ui/orders/order-detail/OrderDetailLineItemsPanel.tsx` — opened card product lookup (`buildOrderDetailProductSuggestions`: serial/article stock mode, name catalog mode, warehouse label in suggestions)

## Structure Update: Rapid Sale (2026-06-24, UX 2026-06-30)

### Frontend

- `frontend/src/widgets/dashboard/ui/orders/create-order/RapidSaleModal.tsx` — modal UI: entry panel, pinned draft table, footer, `useLockBodyScroll`, `ProductSalePriceField` with `tierTogglePlacement: label`
- `frontend/src/widgets/dashboard/ui/orders/modals/SerialBindModal.tsx` — warehouse-filtered serial picker for order/sale card line items
- `frontend/src/widgets/dashboard/ui/warehouse/WarehouseSelectField.tsx` — shared warehouse dropdown (rapid sale + serial bind)
- `frontend/src/widgets/dashboard/model/warehouse-serial-filter.ts` — warehouse default, product filter, and oldest-serial selection helpers
- `frontend/src/widgets/dashboard/model/rapid-sale-line-items.ts` — `buildRapidSaleStockSuggestions`, `getRapidSaleOccupiedSerialNumbers`, `validateRapidSaleDraft`, line-item builder
- `frontend/src/widgets/dashboard/model/order-line-serials.ts` — `buildInMemorySerialUsageSale`, `collectOccupiedSerialNumbers` (draft serial occupancy for suggestions)
- `frontend/src/shared/ui/ProductSalePriceField.tsx` — shared price stepper + retail/wholesale toggle (`tierTogglePlacement: inline | label`)
- `frontend/src/widgets/dashboard/ui/product-catalog/product-catalog-shared.ts` — `useLockBodyScroll` (reused by rapid sale modal)
- `frontend/src/widgets/dashboard/model/sale-client-display.ts` — `Rapid sale` list label and search aliases
- `frontend/src/widgets/dashboard/ui/orders/create-order/CreateOrderCard.tsx` — `Rapid sale` header button (sales tab only)
- `frontend/src/pages/dashboard/model/dashboard-actions.ts` — `saveRapidSale`
- `frontend/src/pages/dashboard/ui/DashboardPage.tsx` — `handleRapidSaleCreated`, `pendingPaymentSale` payment handoff
- `frontend/src/widgets/dashboard/ui/orders/workspace/OrdersWorkspace.tsx` — list client column override, `pendingPaymentSale` effect
- Styles: `frontend/src/shared/styles/layout.css` (`.rapid-sale-*`, `.rapid-sale-price-field`), `responsive.css` (breakpoints)

### Backend

- `backend/src/domain/client/rapid-sale-client.ts` — `getOrCreateRapidSaleClient()`
- `backend/src/domain/sale/model.ts` — `isRapidSale` schema field
- `backend/src/domain/sale/service.ts` — `assertRapidSaleLineItems`, rapid branch in `createSale`
- `backend/src/shared/lib/parsers.ts` / `formatters.ts` — normalize and expose `isRapidSale`

### Tests

- `frontend/src/widgets/dashboard/ui/orders/create-order/RapidSaleModal.test.tsx`
- `frontend/src/widgets/dashboard/ui/orders/modals/SerialBindModal.test.tsx`
- `frontend/src/widgets/dashboard/model/warehouse-serial-filter.test.ts`
- `frontend/src/widgets/dashboard/model/rapid-sale-line-items.test.ts`
- `frontend/src/widgets/dashboard/model/sale-client-display.test.ts`
- `backend/src/domain/sale/service.rapid-sale.test.ts`

Spec: [SALE_FLOW.md](./SALE_FLOW.md#rapid-sale-2026-06-24).

## Structure Update: Catalog Products (2026-05-09)

### Backend

- `backend/src/domain/catalog-product/model.ts`
- `backend/src/domain/catalog-product/service.ts`
- `backend/src/routes/catalog-product.routes.ts`

### Frontend

- `frontend/src/entities/catalog-product/model/types.ts`
- `frontend/src/entities/catalog-product/api/catalogProductApi.ts`

### Integration Points

- `backend/src/domain/sale/service.ts` - syncs names into `catalog-products`.
- `frontend/src/widgets/dashboard/ui/product-catalog/ProductCatalogPanel.tsx` - adds `Products` tab.
