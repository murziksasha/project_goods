# Deployment Guide

Related: [DEVELOPMENT.md](./DEVELOPMENT.md) · [BUILD_VERSION_SPEC.md](./BUILD_VERSION_SPEC.md) · [SECURITY.md](./SECURITY.md) · [index](./README.md)

## Docker Compose: local development

```bash
npm run docker:up
```

Services:

| Service | Host binding | Image |
|---------|--------------|-------|
| MongoDB | `127.0.0.1:27017` | `mongo:7` with replica set `rs0` |
| Backend | `127.0.0.1:5000` | `backend/Dockerfile`, healthcheck requires `mongoOk: true` |
| Frontend | `0.0.0.0:5173` | `frontend/Dockerfile`, starts after backend is healthy |

Mongo **must** run as replica set (`?replicaSet=rs0` in `MONGO_URI`) for transactions used by sales/finance flows.
The host-side development URI also uses `directConnection=true` because the Docker replica-set member advertises `mongo:27017`, which the Windows host cannot resolve. The backend container keeps the internal `mongo:27017` URI.

## Authenticated production stack on an existing volume

Production adds `docker-compose.prod.yml` to the base Compose file. It keeps the frontend URL on port `5173`, restricts direct MongoDB and backend access to the server itself, and requires `.env.production`. Copy `.env.production.example` to `.env.production` **on the production host**. Before filling it, inspect the running MongoDB and backend containers to record their Compose project label and the exact named volumes mounted at `/data/db` and `/app/backups`. Enter those existing names as `COMPOSE_PROJECT_NAME`, `MONGO_DATA_VOLUME`, and `BACKUP_DATA_VOLUME`. Replace the URI placeholder with a unique URL-safe application password. The launcher checks the project label, both existing volumes and mounts, and an authenticated URI to `mongo:27017/inventory` with `authSource=inventory&replicaSet=rs0`. It does not print the URI. Store the separate administrator password in a password manager.

Both production and rollback Compose layers mark `mongo-data` and `backup-data` as **external** volumes with the recorded names. A changed checkout path or project name therefore cannot silently create an empty replacement database. `.env.production` is excluded from Git and the Docker build context; private values are not copied into images. On a host with this file, the local `db:up`, `db:down`, `docker:up`, and `docker:down` commands refuse to run. Production build and cutover also require a clean Git checkout so the image tag identifies exactly the source that was built.

The first production switch uses the existing `mongo-data` volume. `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` initialize only a new empty volume; they do not add users to a populated database. Do not use `docker compose down -v`, remove `mongo-data`, or recreate the database to enable authentication.

The MongoDB keyfile lives in a Docker-managed Linux volume, not in a Windows bind mount. On the production host, after creating `.env.production`, run:

```bash
npm run mongo:keyfile:prepare:prod
```

The helper verifies the existing project and volumes first, generates a random keyfile through standard input, never prints it, and verifies directory mode `0700`, file mode `0400`, and owner `mongodb` (UID/GID `999:999`). It leaves an existing valid keyfile intact. `npm run docker:up:prod` checks the file again before changing running services and refuses to start when it is missing or invalid. Keep the keyfile volume when updating containers.

### Rehearsal and preflight

Use a **separate staging Docker host**. The base Compose file has fixed container names and host ports, so a parallel project on the production host is unsafe. First start an isolated unauthenticated staging MongoDB replica set and restore a recently downloaded full `inventory` archive offline with `mongorestore`; a fresh staging database has no employee account for Settings → Backups. After the restore, sign in as a restored owner, compare per-collection counts with the production Settings → Database view, and exercise manual backup creation, download, upload, and restore through the UI. Repeat those UI checks after authentication. Also execute one safe test sale with a payment and stock movement, plus a finance write, under the authenticated application user to exercise the real transaction path. Never test restore or create test business records against the working database.

Record the current Git SHA, running image IDs, Compose project labels, exact `/data/db` and `/app/backups` volume names, replica-set status, free disk space, and backup size on production. Populate `.env.production` with those existing project/volume names. Commit the release and confirm a clean worktree. Before the maintenance window, run `npm run docker:build:prod`: it checks the running mounts, tags the current backend/frontend images as `project-goods/backend:rollback` and `project-goods/frontend:rollback`, and builds new images tagged with the current Git SHA. Containers continue running the old images. Verify that these rollback tags, the new commit tags, and local `mongo:7` image exist. The cutover uses `--no-build --pull never`. If the `project_goods_*` containers were removed but both declared volumes still exist, `docker:build:prod`, `docker:up:prod`, and `docker:rollback:prod` recreate the containers on those volumes; `docker:build:prod` then leaves the existing rollback tags unchanged for absent containers. A missing volume, a container from another Compose project, or a container mounting a different volume still stops the command. Docker errors are printed as reported by Docker.

On staging, prepare the keyfile and stop frontend/backend so that no writes occur. While MongoDB still runs without access control, create two users in `mongosh` inside the Mongo container using `passwordPrompt()`: `project_goods_admin` with `userAdminAnyDatabase` on `admin`, and `project_goods_app` with `readWrite` plus `dbAdmin` on `inventory`. Confirm their names and roles without displaying passwords. If users already exist, stop and inspect the deployment before changing them. Enter the app password in the private `.env.production` URI. Prebuild the production images, then run `npm run docker:up:prod` and repeat the application and backup checks with authentication active. If backup restore fails under these roles, stop the rollout and redesign credential separation; do not grant the backend the administrator account.

The new Mongo healthcheck checks that the existing member is writable primary; it does not call `rs.initiate`. The backend healthcheck checks the `mongoOk` JSON field instead of accepting its HTTP 200 response alone.

### Production maintenance window (up to 60 minutes)

1. Confirm that `npm run docker:build:prod` completed **before** the window and both rollback image tags exist. Stop new shop operations. Create and download one fresh manual backup through Settings → Backups, retain it on a separate PC, and record its SHA-256 hash. Compare the collection counts with the rehearsal baseline.
2. Stop frontend and backend. Create the two MongoDB users on the existing unauthenticated replica set as rehearsed. Prepare the keyfile volume if it was not prepared earlier. Do not change or delete `mongo-data`.
3. Run `npm run docker:up:prod` from the clean repository checkout. It validates the private env file, existing project/volume identity, image tags, keyfile, and Compose configuration, then starts the authenticated stack with `--no-build --pull never`.
4. Confirm MongoDB primary and backend `mongoOk: true`; sign in with two roles; open warehouse, sales, and finance lists; create and download a manual backup. From two LAN devices, confirm login and that their rate-limit IP keys are distinct. If both devices appear as one proxy peer, adjust the per-IP limit before rollout while keeping the per-username limit. Direct connections to `27017` and `5000` from other LAN devices must fail while the frontend remains reachable on `5173`.
5. If a check fails within the window **because of the auth migration itself** (for example the application user cannot authenticate), run `npm run docker:rollback:noauth -- --confirm-noauth`. It starts the exact saved rollback image tags on the base **unauthenticated** MongoDB command/URI (`docker-compose.yml` + `docker-compose.rollback.yml`, no keyfile), while the rollback layer pins the **same existing external data and backup volumes**. It prints a loud warning and refuses to run without `--confirm-noauth`. It uses `--no-build --pull never`; both direct ports remain loopback-only. If the failure is in the new application code rather than in auth, use the normal `npm run docker:rollback:prod`, which keeps auth (see below). Preserve `mongo-data` and the keyfile volume. Restore a database archive only if data damage is confirmed. Rehearse this rollback on staging before the production window.

Production Docker changes and edits to real `.env` secrets require explicit confirmation under `AGENTS.md` before execution.

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

## Day-to-day production operations

- `npm run docker:stop:prod` runs `docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml stop`. It only stops containers; volumes, the keyfile, and data are preserved. Restart with `npm run docker:up:prod`. Never use `down -v` on production.
- `npm run docker:logs:prod` runs the same Compose command with `logs -f --tail=200`. Pass service names after `--`, e.g. `npm run docker:logs:prod -- backend`; add `--no-follow` to print and exit.
- Both commands refuse to run when `.env.production` is missing or invalid.

## Updating production to a new commit

Use this for every routine release after the authenticated stack is in place.

1. **Backup.** In the app, Settings → Backups: create a backup, download it, and keep it off the host (USB drive, cloud, another PC).
2. **Pull.** From a clean checkout on the release branch: `git pull --ff-only`. `update:prod` never pulls by itself.
3. **Update.** `npm run update:prod`. It:
   - validates `.env.production` and requires a clean Git checkout;
   - runs the same steps as `npm run docker:build:prod` (tags the running backend/frontend images as `:rollback`, builds images for the current short `GIT_SHA`; running containers keep serving);
   - runs the same steps as `npm run docker:up:prod` (volume/project checks, image and keyfile checks, `up -d --no-build --pull never` on the existing volumes);
   - polls `http://127.0.0.1:5000/api/health` and `http://127.0.0.1:5173/api/health` for up to 90 seconds (override with `UPDATE_PROD_HEALTH_TIMEOUT_MS`) and requires `mongoOk: true` and `buildSha` equal to the current commit on both;
   - on success prints `docker compose ps` and a summary; on failure prints the last 80 backend log lines, the hint `npm run docker:rollback:prod`, and exits with code 1. It never rolls back, runs `down`, or removes volumes automatically.
4. **Verify.** Sign in, open sales, stock, and finance lists; check `/api/health` shows the new `buildSha`.
5. **Rollback if needed.** `npm run docker:rollback:prod` starts the images saved in step 3 on the same volumes. See "Rolling back a release" below.

## Rolling back a release

`npm run docker:rollback:prod` **keeps MongoDB authentication**. It runs Compose with `docker-compose.yml` + `docker-compose.prod.yml` + `docker-compose.rollback.yml`:

- the production layer keeps the MongoDB keyfile (`--keyFile`), the writable-primary healthcheck, and the authenticated `project_goods_app` `MONGO_URI` from `.env.production`;
- the rollback layer only swaps backend/frontend to `project-goods/backend:rollback` and `project-goods/frontend:rollback` and pins the existing external volumes.

Before changing containers it validates `.env.production` (including the authenticated `MONGO_URI`), the existing project/volume identity, that both `:rollback` images and `mongo:7` exist locally, the Compose configuration, and the keyfile volume. It then runs `up -d --no-build --pull never --force-recreate mongo backend frontend`. It never runs `down` or removes volumes. `BUILD_SHA` is read from the rollback backend image, so `/api/health` reports the rolled-back version. After the rollback, confirm `mongoOk: true` and that an unauthenticated MongoDB connection is refused. To return to the current release, run `npm run update:prod` again; note that its build step re-tags the images that are running at that moment (the rollback images) as `:rollback`.

`npm run docker:rollback:noauth -- --confirm-noauth` is an **emergency-only** command for reverting the auth migration itself on a host where the users or keyfile do not work yet. It starts the same rollback images on the base MongoDB command/URI **without access control**: anyone who can reach `127.0.0.1:27017` on the host can read or delete all data. Without `--confirm-noauth` it only prints the warning and exits. Do not use it for routine release rollbacks.

If the commit-tagged images are missing (for example, after deleting images in Docker Desktop), `npm run docker:up:prod` stops before changing containers with `Image project-goods/<service>:<sha> not found. Run npm run docker:build:prod first.` `npm run update:prod` builds them automatically.
