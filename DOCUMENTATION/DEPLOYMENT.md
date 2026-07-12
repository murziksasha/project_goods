# Deployment Guide

## Docker Compose (local / LAN)

```bash
npm run docker:up
```

Services:

| Service | Port | Image |
|---------|------|-------|
| MongoDB | 27017 | `mongo:7` with replica set `rs0` |
| Backend | 5000 | `backend/Dockerfile`, healthcheck on `/api/health` |
| Frontend | 5173 | `frontend/Dockerfile`, starts after backend is healthy |

Mongo **must** run as replica set (`?replicaSet=rs0` in `MONGO_URI`) for transactions used by sales/finance flows.

## Production backend image

`backend/Dockerfile`:

1. Installs MongoDB database tools (`mongodump` / `mongorestore`).
2. Runs `npm run build` (TypeScript → `dist/`).
3. Starts with `node dist/server.js` (`NODE_ENV=production` in Compose).

Pass build metadata:

```bash
docker build --build-arg BUILD_SHA=$(git rev-parse --short HEAD) -f backend/Dockerfile .
```

Health check response includes `version` and `buildSha` (see [BUILD_VERSION_SPEC.md](./BUILD_VERSION_SPEC.md)).

## Environment variables

### Backend (`backend/.env.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | Default `5000` |
| `MONGO_URI` | yes | Mongo connection string with replica set |
| `CLIENT_ORIGIN` | LAN | Comma-separated allowed CORS origins |
| `BACKUP_DIR` | no | Default `./backups` |
| `BUILD_SHA` / `GIT_SHA` | no | Exposed in `/api/health` |
| `NODE_ENV` | prod | `production` disables `/api/demo/*` |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_BUILD_SHA` | Sidebar build label (Docker build arg `GIT_SHA`) |
| `API_PROXY_TARGET` | Vite dev proxy target in Docker |

## Security assumptions

- LAN / trusted operators — see [SECURITY.md](./SECURITY.md).
- All `/api/*` routes except `/health`, `/auth/login`, `/auth/invitations/*` require Bearer token.
- RBAC per [Permission_Flow.md](./Permission_Flow.md).

## Backups

Scheduled backups use `mongodump` when available in the container. Configure `BACKUP_CREATE_COMMAND` / `BACKUP_RESTORE_COMMAND` for custom paths.