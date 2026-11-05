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

### First-time auth on a server with existing data (`npm run mongo:users:init:prod`)

Use this on a server whose `mongo-data` volume has never run with authentication (no `project_goods_admin` / `project_goods_app` users yet). Typical symptom: after `npm run mongo:keyfile:prepare:prod`, `docker:up:prod` shows MongoDB `Healthy` but `project_goods_backend` `unhealthy`, and the backend log reports `Authentication failed`.

1. **Backup.** If the app still works, create and download a backup (Settings → Backups) and keep it off the host. If it does not start with auth, temporarily rename `.env.production`, start the old stack with `npm run docker:up`, take the backup, run `npm run docker:down`, and rename the file back.
2. **`.env.production`.** Fill it for this server (see above) with a unique app password in `MONGO_URI`. Optionally add `MONGO_ADMIN_PASSWORD=<at least 12 chars>` for `project_goods_admin`; if you do, move it to a password manager and remove the line afterwards.
3. **Clean checkout** on the release commit (`git status` empty).
4. **Run** `npm run mongo:users:init:prod`. It:
   - validates `.env.production`, the clean checkout, both existing volumes and the container/volume identity; builds the commit images with `docker:build:prod` if they are missing (before anything is stopped);
   - stops the production stack with `compose stop` (never `down`, never `-v`) and checks that `project_goods_mongo` is no longer running;
   - starts a temporary `mongo:7` container (`project_goods_mongo_users_init_<random>`) **without keyfile/auth** on the existing data volume, with `--network none` and no published ports, hostname `mongo` → `127.0.0.1` so the stored `rs0` member finds itself; waits until it is writable PRIMARY;
   - creates or updates the users idempotently: `project_goods_admin` with `userAdminAnyDatabase` on `admin`, `project_goods_app` with `readWrite` + `dbAdmin` on `inventory`. Existing users get their password set (app: from `MONGO_URI`; admin: only when a password is available) and the required roles granted additively; no roles or users are removed. Passwords are passed to `mongosh` through the container environment, never as command-line arguments, and are never printed;
   - admin password source: `MONGO_ADMIN_PASSWORD` in `.env.production`, else `~/project_goods_secrets/mongo-admin-password.txt` from an earlier run, else an existing admin keeps its password; if the admin is missing and no password is available, a random one is generated and saved to that file (mode 600, not printed) — move it to a password manager and delete the file;
   - stops and removes the temporary container in a `finally` step (the data volume is kept);
   - runs `mongo:keyfile:prepare:prod` if the keyfile is missing or invalid, then `docker:up:prod`, and waits up to 90 s (`UPDATE_PROD_HEALTH_TIMEOUT_MS`) for `/api/health` with `mongoOk: true` and the current `buildSha`.
5. **Verify.** Sign in, open sales, stock and finance; create and download a backup. An unauthenticated `mongosh` on the host must be refused for data access.

Exit codes: `1` invalid configuration (nothing changed), `2` a Docker step failed (the failing step is named; if the stack was already stopped, start it with `npm run docker:up:prod`), `3` users are ready but the health check did not pass (check `npm run docker:logs:prod -- backend --no-follow`). Running it again on a server that already has the users is safe: it only resets the app password to the one in `.env.production` and re-grants the roles.

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

## Планируется (container hardening)

> **Ещё не реализовано.** Здесь описано будущее поведение по плану [CONTAINER_HARDENING_PLAN.md](./CONTAINER_HARDENING_PLAN.md). Пока реализация не влита, действует описание выше. Переключение production выполняется только после отдельного подтверждения (`AGENTS.md`).

**Образы и пользователь**
- `backend/Dockerfile` и `frontend/Dockerfile` станут многоэтапными. В runtime backend останутся `dist`, production-зависимости, `mongodump`/`mongorestore` из `mongo:7`, `libgssapi-krb5-2`, `curl` и `ca-certificates`. В runtime frontend останутся `dist`, скрипты прокси и Helmet. Зависимость `project_goods: file:..` удаляется.
- Оба контейнера работают от `node` (UID/GID `1000:1000`). Порты `5000` и `5173` больше 1024, поэтому открываются без capabilities.
- Backend-скрипты через `ts-node` (`npm run db:stats --prefix backend`, `import:clients`, `backfill:*`) внутри prod-контейнера работать не будут, их нужно запускать с хоста.

**Автоматическая миграция тома бэкапов**
- `npm run docker:up:prod` (и, значит, `npm run update:prod` и `npm run mongo:users:init:prod`) после проверки keyfile запускает одноразовый сервис `backup-volume-init`. Параметры: образ `mongo:7`, `--network none`, без портов, только capabilities `CHOWN`/`DAC_OVERRIDE`/`FOWNER`, том из `BACKUP_DATA_VOLUME`.
- Сервис проверяет всё дерево тома, включая `yearly/` и `.restore-*`. Если всё уже принадлежит `1000:1000`, ничего не меняется. Иначе: `stop backend`, `chown -R 1000:1000`, повторная проверка, затем обычный `up`. Повторный запуск безопасен. Ноутбук и `HPproliant` проходят один и тот же путь.
- Том с чужой меткой `com.docker.compose.project` команда отклоняет, ничего не меняя.

**Ограничения в `docker-compose.prod.yml`**
- backend: `mem_limit: 6g`, `pids_limit: 200`, `cap_drop: [ALL]`, `no-new-privileges`;
- frontend: `mem_limit: 128m`, `pids_limit: 200`, `cap_drop: [ALL]`, `no-new-privileges`, `read_only: true`, `tmpfs: /tmp`;
- MongoDB: `mem_limit: 2g` и `--wiredTigerCacheSizeGB 1`, без изменения пользователя и capabilities. `mongo-keyfile-init` не меняется.
- Перед переключением на каждом хосте нужно снять замеры: `docker stats --no-stream` в работе и во время бэкапа, `docker info --format "{{.MemTotal}}"` (память Docker VM) и физическую RAM хоста. Сумма лимитов должна помещаться в память Docker VM.
- Загрузка архива для восстановления (`POST /api/backups/restore-file`) сейчас целиком читается в память (`express.raw` → `Buffer`). После перехода на потоковую запись лимит backend планируется снизить по замерам.

**Заголовки**
- Helmet с общей конфигурацией применяется в API и в прокси frontend: HTML, `/assets/*`, SPA fallback, ошибки 500/502.
- HSTS и `upgrade-insecure-requests` выключены. Остаются `script-src 'self'`, `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`, `style-src 'self' 'unsafe-inline'` и `img-src 'self' data:`.
- Скрипт темы переносится в `frontend/public/theme-init.js`. `immutable`-кеш остаётся только у `/assets/*`, остальные файлы отдаются с `no-cache`.
- CSP включается в два этапа: сначала `Content-Security-Policy-Report-Only` (нарушения видны в консоли браузера), затем блокирующий режим отдельным релизом.

**Обновление и откат**
- Порядок обновления не меняется: бэкап вне хоста, `git pull --ff-only`, `npm run update:prod`, проверка. После обновления дополнительно проверить, что новый бэкап создаётся, скачивается и его файлы принадлежат `1000`.
- После первого такого обновления `:rollback` указывает на старые образы, которые работают от root. Rollback-слой `docker-compose.rollback.yml` наследует `cap_drop: [ALL]` из prod-слоя, а root без `DAC_OVERRIDE` не может писать в каталоги `1000`. Поэтому rollback-слой задаёт `user: "1000:1000"` для backend и frontend. Цикл «обновление → откат → обновление» с созданием бэкапа на каждом шаге проверяется на репетиции.
- Том бэкапов при откате назад на root не переводится.
- `docker:rollback:noauth` prod-слой не накладывает, `cap_drop` там нет.

## Troubleshooting production start

- **`MongoDB keyfile not found (missing or empty) in volume <project>_mongo-keyfile`** — the keyfile volume is new or empty (typical on a server that never ran the authenticated stack). Run `npm run mongo:keyfile:prepare:prod`. If this server has never had auth enabled, run `npm run mongo:users:init:prod` instead: it creates the `project_goods_admin` and `project_goods_app` users, prepares the keyfile, and starts the stack (see "First-time auth on a server with existing data" above).
- **`MongoDB keyfile has wrong permissions or owner`** — the keyfile must be mode 400 and its directory 700, both owned by uid/gid 999. Re-run `npm run mongo:keyfile:prepare:prod`.
- **MongoDB `Healthy` but `project_goods_backend` `unhealthy`, backend log `Authentication failed`** — the database has no `project_goods_app` user with the password from `.env.production` (server never had auth, or `.env.production` was copied from another machine). Run `npm run mongo:users:init:prod`.
- **`Step failed: <step> (docker exited with status N)`** — `docker:up:prod`, `update:prod` and `docker:rollback:prod` name the failing Docker step; Docker's own error is printed above that line.
