# План: усиление production-контейнеров и HTTP-заголовков

Статус: **реализовано в коде** (ветка `fixOrderSaleFeat`), production ещё не переключён. Отличия от исходного плана и результаты проверки — в разделе «Реализация» в конце. Связанные документы: [DEPLOYMENT.md](./DEPLOYMENT.md) (раздел «Container hardening»), [SECURITY.md](./SECURITY.md), [AGENTS.md](../AGENTS.md).

Доступ остаётся по HTTP внутри изолированной LAN магазина. HTTPS в этот план не входит и не рекомендуется: так решили для LAN-only установки.

## Итог

- Backend и frontend работают от пользователя `node` (UID/GID `1000:1000`) в очищенных runtime-образах, собранных многоэтапно.
- Владелец существующего тома бэкапов автоматически и идемпотентно меняется на `1000:1000` внутри `npm run docker:up:prod`. Поэтому шаг выполняют и `npm run update:prod`, и `npm run mongo:users:init:prod`, одинаково на ноутбуке и на `HPproliant`.
- Frontend отдаёт CSP, `X-Frame-Options: SAMEORIGIN` и остальные заголовки Helmet для HTML, assets, SPA fallback и ошибок прокси. HSTS и `upgrade-insecure-requests` выключены везде, в том числе в API. CSP включается в два этапа: сначала `Content-Security-Policy-Report-Only`, затем блокирующий режим.
- В production Compose задаются лимиты:
  - `mem_limit` для backend, frontend и MongoDB;
  - `pids_limit: 200`, `cap_drop: [ALL]` и `no-new-privileges` для backend и frontend;
  - `read_only: true` с `tmpfs: /tmp` для frontend.
- MongoDB получает `--wiredTigerCacheSizeGB 1`. Её права и запуск, а также контейнер `mongo-keyfile-init` не меняются.
- Откат (`npm run docker:rollback:prod`) остаётся рабочим и после смены владельца тома. Что для этого нужно, описано в разделе «Откат и том, принадлежащий 1000».

## Что сейчас в коде (проверено по файлам)

| Область | Текущее состояние | Файл |
| --- | --- | --- |
| Образ backend | Одноэтапная сборка на `node:20-bookworm-slim`: `COPY . .` всего репозитория, все зависимости, включая dev (ts-node, vitest, eslint, typescript), `npm run build`, запуск от root. `mongodump` и `mongorestore` копируются из `mongo:7`, ставятся `libgssapi-krb5-2`, `curl` и `ca-certificates`. | `backend/Dockerfile` |
| Образ frontend | Одноэтапная сборка на `node:20-alpine`: `COPY . .`, все зависимости, `npm run build`, запуск `node scripts/serve-with-api-proxy.mjs` от root. | `frontend/Dockerfile` |
| Лишняя зависимость | `"project_goods": "file:.."` в `dependencies` у `backend/package.json` и `frontend/package.json`. Импортов `project_goods` в `backend/src` и `frontend/src` нет. В образе это симлинк на `/app`, то есть на весь репозиторий. | `backend/package.json`, `frontend/package.json` |
| Инструменты бэкапа | **Используются.** `backend/src/domain/backup/service.ts` запускает `mongodump --uri … --archive=… --gzip` и `mongorestore … --gzip --drop` через `spawn` без shell. `backend/src/domain/archive/yearly-dump.ts` запускает `mongodump` для годовых архивов в `${BACKUP_DIR}/yearly`. Пользовательские `BACKUP_CREATE_COMMAND` и `BACKUP_RESTORE_COMMAND` запускаются через `spawn(…, { shell: true })`, поэтому в образе нужен `/bin/sh`. | `backend/src/domain/backup/service.ts`, `backend/src/domain/archive/yearly-dump.ts` |
| Healthcheck backend | `curl -fsS http://127.0.0.1:5000/api/health \| grep -q '"mongoOk":true'`. Нужны `curl`, `grep` и `sh`. | `docker-compose.yml` |
| Загрузка архива для восстановления | **Архив целиком грузится в память.** `express.raw({ limit: env.backupRestoreUploadLimit })` (по умолчанию `2gb`) собирает тело в `Buffer`, затем `restoreBackupFromUploadedArchive` делает `fs.writeFile` во временную папку `${BACKUP_DIR}/.restore-*`. Пиковое потребление на архиве 2 ГБ составляет примерно 2–4 ГБ: куски тела плюс итоговый `Buffer`. Отдельно память берёт дочерний `mongorestore`, а он работает в том же cgroup контейнера. Прокси frontend тело не буферизует, он передаёт его потоком через `pipe`. | `backend/src/domain/backup/routes.ts`, `backend/src/domain/backup/service.ts` |
| Скрипт темы | Встроенный `<script>` в `<head>` `frontend/index.html`. Он читает `localStorage['project-goods.ui-theme']` и ставит `data-theme` и `color-scheme` до отрисовки. Стандартная CSP Helmet (`script-src 'self'`) его заблокирует. | `frontend/index.html` |
| Кеш статики | `serve-with-api-proxy.mjs` отдаёт `index.html` с `no-cache, no-store, must-revalidate`, а **любой другой файл**, включая файлы из `public/` без хеша в имени, с `public, max-age=31536000, immutable`. | `frontend/scripts/serve-with-api-proxy.mjs` |
| Печать | `openOrderPrintWindow` открывает `window.open('', '_blank', 'width=980,height=760')`, затем `printWindow.document.write(buildOrderPrintHtml(…))`, `document.close()` и `print()`. HTML печати содержит встроенный `<style>` и атрибуты `style="--label-width…"`. Тело шаблона проходит DOMPurify (`sanitizePrintHtml`: `script`, `iframe`, `object`, `embed`, `form` и `on*` запрещены, `<img>` разрешён). Штрихкоды рисует JsBarcode как SVG из окна-владельца. Окно `about:blank` наследует CSP открывшей его страницы. | `frontend/src/widgets/dashboard/ui/orders/workspace/orders-workspace-shared.ts`, `frontend/src/shared/lib/sanitizeHtml.ts` |
| Встроенные стили и `blob:` | React-атрибуты `style={…}` есть в 33 файлах. `URL.createObjectURL` используется только для скачивания файлов через `<a href="blob:…">` (бэкапы, Excel-выгрузки). Предпросмотра `<img src="blob:…">` в коде нет. Внешних URL в коде нет: погода и котировки идут через backend. | `frontend/src/**` |
| Заголовки API | `app.use(helmet())` со значениями по умолчанию, то есть включены HSTS и `upgrade-insecure-requests`. Прокси frontend пробрасывает заголовки ответа backend как есть. | `backend/src/app.ts` |
| Тома в prod | `mongo-data` и `backup-data` объявлены как `external`, их имена берутся из `MONGO_DATA_VOLUME` и `BACKUP_DATA_VOLUME` в `.env.production`. Существующий том бэкапов создан, когда backend работал от root, поэтому его файлы принадлежат `0:0`. | `docker-compose.prod.yml`, `docker-compose.rollback.yml` |
| Путь запуска prod | `update:prod` = `docker-build-prod.mjs`, затем `docker-up.mjs --prod`, затем ожидание `/api/health`. `mongo-users-init-prod.mjs` в конце тоже вызывает `docker-up.mjs --prod`. Откат `docker-rollback-prod.mjs` накладывает `docker-compose.rollback.yml` **поверх** `docker-compose.prod.yml`. | `scripts/*.mjs` |
| `.grill` | Уже есть в `.gitignore` и в `.dockerignore`. | `.gitignore`, `.dockerignore` |

## Изменения

### 1. Зависимости

- Удалить `"project_goods": "file:.."` из `backend/package.json` и `frontend/package.json` и обновить соответствующие `package-lock.json`.
- Добавить `helmet` в `dependencies` у `frontend/package.json`: он нужен прокси во время работы. Взять ту же мажорную версию, что в backend (`^8`).

### 2. `backend/Dockerfile`: многоэтапная сборка

- Этап `mongo-tools` (`FROM mongo:7`) остаётся источником `mongodump` и `mongorestore`. Из `fastdl.mongodb.org` их по-прежнему не скачиваем.
- Этап `build`: `node:20-bookworm-slim`, `npm ci --prefix backend` со всеми зависимостями, кешем и повторами, `npm run build`. Копировать только `backend/`, без `COPY . .` всего репозитория.
- Этап `runtime`: `node:20-bookworm-slim`.
  - `apt-get install ca-certificates curl libgssapi-krb5-2`. `curl` нужен healthcheck, Kerberos нужен `mongodump` и `mongorestore` из `mongo:7`.
  - `COPY --from=mongo-tools` для `mongodump` и `mongorestore`, затем `mongodump --version && mongorestore --version` прямо в сборке.
  - `npm ci --omit=dev --prefix backend`, только production-зависимости.
  - `COPY --from=build /app/backend/dist`.
  - `RUN mkdir -p /app/backups/yearly && chown -R node:node /app/backups`. Новый пустой named volume при первом подключении унаследует этого владельца.
  - `USER node`, `ENV NODE_ENV=production BUILD_SHA=…`, `CMD ["node", "dist/server.js"]`.
  - `/bin/sh` остаётся в slim-образе: он нужен для `BACKUP_*_COMMAND` и `CMD-SHELL` в healthcheck.
- В runtime не попадают `AGENTS.md`, `DOCUMENTATION`, `.github`, `mcps`, `.vscode`, исходники TS, `frontend/`, dev-зависимости.
- Следствие: backend-скрипты через `ts-node` (`db:stats`, `import:clients`, `backfill:*`) внутри prod-контейнера работать не будут. Их и сейчас запускают с хоста через `npm run … --prefix backend`. Это нужно записать в DEPLOYMENT.md.

### 3. `frontend/Dockerfile`: многоэтапная сборка

- Этап `build`: `node:20-alpine`, `npm ci --prefix frontend`, `npm run build` с `VITE_BUILD_SHA`.
- Этап `runtime`: `node:20-alpine`, `npm ci --omit=dev --prefix frontend`. В runtime-зависимостях останется только Helmet (остальные пакеты нужны только для сборки бандла; при реализации можно сделать отдельный минимальный `package.json` для runtime). Копируются `dist/`, `scripts/serve-with-api-proxy.mjs`, `scripts/proxy-security.mjs` и новый модуль заголовков. `USER node`.
- Порт `5173` больше 1024, поэтому `node` открывает его без `CAP_NET_BIND_SERVICE`, и `cap_drop: [ALL]` здесь ничего не ломает. То же верно для backend на `5000`.

### 4. HTTP-заголовки (Helmet)

Общая конфигурация:

```js
{
  strictTransportSecurity: false,            // HTTP в LAN, HSTS не нужен
  contentSecurityPolicy: {
    reportOnly: CSP_REPORT_ONLY,             // этап 1: true, этап 2: false
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'", "'unsafe-inline'"], // React style={…} и <style> окна печати
      'img-src': ["'self'", 'data:'],         // blob: добавить только если появится предпросмотр
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],              // /api и SSE /api/events/stream
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': null,      // выключить
    },
  },
  frameguard: { action: 'sameorigin' },      // X-Frame-Options: SAMEORIGIN
}
```

- Backend (`backend/src/app.ts`): `helmet(config)` вместо `helmet()`. Для JSON-ответов API CSP почти ничего не значит, но так из API уходят HSTS и `upgrade-insecure-requests`.
- Frontend (`frontend/scripts/serve-with-api-proxy.mjs`): Helmet работает как обычный middleware `(req, res, next)` и для `node:http` без Express. Вызывать его до `writeHead` для всех веток: файл из `dist`, SPA fallback `index.html`, `500 Frontend build is unavailable` и `502 Backend API is unavailable`. Для ответов `/api` заголовки backend, переданные в `writeHead`, перекрывают одноимённые заголовки прокси, и это нормально.
- Конфигурацию держать в одном месте внутри каждого пакета (например, `frontend/scripts/security-headers.mjs` и `backend/src/config/security-headers.ts`). Тест сверяет набор директив, чтобы конфигурации не разошлись.
- **Скрипт темы** переносится из `frontend/index.html` во внешний `frontend/public/theme-init.js` и подключается в `<head>` как обычный блокирующий `<script src="/theme-init.js"></script>`, без `type="module"` и без `defer`. Так тема по-прежнему ставится до отрисовки.
- **Кеш:** сейчас прокси отдаёт любой не-`index.html` файл как `immutable` на год. Это относится и к `theme-init.js`, у которого в имени нет хеша. Правило нужно поменять: `immutable` только для `/assets/*` (файлы Vite с хешем), а `index.html`, `theme-init.js` и остальные файлы из `public/` отдавать с `no-cache`.
- Альтернатива, если внешний файл не подойдёт: оставить скрипт встроенным и разрешить его хешем `'sha256-…'` в `script-src`. Это менее удобно: хеш придётся обновлять при каждом изменении скрипта.

#### Что проверить в CSP отдельно

- `style-src`: встроенные стили React и `<style>` в окне печати требуют `'unsafe-inline'`. В стандартной конфигурации Helmet это уже есть, убирать нельзя.
- `img-src`: `data:` оставить (иконки и SVG в CSS). Предпросмотров через `blob:` сейчас нет, скачивание через `<a href="blob:…">` под `img-src` не попадает. **Риск:** в пользовательских шаблонах печати может быть `<img src="https://…">` (логотип). DOMPurify такой тег пропускает, а CSP `img-src 'self' data:` его заблокирует. Перед блокирующим режимом нужно проверить сохранённые шаблоны на ноутбуке и на `HPproliant`. Если внешние картинки есть, перевести их в `data:` или в файл на том же origin, а не расширять `img-src`.
- **Печать:** окно `window.open('')` + `document.write` наследует CSP открывшей страницы. Скриптов в HTML печати нет (их вырезает DOMPurify), штрихкоды рисуются из окна-владельца, а `<style>` разрешён через `'unsafe-inline'`. Ожидается, что печать работает. Проверить вручную все формы: А4, этикетку, пакетную печать этикеток и предпросмотр без печати.
- `frame-ancestors` в режиме Report-Only браузер игнорирует. На первом этапе встраивание страницы блокирует только `X-Frame-Options: SAMEORIGIN`, и этого достаточно.
- `Cross-Origin-Opener-Policy: same-origin` (по умолчанию в Helmet) на HTTP-адресе вида `192.168.x.x` браузеры игнорируют, а на `localhost` применяют. Окно печати того же origin продолжает работать в обоих случаях.

#### Порядок включения CSP

1. Этап 1, Report-Only: заголовок `Content-Security-Policy-Report-Only`, остальные заголовки Helmet уже действуют. Отдельный сервер для отчётов не нужен: нарушения видны в консоли DevTools.
2. Проверка на ноутбуке: вход, продажи, заказы, склад, финансы, аналитика, настройки, бэкапы, переключение темы, все виды печати. В консоли не должно быть сообщений `Content Security Policy` / `Refused to …`.
3. Этап 2, блокирующий режим: переключить `reportOnly` на `false` отдельным коммитом и выкатить через обычный `update:prod`.

### 5. `docker-compose.prod.yml`: ограничения

```yaml
services:
  mongo:
    command: [mongod, --replSet, rs0, --bind_ip_all, --keyFile, /run/mongo-keyfile/keyfile,
              --wiredTigerCacheSizeGB, "1"]
    mem_limit: 2g
  backend:
    mem_limit: 6g          # см. «Память»
    pids_limit: 200
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
  frontend:
    mem_limit: 128m
    pids_limit: 200
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    read_only: true
    tmpfs: ["/tmp"]
```

- MongoDB: пользователь, capabilities и keyfile не меняются, `mongo-keyfile-init` тоже. Добавляются только `--wiredTigerCacheSizeGB 1` и `mem_limit: 2g`. Без явного размера WiredTiger рассчитывает кеш от памяти, которую видит, и может упереться в лимит, после чего контейнер убивает OOM. Изменение `command` пересоздаст контейнер Mongo при первом `update:prod`, это несколько секунд простоя.
- `read_only` только для frontend: прокси ничего не пишет на диск. Для backend пока нет: он пишет в `/app/backups`, временные файлы `.restore-*` и вызывает внешние утилиты.
- `pids_limit` считает и потоки. В Node это около 10–20 потоков, у `mongodump`/`mongorestore` число потоков растёт с числом ядер. Значение `200` подтвердить по колонке `PIDS` в `docker stats` во время создания бэкапа на `HPproliant`, где ядер больше.
- `mem_limit` применяется к памяти Docker Desktop VM (WSL2), а не к физической памяти хоста.

### 6. Автоматическая миграция владельца тома бэкапов

Шаг встраивается в `scripts/docker-up.mjs --prod` после проверки keyfile и до `up`. Поэтому одинаково срабатывает в:

- `npm run update:prod` (вызывает `docker-up.mjs --prod`);
- `npm run docker:up:prod`;
- `npm run mongo:users:init:prod` (в конце вызывает `docker-up.mjs --prod`).

Устройство:

- Новый сервис `backup-volume-init` в `docker-compose.prod.yml` с `profiles: [setup]`, по образцу `mongo-keyfile-init`. Параметры: образ `mongo:7` (он уже есть локально и проверяется `docker-up.mjs`, тянуть `alpine` или `busybox` из интернета не нужно), `user: "0:0"`, `network_mode: none`, `cap_drop: [ALL]`, `cap_add: [CHOWN, DAC_OVERRIDE, FOWNER]`, том `backup-data:/backups`. Запуск через `compose run --rm --no-deps -T backup-volume-init` с `--pull never`.
- Проверка принадлежности тома:
  - имя тома берётся только из проверенного `BACKUP_DATA_VOLUME`;
  - `assertProductionDockerState` уже проверяет, что том существует и что существующий `project_goods_backend` этого проекта монтирует именно его в `/app/backups`;
  - дополнительно: если у тома есть метка `com.docker.compose.project`, она должна совпадать с `COMPOSE_PROJECT_NAME`, иначе стоп без изменений.
- Проверка без изменений: `find /backups -xdev \( ! -uid 1000 -o ! -gid 1000 \) -print -quit`. Проверяется всё дерево, включая `yearly/`, `.restore-*` и файлы метаданных, а не только корень. Если ничего не найдено, том уже мигрирован, шаг ничего не делает. Повторный запуск безопасен.
- Если найдено:
  1. вывести имя тома и количество файлов не того владельца;
  2. `compose stop backend`, чтобы старый backend от root не создал новый файл root во время смены владельца (например, бэкап по расписанию);
  3. `chown -R 1000:1000 /backups && chmod -R u+rwX /backups`;
  4. повторить проверку и при остатке файлов остановиться с ошибкой;
  5. продолжить обычный `up`.
- Отдельные коды выхода, как у проверки keyfile, и понятные сообщения (`backup volume ownership migrated`, `already owned by 1000`, `volume belongs to another project`).
- Данные не удаляются и не перемещаются. Меняются только владелец и право записи для владельца.
- Тесты в `scripts/backup-volume-owner.test.mjs` (добавить в `npm run test:deployment`):
  - аргументы команды: `--network none`, нет портов, `cap_drop ALL` + `CHOWN`/`DAC_OVERRIDE`/`FOWNER`, том только `backup-data`;
  - порядок шагов в `docker-up.mjs --prod`: проверка, при необходимости `stop backend`, затем `chown`, затем `up`;
  - отказ при чужой метке проекта;
  - разбор кодов выхода;
  - ветка «уже мигрировано»: `stop` и `chown` не вызываются.

### 7. Откат и том, принадлежащий 1000

- Важно: после первого обновления метка `:rollback` указывает на **старые образы, которые работают от root**.
- Сам по себе root в контейнере может читать и писать файлы `1000:1000`, но только пока у него есть `CAP_DAC_OVERRIDE`. `docker-compose.rollback.yml` накладывается поверх `docker-compose.prod.yml` и унаследует `cap_drop: [ALL]`. Тогда root без `DAC_OVERRIDE` получит `EACCES` при записи в каталоги `1000` с правами `755`, и **бэкапы в откаченной версии сломаются**.
- Решение: в `docker-compose.rollback.yml` для `backend` и `frontend` задать `user: "1000:1000"`. Старые образы при этом работают:
  - `/app` в них доступен на чтение всем;
  - `mongodump`/`mongorestore` в `/usr/local/bin` исполняемы для всех;
  - в `$HOME` и `/app` во время работы ничего не пишется.
  Новые образы от этого не меняются.
- Запасной вариант: `cap_drop: !reset []` в rollback-слое. Требует Docker Compose 2.24+, это нужно проверить на обоих хостах.
- Проверить на репетиции, на ноутбуке:
  1. `update:prod` на новые образы, затем бэкап;
  2. `docker:rollback:prod`, затем бэкап, скачивание, удаление тестового бэкапа и годовой архив, если доступен;
  3. снова `update:prod`, затем бэкап.
  Все созданные файлы должны принадлежать `1000:1000`.
- Обратная смена владельца на root при откате не нужна и не делается.
- `docker:rollback:noauth` не накладывает prod-слой, поэтому `cap_drop` там нет, и root пишет в том `1000` штатно.

### 8. Память

- Хост сейчас работает нормально. Лимиты нужны как страховка, а не как ответ на текущую проблему.
- Перед переключением:
  - снять `docker stats --no-stream` в обычной работе, во время создания бэкапа и во время восстановления **малого тестового архива** в одноразовом стеке;
  - если поддерживается, прочитать пик в `/sys/fs/cgroup/memory.peak` контейнера;
  - узнать память Docker VM: `docker info --format "{{.MemTotal}}"`. На Windows с WSL2 это по умолчанию около 50% физической памяти или значение из `.wslconfig`;
  - узнать физическую память `HPproliant`: `(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory` в PowerShell.
- Сумма `6g + 2g + 128m` должна оставлять запас внутри памяти Docker VM на **каждом** хосте. Если на `HPproliant` памяти VM меньше, уменьшить лимит backend, а не ставить лимиты больше памяти VM.
- **Находка:** загрузка архива на 2 ГБ сейчас целиком идёт в память (`express.raw` → `Buffer` → `fs.writeFile`). Это и есть причина, по которой нужен лимит `6g`. Правильное исправление — потоковая запись тела запроса во временный файл в `${BACKUP_DIR}/.restore-*` (`pipeline(req, createWriteStream)` со счётчиком байт и тем же пределом `BACKUP_RESTORE_UPLOAD_LIMIT`), а не увеличение лимита.
- Порядок:
  1. Первая волна: лимит `6g`, поведение загрузки как сейчас.
  2. Отдельная небольшая задача: потоковая загрузка с тестами.
  3. После неё снизить лимит backend до `2g` по замерам `docker stats`.
- Предел загрузки 2 ГБ остаётся.

## Риски

| Риск | Вероятность | Влияние | Как снижаем |
| --- | --- | --- | --- |
| После `USER node` backend не может писать в существующий том бэкапов (root) | Высокая без миграции | Высокое: бэкапы и восстановление ломаются, часто незаметно до первого бэкапа | Автоматическая идемпотентная миграция в `docker-up.mjs --prod`; проверка всего дерева, включая `yearly/`; бэкап после обновления в чек-листе |
| Миграция зацепит чужой том | Низкая | Высокое | Имя только из `BACKUP_DATA_VOLUME`, проверка монтирования у backend этого проекта и метки `com.docker.compose.project`, `--network none`, `--pull never` |
| Во время смены владельца старый backend создаст файл root | Средняя (бэкап по расписанию) | Среднее | `stop backend` перед `chown`, повторная проверка после |
| В runtime-образе нет `mongodump`/`mongorestore`/Kerberos/`curl` | Средняя при многоэтапной сборке | Высокое: бэкапы ломаются, healthcheck падает | Явная установка в runtime-этапе; `--version` в сборке; тест `docker run --rm <image> sh -c 'command -v mongodump mongorestore curl'` |
| CSP ломает интерфейс (тема, стили, печать, картинки в шаблонах) | Средняя | Среднее | Скрипт темы вынесен в файл; `'unsafe-inline'` для стилей; сначала Report-Only; ручная проверка всех экранов и печати; проверка `<img>` во внешних шаблонах |
| `theme-init.js` закешируется как `immutable` на год | Высокая без правки кеша | Низкое–среднее: старая версия скрипта у клиентов | `immutable` только для `/assets/*`, `no-cache` для `index.html` и `public/*` |
| Откат на старые root-образы с `cap_drop: ALL` не может писать в том `1000` | Высокая, если не учесть | Высокое: в откате нет бэкапов | `user: "1000:1000"` в `docker-compose.rollback.yml`; цикл обновление → откат → обновление на репетиции |
| OOM kill backend при загрузке большого архива | Низкая–средняя | Среднее: восстановление из файла падает, контейнер перезапускается | `6g` в первой волне; затем потоковая загрузка и снижение лимита по замерам |
| Сумма лимитов больше памяти Docker VM на `HPproliant` | Неизвестна | Среднее | Замер `docker info` и RAM хоста до переключения |
| MongoDB упирается в `mem_limit` | Низкая с `--wiredTigerCacheSizeGB 1` | Высокое | Явный размер кеша; замер `docker stats` |
| `pids_limit 200` мало для `mongodump` на многоядерном хосте | Низкая | Среднее: бэкап падает с ошибкой создания потока | Замер `PIDS` во время бэкапа на `HPproliant`; при необходимости поднять |
| `read_only` frontend ломает запуск | Низкая | Низкое: сразу видно при старте | `tmpfs: /tmp`; проверка в одноразовом контейнере |
| Удаление `project_goods: file:..` ломает установку зависимостей | Низкая | Низкое: ловится при сборке | Обновить lock-файлы, полная проверка `npm run verify` |
| Скрипты `ts-node` перестанут работать внутри контейнера | Высокая (так задумано) | Низкое | Запускать с хоста, записано в DEPLOYMENT.md |

## Порядок реализации

0. Записать решения интервью в `.grill/container-hardening.md`. Папка уже в `.gitignore` и `.dockerignore`, файл в Git не попадает.
1. Зависимости: удалить `project_goods: file:..`, добавить `helmet` во frontend, обновить lock-файлы.
2. Заголовки: модули конфигурации Helmet для backend и frontend, Helmet в прокси для всех веток ответа, `reportOnly: true`, выключенные HSTS и `upgrade-insecure-requests`. Тесты заголовков.
3. Тема: `frontend/public/theme-init.js` вместо встроенного скрипта; правило кеша `immutable` только для `/assets/*`.
4. `backend/Dockerfile` и `frontend/Dockerfile`: многоэтапная сборка, `USER node`, `/app/backups` с владельцем `node`.
5. Миграция тома: сервис `backup-volume-init`, модуль `scripts/backup-volume-owner.mjs`, вызов из `docker-up.mjs --prod`, тесты, расширение `test:deployment`.
6. `docker-compose.prod.yml`: лимиты, `cap_drop`, `no-new-privileges`, `pids_limit`, `read_only` + `tmpfs` для frontend, `--wiredTigerCacheSizeGB 1`. `docker-compose.rollback.yml`: `user: "1000:1000"`.
7. Документация: DEPLOYMENT.md, SECURITY.md, README — раздел «Планируется» становится описанием текущего поведения.
8. Проверка (см. ниже) в одноразовых контейнерах.
9. Репетиция на ноутбуке в режиме Report-Only, затем отдельный коммит с блокирующей CSP.
10. `HPproliant` — только после отдельного подтверждения.
11. Отдельной задачей: потоковая загрузка архива и снижение `mem_limit` backend.

## Проверка

- `npm run verify` (lint, typecheck, тесты, сборка) и `npm run test:deployment`.
- Тесты заголовков (`frontend/scripts/*.test.mjs`, backend через supertest):
  - для HTML, `/assets/*`, SPA fallback, 500 и 502 есть CSP или Report-Only, `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`, `script-src 'self'`, `nosniff`;
  - нет `Strict-Transport-Security` и `upgrade-insecure-requests`, в том числе в API;
  - `index.html` и `theme-init.js` отдаются с `no-cache`, `/assets/*` с `immutable`.
- Содержимое образов:
  - `docker run --rm <backend-image> sh -c 'id -u; command -v mongodump mongorestore curl; mongodump --version; ls /app'` должен показать `1000`, все три пути и только `backend/dist`, `node_modules`, `package*.json`;
  - нет `AGENTS.md`, `DOCUMENTATION`, `.github`, `mcps`, `.vscode`, `src`, `frontend`;
  - `npm ls --omit=dev` без dev-пакетов;
  - для frontend: `id -u` = `1000`, есть `dist` и скрипты прокси.
- Миграция и бэкапы в одноразовом окружении: временная сеть, временный `mongo:7` без портов, временный том с файлами root, включая `yearly/`. Проверить:
  - миграцию и повторный запуск без изменений;
  - `mongodump` и `mongorestore` малого архива образом backend от `node`;
  - запуск старого образа от root с `user: "1000:1000"` и запись в мигрированный том.

  Удалять только созданные тестом объекты с явным префиксом. Рабочие тома и порты не используются.
- `docker compose … config` показывает итоговые `mem_limit`, `pids_limit`, `cap_drop`, `security_opt`, `read_only` и `tmpfs`.
- Браузер на собранном frontend:
  - тема ставится до появления страницы, без мигания;
  - основные экраны работают;
  - печать А4, этикетки и пакетная печать работают;
  - нет сообщений CSP в консоли;
  - после переключения в блокирующий режим проверить всё ещё раз.

## Переключение production

1. Нужно отдельное подтверждение на production-изменения Docker по `AGENTS.md` и `DOCUMENTATION/DEPLOYMENT.md`. Смена владельца тома бэкапов тоже считается изменением бэкапов.
2. Чистый локальный коммит, `git pull --ff-only` на хосте.
3. Создать бэкап в программе, скачать и сохранить вне хоста.
4. Замеры: `docker stats --no-stream`, `docker info --format "{{.MemTotal}}"`, RAM хоста. Сверить с лимитами.
5. `npm run update:prod`. Он сохранит `:rollback`, соберёт образы, автоматически мигрирует том, запустит стек и проверит `/api/health`.
6. Проверить:
   - `/api/health` (`mongoOk: true`, новый `buildSha`);
   - вход двумя ролями, продажи, склад, финансы, печать;
   - создание и скачивание бэкапа, владелец новых файлов `1000`;
   - заголовки (`curl -I http://localhost:5173/`);
   - `docker stats`;
   - консоль браузера на нарушения CSP.
7. При любом ключевом сбое сразу выполнить `npm run docker:rollback:prod`.
8. Восстановление рабочей БД не тестировать.
9. После проверки на ноутбуке выкатить блокирующую CSP тем же путём, затем то же на `HPproliant`.

## Откат

1. `npm run docker:rollback:prod` поднимает `project-goods/{backend,frontend}:rollback` на тех же томах с авторизацией MongoDB. Rollback-слой задаёт `user: "1000:1000"`, поэтому старый образ пишет в мигрированный том.
2. Проверить `/api/health` (`mongoOk: true`, `buildSha` версии отката), вход, создание бэкапа.
3. Вернуть код: `git checkout <прежний коммит>`, чтобы checkout совпадал с запущенными образами.
4. Том бэкапов назад на root **не переводить**: и новые, и старые образы с `user: 1000` с ним работают.
5. Если сбой связан с `--wiredTigerCacheSizeGB` или лимитом памяти Mongo, откатить коммит compose и запустить `npm run update:prod` на прежнем коммите. Rollback-слой меняет только образы backend и frontend, а настройки Mongo берёт из текущего `docker-compose.prod.yml`.
6. Данные не трогаются. Архив восстанавливается только при подтверждённом повреждении данных.

## Принятые ограничения

- Доступ по HTTP только с управляемых ПК изолированной LAN. HTTPS не планируется.
- Backend сохраняет право записи в том бэкапов. `USER node` не защищает бэкапы, если код выполнится внутри backend, но ограничивает права в остальной системе контейнера.
- Предел загрузки архива остаётся 2 ГБ. Лимит `6g` в первой волне выбран по расчёту и по замерам `docker stats`, без тяжёлого теста около 2 ГБ на рабочем хосте.
- Решения интервью хранятся в `.grill/container-hardening.md`, вне Git.

## Реализация

Отличия от плана выше:

- Миграция тома сделана не сервисом Compose `backup-volume-init`, а прямым `docker run --rm` на `mongo:7` из `scripts/backup-volume-owner.mjs` (`--pull never`, `--network none`, `--cap-drop ALL`, для проверки только `DAC_READ_SEARCH`, для миграции `CHOWN`/`DAC_OVERRIDE`/`FOWNER`, `--mount` только тома `BACKUP_DATA_VOLUME`). Так её может вызвать и `docker:rollback:noauth`, у которого нет prod-слоя.
- Миграция вызывается в `docker-up.mjs --prod` (до `up`), в `docker-rollback-prod.mjs` (оба режима, до `up`) и в локальном `docker-up.mjs` (после `up --build`, если том уже есть, затем перезапуск backend).
- Режим CSP переключается переменной `CSP_REPORT_ONLY` (по умолчанию `true`) в backend и frontend; в `docker-compose.prod.yml` она берётся из `.env.production`.
- Runtime frontend копирует из сборки только `node_modules/helmet` (у него нет зависимостей), без `npm ci --omit=dev`, которое притащило бы React и xlsx.
- `serve-with-api-proxy.mjs` экспортирует `createFrontendServer()` для тестов заголовков; запуск через `node scripts/serve-with-api-proxy.mjs` не изменился.

Проверено:

- Бокс: `npm run lint` (0 ошибок, 2 старых предупреждения в `ClientCardOverlay.tsx`), `npm run typecheck`, backend vitest 550/550, frontend vitest 1346/1346 + `test:proxy` 10/10, `npm run build`, `npm run test:deployment` 76/76.
- Ноутбук, только одноразовые объекты с префиксом `pg_hardening_test` / `pg-hardening-test` (удалены после проверки; рабочие контейнеры, тома и другие проекты не трогались):
  - образы собраны (`backend` 416 MB против 552 MB, `frontend` 197 MB против 526 MB у `0f3bff8`); оба `uid=1000(node)`; в backend есть `mongodump`/`mongorestore` 100.20.0, `curl`, `sh`, `grep`; нет `AGENTS.md`, `DOCUMENTATION`, `.github`, `mcps`, `.vscode`, `frontend`, `src`, `typescript`, `vitest`, `ts-node`, `project_goods`;
  - миграция на томе с файлами root (включая `yearly/`, `.restore-*`, каталог `700`): 9 записей → `1000:1000`, `stopBackend` вызван один раз; повторный запуск — `unchanged`; том чужого проекта и отсутствующий том отклонены без изменений (том не создан);
  - бэкап и восстановление через настоящий `backup/service` нового образа от `node` с `cap_drop ALL`, `no-new-privileges`, `pids_limit 200`, `--memory 6g` на одноразовой MongoDB: `BACKUP_RESTORE_OK`, все файлы `1000:1000`;
  - старый образ `project-goods/backend:0f3bff8` от root с `cap_drop ALL` на мигрированном томе: `EACCES`; тот же образ с `--user 1000:1000`: `BACKUP_RESTORE_OK`; старый frontend с `--user 1000:1000 --read-only`: HTTP 200;
  - заголовки через прокси: `/`, `/theme-init.js`, `/assets/index-*.js`, `/orders/123`, `/api/health` и 502 при остановленном backend — `Content-Security-Policy-Report-Only`, `X-Frame-Options: SAMEORIGIN`, без HSTS; `immutable` только у `/assets/*`;
  - healthcheck `curl … | grep mongoOk:true` внутри нового backend работает; frontend на `read_only` не пишет в `/app`, `/tmp` доступен;
  - `docker compose config` с prod- и rollback-слоями (фиктивный env-файл) показывает ожидаемые `mem_limit`, `pids_limit`, `cap_drop`, `security_opt`, `read_only`, `tmpfs`, `--wiredTigerCacheSizeGB 1` и `user: 1000:1000` в откате;
  - замеры: Docker VM 14.57 GiB; рабочий стек сейчас backend ≈95 MiB/11 PIDs, frontend ≈15 MiB/11 PIDs, mongo ≈217 MiB.

Осталось:

- Проверка в браузере на собранном стеке: тема до отрисовки, основные экраны, все виды печати, консоль без нарушений CSP (Report-Only).
- Проверить сохранённые шаблоны печати на внешние `<img src="https://…">`.
- Переключение ноутбука и затем `HPproliant` по разделу «Переключение production» — после отдельного подтверждения; на `HPproliant` снять `docker info --format "{{.MemTotal}}"` и RAM.
- Отдельной задачей: потоковая загрузка архива и снижение `mem_limit` backend.

