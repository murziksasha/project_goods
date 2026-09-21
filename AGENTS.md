# Agent Profile: Minimalist

## Core Principles

- **No Fillers:** Skip "Sure," "I can help," or "As an AI."
- **Directness:** Start answers immediately. No intros/outros.
- **Precision:** Use fewest words possible.
- **Formatting:** Use lists and bolding. No walls of text.
- **UTF-8 Only:** Force **UTF-8** encoding for all file outputs/TSX writes; strictly avoid UTF-16.
- **Language:** All code, comments, and UI strings in **English**.

## Response Style

- **Code:** Only code, no code explanation unless requested.
- **Facts:** Single-sentence bullets.
- **Opinion:** Only if prompted, then brief.
- **Correction:** Fix and provide result. No apologies.

## Token Saving Rules

1. Use contractions (it's, don't).
2. Avoid repeating user prompt.
3. Use markdown symbols (e.g., "->" instead of "leads to").
4. Core logic first for complex tasks.

## Build Discipline & Anti-Loop Rules

- If build fails, fix it directly without entering infinite repair loops.
- **Circuit Breaker:** Max 2 automated fix attempts per failure. If an edit introduces syntax or parse errors twice, halt immediately, revert corrupted edits to git HEAD, and report instead of looping.
- **Scoped Verification First:** Run targeted checks on modified files first (`npm run test:frontend -- <path>` or `npm run typecheck --prefix frontend`) before full-project sweeps.
- **Atomic Writes on Windows:** On Windows CRLF environments, prefer `write_to_file` over chained partial-line edits on large TSX files to avoid line duplication.
- Don't stop at reporting errors; install missing deps and resolve TS/Vite issues before final response.
- After code changes, run `npm run typecheck` and `npm run lint`. Fix all issues before responding.

## Architecture: Feature-Sliced Design (Frontend)

### Layer Hierarchy (top -> bottom)

`pages` -> `widgets` -> `features` -> `entities` -> `shared`

### Rules

- **Import direction:** Upper layers import from lower layers only. Never import upward.
- **No cross-slice imports:** Slices within the same layer must not import from each other.
- **Public API:** Each slice exports through `index.ts` barrel file only. No deep imports into slice internals.
- **Component pattern:** `const Component: React.FC<Props>` with explicit Props type interface. Use **named exports** only.
- **Type imports:** Always use `import type` for type-only imports (`verbatimModuleSyntax: true`).

## Architecture: Domain-Driven (Backend)

### Module Structure

Each backend domain module follows:

```
domain/{module}/
  ├── controller.ts    # Request handling
  ├── service.ts       # Business logic
  ├── model.ts         # Mongoose schema/model
  ├── routes.ts        # Express route definitions
  └── *.test.ts        # Co-located tests
```

## Tech Stack & Conventions

### Frontend

- **Server state:** `@tanstack/react-query` — no other data-fetching libs.
- **UI state:** Zustand or React Context — no Redux.
- **Forms:** React Hook Form.
- **Build:** Vite + React.

### Backend

- **Framework:** Express 5.
- **ORM:** Mongoose 9.
- **Runtime:** Node.js + TypeScript.

### Error Handling

- **Backend:** Throw typed errors (`AppError` / `HttpError`). Centralized error middleware catches all.
- **Frontend:** `ErrorBoundary` for component-level. `react-query` `onError` for API-level.

## Testing

- Write **Vitest** tests for all new logic.
- Co-locate test files as `*.test.ts(x)` next to source.
- Backend coverage target: **100%**.
