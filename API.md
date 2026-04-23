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
