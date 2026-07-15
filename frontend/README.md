# Frontend — Project Goods

React 19 SPA для CRM dashboard (заказы, склад, клиенты, финансы, настройки).

## Стек

- **React 19** + TypeScript + **Vite 8**
- **TanStack Query** — server state (частично; см. `STATE_QUERY_MIGRATION_PLAN.md`)
- **Axios** — HTTP (`shared/api/http.ts`)
- **i18next** — en/uk (`shared/i18n/`)
- **Custom CSS** — `shared/styles/` (без Bootstrap/Tailwind)

## Архитектура (FSD)

```text
src/
  app/          # App shell, error boundary
  pages/        # DashboardPage, navigation model
  widgets/      # Orders, warehouse, accounting panels
  features/     # Forms (client, product, sale)
  entities/     # API + models per domain
  shared/       # UI primitives, styles, lib
```

## Команды

```bash
npm run dev       # Vite dev server (proxy /api -> localhost:5000)
npm run build
npm run test      # Vitest
npm run lint
```

## Навигация

SPA routing через query params (`?page=orders&saleId=...`). См. [BROWSER_NAVIGATION.md](../DOCUMENTATION/BROWSER_NAVIGATION.md).

## Документация

Полный индекс: [README.md](../README.md).