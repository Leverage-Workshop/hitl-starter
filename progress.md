# Session Progress Log

## Current State

**Last Updated:** 2026-06-10
**Active Feature:** None — feat-008 completed this session

## Status

### What's Done

- [x] Harness scaffolded: `CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`.
- [x] `CLAUDE.md` deep content migrated to `docs/ARCHITECTURE.md`, `docs/API.md`,
      `docs/DESIGN.md`, and `docs/reference/trigger-dev.md`.
- [x] Pre-existing app features recorded in `feature_list.json` (feat-001 … feat-006).
- [x] feat-007 — Green the baseline lint gate (computed-during-render pattern; `./init.sh` exits 0).
- [x] **feat-008 — Unit testing** (completed this session):
  - Added `vitest` (devDependency, only new dep) + `vitest.config.ts` (`@` alias to repo
    root, node environment, includes `lib/**/*.test.{ts,tsx}`).
  - `lib/contract/index.test.ts` — Zod schema defaults/validation (Action, Item, Workflow,
    FieldDef), `intentToVariant` exhaustiveness, `resolveItemActions` (incl. the `??`
    semantic: an explicit empty `item.actions: []` narrows, it does not fall back),
    `bulkActions`, `singleActions` composition.
  - `lib/format.test.ts` — `fmtTime` (TZ=UTC pinned via the npm script), `fmtMoney`
    (pins `0`/`NaN` → `—`, `$Xk` rounding), `fmtRelative` (fake timers, m/h/d buckets).
  - `lib/renderField.test.tsx` — `renderCell` over all 7 field types via structural React
    element assertions (no jsdom/testing-library needed), incl. the money:0 bare-string
    `—` vs score/count:0 muted-span asymmetry; `isNumericField`; `tdClass`.
  - Harness wiring: `"test": "TZ=UTC vitest run"` in `package.json`, `npm test` appended
    to `init.sh`'s offline gate, CLAUDE.md Verification Commands updated.
  - 44 tests, 3 files, all green; full `./init.sh` exits 0.

### What's In Progress

- None.

### What's Next

1. feat-009 — integration testing (webhook route + decision dispatch over mocked DB;
   reuses the Vitest runner stood up in feat-008).
2. feat-010 — E2E testing (Playwright, separate heavier gate).
3. feat-011–013 — FastAPI testing tiers (`cd api && uv run pytest`).

## Blockers / Risks

- DB-dependent commands (`npm run build`, `npx tsx scripts/seed.ts`) require
  `DATABASE_URL` + a live Neon DB and are not exercised by `./init.sh`. Validate them
  manually when touching build/DB code.
- `zod` is a phantom dependency: `lib/contract/index.ts` imports it but it is not in
  `package.json` (resolves via better-auth's hoisted zod@4.4.3). Tests deliberately
  import only from `@/lib/contract` to avoid deepening this; consider making zod an
  explicit dependency in a future cleanup.

## Decisions Made

- **Computed-during-render** instead of `useEffect` for prop-sync state resets (feat-007).
- **Vitest with no companion deps** (feat-008): `renderCell` returns React element
  objects, so tests assert structurally on `el.type` / `el.props` in a plain node
  environment — no jsdom or @testing-library. JSX compiles out of the box because
  tsconfig has `"jsx": "react-jsx"`.
- **Determinism**: `TZ=UTC` pinned in the npm test script (fmtTime uses local-time Date
  getters); `vi.useFakeTimers()` + `vi.setSystemTime()` for `fmtRelative`/datetime.
- **Explicit vitest imports** (no `globals: true`) so the existing `npx tsc --noEmit`
  gate type-checks test files with zero tsconfig changes.
- Tests **pin** existing quirks rather than fixing them: `fmtMoney(0)` → `—`,
  empty `item.actions: []` does not fall back to workflow actions.

## Files Modified This Session

- `vitest.config.ts` — new.
- `lib/contract/index.test.ts`, `lib/format.test.ts`, `lib/renderField.test.tsx` — new test suites.
- `package.json` / `package-lock.json` — `vitest` devDependency + `test` script.
- `init.sh` — `npm test` added to the offline gate.
- `CLAUDE.md` — Verification Commands updated for the unit-test gate.
- `feature_list.json` — marked feat-008 done.
- `progress.md` — this file.

## Evidence of Completion

- [x] Unit tests green: `npm test` → 3 files, 44 tests passed
- [x] Type check clean: `npx tsc --noEmit` → exit 0 (now covers test files + vitest.config.ts)
- [x] Lint clean: `npm run lint` → 0 errors, 0 warnings
- [x] Full gate: `./init.sh` → exit 0
