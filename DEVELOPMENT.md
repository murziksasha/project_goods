# Development Guide

## Цель

Этот документ описывает предсказуемый локальный запуск и базовые правила сопровождения проекта.

## Требования

- Node.js с npm
- Docker Desktop или другой Docker runtime
- MongoDB, поднимаемая через Docker Compose

## Локальное окружение

### Backend

Пример переменных находится в `backend/.env.example`.

Обязательные значения:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/inventory
CLIENT_ORIGIN=http://localhost:5173
```

### Frontend

Пример переменных находится в `frontend/.env.example`.

Обязательное значение:

```env
VITE_API_URL=http://localhost:5000/api
```

## Установка

Установить все зависимости из корня проекта:

```bash
npm run install:all
```

Эта команда устанавливает:

- корневые зависимости
- зависимости backend
- зависимости frontend

## Локальный запуск

### Запуск базы данных

```bash
npm run db:up
```

### Запуск всего приложения

```bash
npm run dev
```

Будут запущены:

- backend на `http://localhost:5000`
- frontend на `http://localhost:5173`

### Запуск сервисов по отдельности

```bash
npm run dev:backend
npm run dev:frontend
```

### Остановка локальной инфраструктуры

```bash
npm run db:down
```

## Команды по пакетам

### Backend

```bash
npm run dev --prefix backend
npm run build --prefix backend
npm run start --prefix backend
npm run typecheck --prefix backend
```

### Frontend

```bash
npm run dev --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend
npm run preview --prefix frontend
```

## Рекомендуемый рабочий цикл

1. Сначала поднимать MongoDB.
2. Во время основной разработки держать frontend и backend запущенными вместе.
3. Проверять типы backend через `npm run typecheck --prefix backend`.
4. Проверять frontend через `npm run lint --prefix frontend`.
5. Перед заметными изменениями влить сборку обеих частей проекта.

## Типовые проблемы

### Backend не подключается к MongoDB

Проверьте:

- Docker действительно запущен
- `npm run db:up` выполнился без ошибок
- `MONGO_URI` указывает на правильную базу

### Frontend не достучался до API

Проверьте:

- backend работает на ожидаемом порту
- `VITE_API_URL` совпадает с base URL backend
- `CLIENT_ORIGIN` включает origin frontend

### Конфликт портов

Порты по умолчанию:

- `5173` для frontend
- `5000` для backend
- `27017` для MongoDB

Если порты меняются, нужно синхронно обновить `.env` значения для frontend и backend.

## Правила сопровождения

- не коммитить локальные `.env` файлы
- поддерживать `.env.example` в актуальном состоянии
- обновлять документацию вместе с изменениями скриптов, портов и окружения
