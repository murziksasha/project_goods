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
|  |- features/
|  |- entities/
|  `- shared/
```

### Папки frontend

- `src/app/` - корневая композиция приложения
- `src/pages/` - страницы верхнего уровня
- `src/widgets/` - крупные секции интерфейса
- `src/features/` - пользовательские сценарии и интерактивные потоки
- `src/entities/` - доменные сущности, API-модули, типы и UI-компоненты
- `src/shared/` - переиспользуемая инфраструктура: стили, утилиты, HTTP-слой

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
