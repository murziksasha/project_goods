# Agent Profile

Precedence: user message + system harness > this file > improvisation.  
Do not restyle answers to “fewest words / code only.” Architecture and safety here still apply.

Code, comments, and UI strings: **English**. File writes: **UTF-8** (never UTF-16).

## Plan vs execute

- **Plan** (user asks for a plan, or Plan mode): use `enter_plan_mode` / `exit_plan_mode`. Write the plan, **stop**. Do not edit code until the user approves.
- **Execute** (default after a concrete implementation request, or after plan approval): run tools and edits without asking permission for routine file changes, tests, and installs.

**Always confirm with the user before:** `git push` / force-push, merge, changing shared permissions, deleting branches, dropping or wiping Mongo, rewriting `backend/backups/`, editing `.env` secrets, running destructive scripts (`clear-sales`, password resets, demo seed overwrite), or production Docker changes.

## Source of truth

Read the matching doc **before** changing that domain. Index: `DOCUMENTATION/README.md`. One topic → one file; do not invent parallel rules.

| Work | Read first |
| --- | --- |
| Local run, env, scripts | `DOCUMENTATION/DEVELOPMENT.md` |
| Tests / coverage / e2e | `DOCUMENTATION/TESTING.md` |
| Layout / layers | `DOCUMENTATION/ARCHITECTURE.md`, `PROJECT_STRUCTURE.md` |
| HTTP / auth matrix | `DOCUMENTATION/API.md`, `SECURITY.md`, `Permission_Flow.md` |
| Query / SSE | `DOCUMENTATION/STATE_MANAGEMENT.md` |
| UI tokens / copy icon | `DOCUMENTATION/UI_DESIGN_SYSTEM.md` |
| Repair orders | `ORDER_FLOW.md`, `ORDER_CARD.md`, `REPAIR_KANBAN_SPEC.md` |
| Sales | `SALE_FLOW.md`, `SALE_CARD.md` |
| Warehouse / serials / bind | `WAREHOUSE_FLOW.md`, `SERIAL_NUMBER_SEQUENCE_SPEC.md` |
| Supplier orders | `SUPPLIER_ORDER_FLOW.md` |
| Finance | `ACCOUNTING.md` |
| Clients | `CLIENTS_RULES.md` |
| Employees / RBAC | `EMPLOYEES_SPEC.md`, `Permission_Flow.md` |
| Settings / dashboard / print | `SETTINGS_SPEC.md`, `BUSINESS_DASHBOARD.md`, `PRINT_FORMS_SPEC.md` |
| Lookups | `SPEC_SUGGESTIONS_BEHAVIOR.md` |

New API routes and pages inherit the same permission keys as existing siblings. Do not add unauthenticated or all-role access unless the spec says so.

Invariants (details live in the docs above): serial occupancy, stock qty, sale vs repair, accounting postings, sequence `S000001`.

## Frontend (FSD)

`pages` → `widgets` → `features` → `entities` → `shared`

- Upper layers import lower only. No upward imports.
- No cross-slice imports on the same layer.
- Public API: slice `index.ts` only. No deep imports.
- `const Component: React.FC<Props>` with an explicit Props interface. **Named exports** only.
- Type-only imports: `import type` (`verbatimModuleSyntax`).
- Server state: `@tanstack/react-query` only. UI state: Zustand or React Context. Forms: React Hook Form.
- Follow `UI_DESIGN_SYSTEM.md` tokens and existing widget patterns.

## Backend (domain modules)

```
backend/src/domain/{module}/
  controller.ts
  service.ts
  model.ts
  routes.ts
  *.test.ts
```

- Business logic in `service.ts`. Controllers parse HTTP and call services.
- Throw `AppError` / `HttpError`. Centralized middleware catches them.
- Frontend: `ErrorBoundary` + react-query errors for API failures.

Stack: Express 5, Mongoose 9, Node + TypeScript.

## Verification

Scoped to the package you touched:

- Frontend: `npm run test --prefix frontend` and/or `npm run lint --prefix frontend`
- Backend: `npm run test --prefix backend` and/or `npm run lint --prefix backend`
- Types: `npm run typecheck --prefix frontend` or `--prefix backend`
- UI behavior: exercise the flow (browser tools if available; else Playwright `npm run test:e2e` when the change is user-visible)
- Full gate only when asked: `npm run verify` from repo root

Do not claim tests/build passed without command output. Install missing deps and fix TS/Vite errors before the final reply.

**Circuit breaker:** max **2** automated fix attempts per failure. If an edit introduces syntax/parse errors twice, revert those files to `git HEAD`, stop looping, report.

Windows: PowerShell — chain with `;`, not `&&`. Prefer `write` over many tiny patches on large TSX (CRLF duplication). Use `block_until_ms` on `run_terminal_command`; do not poll with scheduler loops.

## Subagents

Use a subagent for a long isolated test/lint fix cycle or a wide codebase search.  
Do **not** spawn one for a small one-file change. The main agent owns the user-facing result and must read subagent output before saying done. Compact report: status, files, test results.
