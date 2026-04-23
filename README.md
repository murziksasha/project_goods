# Project Goods

Project Goods - full-stack приложение для учета товаров, клиентов, сотрудников, продаж и финансовых операций.

## Карта документации

- [DEVELOPMENT.md](./DEVELOPMENT.md) - локальный запуск, переменные окружения и рабочие команды
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - структура репозитория и назначение директорий
- [ARCHITECTURE.md](./ARCHITECTURE.md) - техническая архитектура и поток данных
- [API.md](./API.md) - обзор backend API и маршрутов

## Технологии

- Frontend: React, TypeScript, Vite, Axios, Bootstrap
- Backend: Node.js, Express, TypeScript, Mongoose
- Database: MongoDB
- Local infrastructure: Docker Compose

## Структура репозитория

```text
project_goods/
|- backend/      # Express API, доменные сервисы, модели Mongoose
|- frontend/     # React-приложение
|- docker-compose.yml
|- package.json  # корневые команды для локальной разработки
```

Подробности вынесены в [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

## Быстрый старт

### 1. Установить зависимости

```bash
npm run install:all
```

### 2. Подготовить переменные окружения

Создайте локальные `.env` файлы на основе:

- `backend/.env.example`
- `frontend/.env.example`

### 3. Запустить MongoDB

```bash
npm run db:up
```

### 4. Запустить frontend и backend

```bash
npm run dev
```

### 5. Открыть приложение

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

## Корневые команды

```bash
npm run dev
npm run dev:backend
npm run dev:frontend
npm run db:up
npm run db:down
npm run install:all
```

## Текущие функциональные области

- каталог товаров и работа с остатками
- управление клиентами и история клиента
- продажи и сервисные заказы
- управление сотрудниками
- настройки компании
- финансовые операции и кассы
- наполнение демо-данными
- экспорт товаров в Excel

## Текущие ограничения

- endpoint импорта товаров из Excel уже объявлен, но пока возвращает `501 Not Implemented`
- автоматические тесты еще не настроены
- frontend и backend пока управляются как отдельные пакеты, без workspace-инструмента

## Принципы документации

- корневые документы должны быстро вводить в проект и объяснять архитектуру
- детали API лучше хранить в одном месте, без дублирования
- при изменении структуры, скриптов или окружения документация обновляется в той же задаче
- документация должна описывать реальные договоренности проекта, а не абстрактный идеал
