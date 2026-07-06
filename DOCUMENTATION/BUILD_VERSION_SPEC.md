# Build Version Label Spec

## Purpose

Show which frontend build the user is running: short git commit and build timestamp. Helps verify deploys, Docker rebuilds, and stale browser cache after releases.

## UI Placement

- **Location:** left sidebar (`app-sidebar`), inside `<nav class="sidebar-nav">`, **directly below the last menu item** (Settings / `nav.settings`).
- **Visibility:** only on the authenticated dashboard shell (`DashboardPage` after login). Not shown on the login screen or loading state.
- **Expanded sidebar:** full label — `{sha} · {localized build time}`.
- **Collapsed sidebar:** short SHA only; full label remains in the `title` tooltip.
- **Not in topbar:** the build label must not appear in the top header.

### Example

```text
⚙ Settings
─────────────
fbf5c78 · 06.07.2026, 21:55
```

## Label Format

| Part | Source | Dev (`npm run dev`) | Production build |
|------|--------|---------------------|------------------|
| SHA | `getBuildSha()` | `dev` | short git commit |
| Separator | fixed | ` · ` (middle dot + spaces) | same |
| Time | `__APP_BUILD_TIME__` | moment Vite config loaded | moment `vite build` ran |

Time is formatted with `toLocaleString`:

- `uk-UA` when UI language starts with `uk`
- `en-US` otherwise

Recomputed when the user switches language (`i18n.language`).

## Build-Time Injection

Values are compile-time constants injected by Vite `define` in `frontend/vite.config.ts`:

- `__APP_BUILD_SHA__`
- `__APP_BUILD_TIME__` (ISO-8601 string)

Resolution order for SHA at **Vite config load** (dev server start or `vite build`):

1. `process.env.VITE_BUILD_SHA` (Docker / CI)
2. `git rev-parse --short HEAD`
3. fallback `nogit`

`builtAt` is `new Date().toISOString()` when the Vite config module is evaluated — **not** on each page load or hot reload.

### Important

- Hot reload and browser refresh do **not** update the label.
- A new label requires restarting the dev server or running a new production build.

## Docker / Compose

`npm run docker:up` runs `scripts/docker-up.mjs`, which:

1. resolves `GIT_SHA` via `git rev-parse --short HEAD` (fallback `unknown`)
2. passes it to `docker compose up -d --build`

`docker-compose.yml` forwards the build arg to `frontend/Dockerfile`:

```yaml
args:
  GIT_SHA: ${GIT_SHA:-unknown}
```

Inside the image: `ENV VITE_BUILD_SHA=$GIT_SHA` before `npm run build`.

`.git` is excluded by `.dockerignore`, so Docker builds rely on `GIT_SHA` from the host — not `git` inside the container.

The production static server (`frontend/scripts/serve-with-api-proxy.mjs`) serves `index.html` with `Cache-Control: no-cache` so clients pick up new hashed asset names after redeploy.

## Source Files

| File | Role |
|------|------|
| `frontend/src/shared/lib/buildInfo.ts` | `getBuildSha()`, `getBuildLabel()` |
| `frontend/vite.config.ts` | inject `__APP_BUILD_*__` at build/dev start |
| `frontend/src/pages/dashboard/ui/DashboardPage.tsx` | render label in sidebar nav |
| `frontend/src/shared/styles/layout.css` | `.sidebar-build-info`, `.sidebar-build-info-collapsed` |
| `frontend/src/shared/styles/responsive.css` | mobile sidebar layout for build label |
| `scripts/docker-up.mjs` | pass `GIT_SHA` into compose build |
| `frontend/Dockerfile` | `ARG GIT_SHA`, `ENV VITE_BUILD_SHA` |
| `docker-compose.yml` | `GIT_SHA` build arg for frontend service |

## Verification Checklist

1. **Local dev:** `npm run dev` → sidebar shows `dev · {time}` after login.
2. **Local prod build:** `npm run build --prefix frontend` → SHA from current `git` commit (or `nogit` without git).
3. **Docker:** `npm run docker:up` → console prints `Building with GIT_SHA=...`; sidebar shows that SHA after hard refresh (`Ctrl+Shift+R`).
4. **Collapsed menu:** only SHA visible; hover shows full label.
5. **Language switch:** date/time portion updates locale without rebuild.

## Out of Scope

- Backend API version endpoint
- Semantic versioning (`package.json` version) in the UI
- Auto-refresh label without rebuild
- Build label on unauthenticated pages