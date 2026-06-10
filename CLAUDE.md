# CLAUDE.md

Harness entry point for agent-assisted development in this repo. Keep this file short:
routing and invariants, not a full manual. Deep detail lives in `docs/`.

## What this is

A Next.js 16 (App Router) human-in-the-loop (HITL) workflow review console. The UI is a
generic shell that renders any workflow by reading a **contract** — no per-workflow UI
code. Workflows and items are stored in Neon Postgres (Drizzle ORM). External engines
(trigger.dev, LangGraph, etc.) connect over webhooks.

```bash
npm run dev              # dev server → http://localhost:3000
npm run build            # production build (needs DATABASE_URL)
npm run start            # serve the production build
npx tsc --noEmit         # type check only
npx tsx lib/contract/seed.ts  # run contract validation assertions
npx tsx scripts/seed.ts  # seed everything (needs DATABASE_URL + Neon)
```

Vercel deployment: push to `main` and Vercel picks up automatically.

## Startup Workflow

Before writing code:

1. **Confirm working directory** with `pwd`.
2. **Read this file** completely.
3. **Read the relevant `docs/`** for your task (see Project Map below).
4. **Run `./init.sh`** to verify the environment is healthy.
5. **Read `feature_list.json`** to see current feature state and pick the active one.
6. **Review recent commits** with `git log --oneline -5`.

If baseline verification (`./init.sh`) is failing, repair that first before adding scope.

## Working Rules

- **One feature at a time**: pick exactly one unfinished feature from `feature_list.json`.
- **Verification required**: don't claim done without running the verification commands.
- **Update artifacts**: before ending a session, update `progress.md` and `feature_list.json`.
- **Stay in scope**: don't modify files unrelated to the active feature.
- **Leave clean state**: the next session must be able to run `./init.sh` immediately.

## Definition of Done

A feature is done only when ALL of these are true:

- [ ] Target behavior is implemented.
- [ ] `./init.sh` passes (type check + lint).
- [ ] Evidence recorded in `feature_list.json` (`evidence` field) or `progress.md`.
- [ ] Repository remains restartable from the standard startup path.

## Project Map

| Topic | Where |
|---|---|
| App structure, routing, **contract system**, DB schema, adding a workflow | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Inbound/outbound webhook integration | [`docs/API.md`](docs/API.md) |
| Design tokens, components, keyboard affordances | [`docs/DESIGN.md`](docs/DESIGN.md) |
| Trigger.dev task patterns (vendor reference) | [`docs/reference/trigger-dev.md`](docs/reference/trigger-dev.md) |
| Better Auth / Trigger.dev how-tos | `.claude/skills/` (installed skills) |

## Invariants (do not violate)

- **Contract is the single source of truth.** `lib/contract/index.ts` describes every
  workflow. Add a workflow by seeding rows (`lib/contract/seed.ts` + `scripts/seed.ts`),
  **never** by editing UI code. The nav, dashboard, and config render from the contract.
- **All styling lives in `app/globals.css`.** Do not add styles elsewhere.
- **Webhooks are authenticated.** Per-workflow HMAC on inbound; outbound dispatch is
  validated against a per-workflow SSRF allowlist — no dispatch to an unregistered host.
- **Hotkeys must be unique** within a workflow's `availableActions`.

## Verification Commands

```bash
./init.sh                # full gate: npm install + npx tsc --noEmit + npm run lint + npm test
```

- `npx tsc --noEmit`, `npm run lint`, and `npm test` are **offline** and form the fast gate.
- `npm run build` and `npx tsx scripts/seed.ts` require `DATABASE_URL` + a live Neon DB
  and are **not** part of the fast gate — run them only when explicitly working on
  build/DB concerns.
- **Unit tests** (feat-008) run via Vitest: `npm test` (= `TZ=UTC vitest run`,
  config in `vitest.config.ts`, files colocated as `lib/**/*.test.{ts,tsx}`). Offline,
  no DB — part of the `./init.sh` gate.
- **Integration tests** (feat-009) join the offline gate when implemented (add their
  script to `init.sh` and list it here); E2E (feat-010, `npm run test:e2e`, needs a
  running app + seeded DB) is documented here as a separate heavier gate.
- **FastAPI service tests** (`api/`, feat-011 unit, feat-012 integration, feat-013
  migration/schema parity) are a separate Python sub-project — run with
  `cd api && uv run pytest`. They are NOT part of the npm root gate; integration + parity
  additionally need a test Postgres. Document them here as their own gate when added.

## State & Lifecycle Artifacts

- `feature_list.json` — feature state tracker (source of truth for what's done / active).
- `progress.md` — session continuity log; update at the end of every session.
- `session-handoff.md` — optional, for larger multi-session work.
- `init.sh` — standard startup + verification path.

## End of Session

1. Update `progress.md` with current state and verification evidence.
2. Update `feature_list.json` status/evidence for the feature you touched.
3. Record any unresolved blockers or risks.
4. Commit with a descriptive message once work is in a safe state.
5. Leave the repo clean enough for the next session to run `./init.sh` immediately.
