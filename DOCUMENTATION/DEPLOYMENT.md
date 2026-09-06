# Deployment Guide

Related: [DEVELOPMENT.md](./DEVELOPMENT.md) · [BUILD_VERSION_SPEC.md](./BUILD_VERSION_SPEC.md) · [SECURITY.md](./SECURITY.md) · [index](./README.md)

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

1. Copies `mongodump` / `mongorestore` from the `mongo:7` image (same tag as the Compose `mongo` service). Do **not** download tools from `fastdl.mongodb.org` during image build — that CDN often times out or resets the stream. Runtime Kerberos libs come from Debian (`libgssapi-krb5-2`).
2. Installs **backend** npm deps only (`npm install --prefix backend`, not root `concurrently`) with registry retries, longer fetch timeouts, and a BuildKit npm cache. `registry.npmjs.org` ETIMEDOUT during `docker:up` is retried up to 5 times. Frontend image uses the same pattern for `frontend/`.
3. Runs `npm run build` (TypeScript → `dist/`).
4. Starts with `node dist/server.js` (`NODE_ENV=production` in Compose).

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

On-disk retention (scheduled age/count, safety count, optional total size) is enforced after each successful create and on the backup scheduler tick. See [DATA_RETENTION.md](./DATA_RETENTION.md).

| Variable | Default | Meaning |
|----------|---------|---------|
| `BACKUP_SCHEDULED_RETENTION_DAYS` | `14` | Drop scheduled archives older than N days |
| `BACKUP_SCHEDULED_MAX_COUNT` | `14` | Keep at most N scheduled archives |
| `BACKUP_SAFETY_MAX_COUNT` | `5` | Keep at most N safety archives |
| `BACKUP_MAX_TOTAL_BYTES` | `0` (off) | Cap total completed archive bytes; drops oldest scheduled then safety; **never** auto-deletes manual |

### DB size baseline

```bash
npm run db:stats --prefix backend
# or authenticated:
# GET /api/system/db-stats  (system.backups.manage)
```