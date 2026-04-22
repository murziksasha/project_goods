# Project Goods

## Local development

The backend requires MongoDB at the URI in `backend/.env` or `backend/.env.example`.
By default that is:

```text
mongodb://127.0.0.1:27017/inventory
```

Start the local database first:

```bash
npm run db:up
```

Then start the backend and frontend:

```bash
npm run dev
```

Stop the local database when you are done:

```bash
npm run db:down
```
