# Session Progress Log

## Current State

**Last Updated:** 2026-06-16
**Active Feature:** feat-014 — DONE this session (trigger.dev scaffolding + AI SDK/OpenRouter wiring)

## feat-014 — trigger.dev scaffolding & AI SDK/OpenRouter wiring (2026-06-16)

Stood up the engine side of the already-seeded quote-desk contract.

- **Config**: `trigger.config.ts` — `project` read from `TRIGGER_PROJECT_REF` (fallback
  placeholder), `dirs: ["./trigger"]`, node runtime, default retries, `maxDuration: 300`.
- **Deps** (npm install, root package.json): `@trigger.dev/sdk@^4`, `ai@^6` (Vercel AI SDK),
  `@openrouter/ai-sdk-provider@^2`. All resolve the same hoisted `@ai-sdk/provider@3`, so the
  OpenRouter `LanguageModelV3` is assignable to `ai`'s `LanguageModel` — tsc clean.
- **Shared helpers** (`trigger/lib/`):
  - `ai.ts` — `getModel(modelId?)` lazily builds + caches the OpenRouter provider from
    `OPENROUTER_API_KEY`; default `anthropic/claude-sonnet-4-6`, swappable by id. `DEFAULT_MODEL`
    exported.
  - `data-api.ts` — `DataApiClient` / `getDataApi()` typed client for the FastAPI **hitl**
    router (NOT the Next.js webhook): `createItem` (POST, idempotent on id), `updateItem`
    (PATCH), `getItem`, `listItems`. snake_case wire shapes mirror `api/models/schemas.py`.
    Lazy singleton so importing the module doesn't throw when env is unset. `DataApiError`
    surfaces non-2xx with method/path/body.
  - `example.ts` — `quote-desk-health` scaffold task exercising both helpers; feat-015/017
    replace it.
- **Env scaffolding** (`.env.example`): TRIGGER_PROJECT_REF / TRIGGER_SECRET_KEY /
  TRIGGER_ACCESS_TOKEN, OPENROUTER_API_KEY, DATA_API_BASE_URL (+ optional DATA_API_TOKEN).
  `.trigger` build cache added to `.gitignore`.
- **Docs**: `quote-desk-setup.md` status checklist + sections 1–3 updated (what's scaffolded
  vs. remaining manual cloud setup); `CLAUDE.md` Verification Commands note
  `npx trigger.dev@latest dev`/`deploy` need creds and are NOT in the offline `./init.sh` gate.
- **Verification**: `npx tsc --noEmit` clean; offline gate green (lint + 44 unit + 25
  integration). trigger dev/deploy not runnable here (no creds) — out of the offline gate by design.

---

### Prior session (roadmap planning)

## Roadmap update (2026-06-16)

Added the quote-desk *engine* features to `feature_list.json` (the contract/UI side is
already seeded in `lib/contract/seed.ts`; what's missing is the trigger.dev + FastAPI
plumbing that feeds it). Split into four, per user direction:

- **feat-014** — trigger.dev scaffolding + AI SDK/OpenRouter wiring (foundation).
- **feat-015** — Gmail RFQ intake (users.watch → Pub/Sub → HTTP-trigger) + LLM structured
  extraction via AI SDK `generateObject` + Zod over OpenRouter.
- **feat-016** — FastAPI RateInsights endpoint mocking Truckstop.com from lanes +
  rate_snapshots (independent of the trigger.dev work).
- **feat-017** — draft generation, write workflow_item via the FastAPI hitl router, and
  send the quote on approval (wires into feat-006 outbound dispatch + Gmail send).

Created `docs/clients/halberd-co/workflows/quote-desk-setup.md` as the living infra/
third-party setup doc; each feature appends what it needs as it's built. Decisions: real-time
Gmail-push intake (not polling), LLM via OpenRouter AI SDK provider (default Claude,
swappable), draft **and** send-on-approval in scope.

## Status

### What's Done

- [x] Harness scaffolded: `CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`.
- [x] `CLAUDE.md` deep content migrated to `docs/ARCHITECTURE.md`, `docs/API.md`,
      `docs/DESIGN.md`, and `docs/reference/trigger-dev.md`.
- [x] Pre-existing app features recorded in `feature_list.json` (feat-001 … feat-006).
- [x] feat-007 — Green the baseline lint gate (computed-during-render pattern; `./init.sh` exits 0).
- [x] feat-008 — Unit testing (Vitest, 44 tests in `lib/**`; `npm test` in the offline gate).
- [x] **feat-009 — Integration testing** (completed this session):
  - **In-memory Postgres**: added `@electric-sql/pglite` (devDependency, only new dep) and
    run real Drizzle queries via `drizzle-orm/pglite`; schema applied with `pushSchema`
    from `drizzle-kit/api` (note the `{ apply }` two-step). `tests/integration/helpers.ts`
    exposes `createTestDb()` + fixture builders (`makeWorkflow`/`makeItem`/`makeAction`/
    `seedUser` — jsonb notNull columns and the `decidedBy`→`user` FK are handled there).
  - **DB seam**: `vi.mock('@/db')` with a `vi.hoisted` holder + Proxy mirroring the
    production lazy-Proxy in `db/index.ts`; `getDb()`/`DATABASE_URL` never reached.
  - `tests/integration/inbound-route.test.ts` (9 tests) — POST route: 401 unknown
    workflow / wrong secret / null `webhookSecret`; 422 invalid JSON + zod issues;
    200 minimal-payload defaults and full-payload persistence; idempotent upsert pins
    that re-POSTs update summary/fields/source/proposed/context/updatedAt but **not**
    status/priority/createdAt; 429 after 100 requests with rate-check-before-DB and
    per-workflowId budget isolation. Invariant: unique workflowId per test (module-level
    rate Map lives for the suite).
  - `tests/integration/decisions.test.ts` (16 tests) — `recordDecision`/`recordDecisions`
    with `next/cache`, `next/headers`, `@/lib/auth` mocked and `fetch` stubbed:
    string-handler direct settle; webhook dispatch happy path incl. HMAC-SHA256
    recomputation over the raw body, `x-idempotency-key`, no-secret → no signature
    header, custom method; failure paths (non-ok, network error, SSRF blocks) leave
    items `dispatching`; SSRF suffix-spoof (`evil.example.com.attacker.com`) blocked vs
    real subdomain allowed; bulk never dispatches; empty-ids early return.
  - Harness wiring: `"test:integration": "TZ=UTC vitest run --config
    vitest.integration.config.ts"` in `package.json`, step appended to `init.sh`,
    CLAUDE.md Verification Commands updated (offline gate now includes it).
  - 25 tests, 2 files, all green; full `./init.sh` exits 0 (44 unit + 25 integration).

### What's In Progress

- None.

### What's Next

1. feat-010 — E2E testing (Playwright, separate heavier gate; needs running app + seeded DB).
2. feat-011–013 — FastAPI testing tiers (`cd api && uv run pytest`).

## Blockers / Risks

- DB-dependent commands (`npm run build`, `npx tsx scripts/seed.ts`) require
  `DATABASE_URL` + a live Neon DB and are not exercised by `./init.sh`. Validate them
  manually when touching build/DB code.
- `zod` is a phantom dependency: `lib/contract/index.ts` imports it but it is not in
  `package.json` (resolves via better-auth's hoisted zod@4.4.3). Tests deliberately
  import only from `@/lib/contract` to avoid deepening this; consider making zod an
  explicit dependency in a future cleanup.
- Integration suites boot one PGlite per test file (~3-5s each incl. WASM + pushSchema);
  timeouts are set to 30s in `vitest.integration.config.ts`. If suites multiply, consider
  a shared globalSetup.

## Decisions Made

- **Computed-during-render** instead of `useEffect` for prop-sync state resets (feat-007).
- **Vitest with no companion deps** (feat-008): structural React element assertions, no jsdom.
- **PGlite over a hand-rolled Drizzle mock** (feat-009, confirmed with user): real SQL
  executes, so idempotent upsert/FKs/defaults are genuinely verified while staying offline.
  Schema comes from `db/schema.ts` itself via `drizzle-kit/api` `pushSchema` — no drift.
- **Separate vitest config** for integration (`vitest.integration.config.ts`) so `npm test`
  stays unit-only and unit-test speed is unaffected.
- **Rate-limiter isolation by unique workflowId** per test rather than `vi.resetModules`
  or fake timers (60s window can't roll during a ms-scale suite).
- Tests **pin** existing behavior: upsert preserves status/priority/createdAt (settle
  semantics), dispatch failures leave items `dispatching` for engine retry, bulk decisions
  never fire webhooks, empty `ALLOWED_WEBHOOK_DOMAINS` blocks all outbound dispatch.

## Files Modified This Session

- `tests/integration/helpers.ts`, `tests/integration/inbound-route.test.ts`,
  `tests/integration/decisions.test.ts` — new integration suites.
- `vitest.integration.config.ts` — new.
- `package.json` / `package-lock.json` — `@electric-sql/pglite` devDependency +
  `test:integration` script.
- `init.sh` — `npm run test:integration` added to the offline gate.
- `CLAUDE.md` — Verification Commands updated for the integration-test gate.
- `feature_list.json` — marked feat-009 done.
- `progress.md` — this file.

## Evidence of Completion

- [x] Integration tests green: `npm run test:integration` → 2 files, 25 tests passed
- [x] Unit tests still green and unit-only: `npm test` → 3 files, 44 tests passed
- [x] Type check clean: `npx tsc --noEmit` → exit 0 (covers tests/ + new config)
- [x] Lint clean: `npm run lint` → 0 errors, 0 warnings
- [x] Full gate: `./init.sh` → exit 0
