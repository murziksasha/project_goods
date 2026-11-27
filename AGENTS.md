# Agent Profile

Precedence: user message + system harness > this file > improvisation.
Do not restyle user replies to “fewest words / code only.” Architecture, verification, and safety rules here still apply.

Code, comments, identifiers, and technical docs: **English**. File writes: **UTF-8** (never UTF-16).
UI text: never hardcode strings in JSX — use `i18next` (`t(...)`) and update `frontend/src/shared/i18n/locales/en.json` and `uk.json` together (print forms stay Ukrainian per spec).

## Plan vs execute

- **Plan** (user asks for a plan, or Plan mode): write the plan and **stop**. Do not edit code until the user approves.
- **Execute** (default after a concrete implementation request, or after plan approval): run tools and edits without asking permission for routine file changes, tests, and installs.

**Always confirm with the user before:** `git push` / force-push, merge, changing shared permissions, deleting branches, dropping or wiping Mongo, rewriting `backend/backups/`, editing `.env` / `.env.production` secrets, running destructive or apply scripts (`clear:sales`, password resets, demo seed overwrite / erase, `import:clients`, `backfill:* --apply`), or production Docker/DB commands (`update:prod`, `docker:up:prod`, `docker:build:prod`, `docker:rollback:*`, `mongo:users:init:prod`).

## Token economy (without losing quality)

- **Locate → slice → read:** Search first (`Select-String` / `Get-ChildItem`) and read only needed line ranges (`StartLine`/`EndLine`). Do not dump whole large files or unrelated docs.
- **Batch independent work:** Issue parallel searches, reads, and edits in one turn; combine scoped checks (`lint; typecheck; test`) into one shell command to cut extra turns (verify every chained step passed).
- **Zero redundant I/O:** Do not re-read unchanged files or re-run already-passing tests/diffs when no code changed; summarize results instead of pasting raw logs.
- **Strict task scope:** Edit only what the request requires—no unrequested refactors or speculative changes.
- **Smart delegation:** Handle 1–2 file tasks directly; use a subagent only for wide codebase searches or noisy multi-file lint/test fix loops, returning a compact report (status, files, test results). The main agent owns the final result and must read subagent output before replying.

## Source of truth

Read the matching doc **before** changing that domain. Index: `DOCUMENTATION/README.md`. One topic → one file; do not invent parallel rules.

| Work | Read first |
| --- | --- |
| Local run, env, scripts | `DOCUMENTATION/DEVELOPMENT.md`, `DOCUMENTATION/DEMO_DATA.md` |
| Prod Docker / hardening | `DOCUMENTATION/DEPLOYMENT.md`, `DOCUMENTATION/CONTAINER_HARDENING_PLAN.md` |
| Tests / coverage / e2e | `DOCUMENTATION/TESTING.md` |
| Layout / nav / build SHA | `DOCUMENTATION/ARCHITECTURE.md`, `DOCUMENTATION/PROJECT_STRUCTURE.md`, `DOCUMENTATION/BROWSER_NAVIGATION.md`, `DOCUMENTATION/BUILD_VERSION_SPEC.md` |
| HTTP / auth / retention | `DOCUMENTATION/API.md`, `DOCUMENTATION/SECURITY.md`, `DOCUMENTATION/Permission_Flow.md`, `DOCUMENTATION/DATA_RETENTION.md` |
| Query / SSE | `DOCUMENTATION/STATE_MANAGEMENT.md` |
| UI tokens / tabs / tables | `DOCUMENTATION/UI_DESIGN_SYSTEM.md` |
| Repair orders | `DOCUMENTATION/ORDER_FLOW.md`, `DOCUMENTATION/ORDER_CARD.md`, `DOCUMENTATION/REPAIR_KANBAN_SPEC.md` |
| Sales | `DOCUMENTATION/SALE_FLOW.md`, `DOCUMENTATION/SALE_CARD.md` |
| Warehouse / serials / bind | `DOCUMENTATION/WAREHOUSE_FLOW.md`, `DOCUMENTATION/SERIAL_NUMBER_SEQUENCE_SPEC.md` |
| Supplier orders | `DOCUMENTATION/SUPPLIER_ORDER_FLOW.md` |
| Finance | `DOCUMENTATION/ACCOUNTING.md` |
| Clients | `DOCUMENTATION/CLIENTS_RULES.md` |
| Employees / RBAC | `DOCUMENTATION/EMPLOYEES_SPEC.md`, `DOCUMENTATION/Permission_Flow.md` |
| Settings / dashboard / print | `DOCUMENTATION/SETTINGS_SPEC.md`, `DOCUMENTATION/BUSINESS_DASHBOARD.md`, `DOCUMENTATION/PRINT_FORMS_SPEC.md` |
| Lookups / catalog modal | `DOCUMENTATION/SPEC_SUGGESTIONS_BEHAVIOR.md`, `DOCUMENTATION/CATALOG_PRODUCT_CREATE_MODAL_SPEC.md` |

New API routes and pages inherit the same permission keys as existing siblings. Do not add unauthenticated or all-role access unless the spec says so.

Invariants (details live in the docs above): serial occupancy, stock qty, sale vs repair, accounting postings, sequence `S000001`.

## Frontend (FSD & UI)

`pages` → `widgets` → `features` → `entities` → `shared`

- Upper layers import lower only. No upward imports or cross-slice imports on the same layer.
- Public API: export via slice `index.ts`; avoid adding deep cross-slice imports in new code.
- New components: `const Component: React.FC<Props>` with explicit `Props` interface and **named exports** only.
- TypeScript & lint: `import type` (`verbatimModuleSyntax`), no `enum`/`namespace`/constructor parameter properties (`erasableSyntaxOnly`), respect `react-refresh/only-export-components` in `.tsx`.
- State & forms: server state in `@tanstack/react-query` (`queryKeys` in `frontend/src/shared/api/queryClient.ts`, refreshed via SSE `/api/events/stream`); local UI/form state in React state/hooks (`createContext` only when scoped — no Zustand or React Hook Form).
- UI & security: follow `DOCUMENTATION/UI_DESIGN_SYSTEM.md` (CSS tokens from `frontend/src/shared/styles/base.css` for dark-mode safety, `.orders-page`/`.orders-tab` shell, `CopyableValue`, `GlobalHorizontalScrollbar`). Sanitize print HTML with `DOMPurify`.

## Backend (domain modules)

```text
backend/src/domain/{module}/
  controller.ts
  service.ts       # or split submodules (sale, finance, supplier-order, analytics)
  model.ts         # omitted in model-less domains (auth, system, weather, etc.)
  routes.ts
  *.test.ts
```

- Business logic in `service.ts` (or domain submodules). Controllers parse HTTP (reuse `backend/src/shared/lib/parse/`) and call services.
- Throw `HttpError` (`AppError` base; centralized middleware catches both). Frontend handles errors via `AppErrorBoundary` + react-query.
- Auth, concurrency & transactions: mount protected routes after `requireAuthUnlessPublic` in `backend/src/app.ts` with `requirePermission`/`requireAnyPermission`/`requireOwner` + 401/403 coverage in `backend/src/test/api.integration.test.ts`; wrap multi-doc money/stock writes in `withOptionalMongoSession`; enforce `expectedUpdatedAt` via `assertNotStale` (`409`); never expose Mongo credentials (`redactMongoCredentials`) or `openWeatherApiKey`.
- Stack: Express 5, Mongoose 9, Node + TypeScript (`CommonJS` / `Node16`, `noUncheckedIndexedAccess`).

## Verification

Scoped to the package you touched:

- Frontend: `npm run lint --prefix frontend; npm run typecheck --prefix frontend; npm run test --prefix frontend` (`test` runs Vitest + `test:proxy`; CI skips Vitest, so always run locally)
- Backend: `npm run lint --prefix backend; npm run typecheck --prefix backend; npm run test --prefix backend`
- Coverage allow-list: if editing files in `coverageInclude` (`backend/vitest.config.ts` or `frontend/vitest.config.ts`), run `npm run test:coverage --prefix <pkg>` (100% line/branch gate)
- Deployment scripts: `npm run test:deployment` when changing `scripts/` or Docker/prod configs
- UI behavior: exercise the flow (browser tools if available; else `npm run test:e2e`, which auto-starts Vite on `:5174` and mocks `/api/**`)
- Full gate only when asked: `npm run verify` from repo root

Do not claim tests/build passed without command output. Install missing deps and fix TS/Vite/lint errors before the final reply.

**Circuit breaker:** max **2** automated fix attempts per failure. If an edit introduces syntax/parse errors twice, revert those files to `git HEAD`, stop looping, report.

Windows: PowerShell — chain with `;`, not `&&`. Prefer full file writes over many tiny patches on large TSX (CRLF duplication). Wait for tool/background completion notifications instead of polling loops.
