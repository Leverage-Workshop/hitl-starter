# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js 16 (App Router) human-in-the-loop (HITL) workflow review console. The UI is a generic shell that renders any workflow by reading a contract — no per-workflow UI code. Workflows and items are stored in Neon Postgres (Drizzle ORM). External engines (trigger.dev, LangGraph, etc.) connect over webhooks.

## Running the app

```bash
npm run dev              # dev server → http://localhost:3000
npm run build            # production build
npm run start            # serve the production build
npx tsc --noEmit         # type check only
npx tsx lib/contract/seed.ts  # run contract validation assertions
npx tsx scripts/seed.ts  # seed everything: admin user + domain tables + workflows/items
```

Vercel deployment: push to `main` and Vercel picks up automatically.

## Architecture

### File tree

```
app/
  layout.tsx                     ← root layout, imports globals.css
  globals.css                    ← design tokens + component classes + Tailwind utilities
  page.tsx                       ← Login (/)
  dashboard/
    page.tsx                     ← server component — loads workflow + items from DB
    DashboardClient.tsx          ← client component — queue table/cards, flyout, hotkeys
  config/
    page.tsx                     ← server component — loads workflow from DB
    ConfigClient.tsx             ← client component — workflow config display
  settings/
    page.tsx                     ← server component (dynamic)
    SettingsClient.tsx           ← client component — user settings
  actions/
    decisions.ts                 ← server actions — persist item decisions
  api/
    auth/[...all]/route.ts       ← Better Auth catch-all
    workflows/[id]/items/route.ts ← inbound webhook ingestion endpoint (POST)
components/
  ui/
    Nav.tsx           ← left rail nav (driven by workflow list from DB)
    Topbar.tsx        ← top bar with breadcrumbs
    Button.tsx        ← brass / ghost / danger variants
    StatusCell.tsx
    PrioCell.tsx
    Score.tsx
    BracketMark.tsx   ← bracket logo mark SVG
  Flyout.tsx          ← DetailFlyout — two-pane body + action bar, all from contract
lib/
  contract/
    index.ts          ← Zod schemas: WorkflowSchema, ItemSchema, ActionSchema + helpers
    seed.ts           ← contract-valid seed data; run directly to validate
  workflows/
    queries.ts        ← server query layer: getWorkflowList(), getWorkflow(id)
  renderField.tsx     ← field-renderer registry: renderCell(fieldDef, value)
  format.ts           ← fmtTime, fmtMoney, fmtRelative
  auth.ts             ← Better Auth server instance
  auth-client.ts      ← Better Auth client
  data.ts             ← legacy stub (CLIENT constant only)
  types.ts            ← legacy types (superseded by lib/contract/index.ts)
db/
  schema.ts           ← Drizzle schema: Better Auth tables + workflows + workflow_items
  index.ts            ← lazy getDb() singleton (neon + drizzle)
scripts/
  seed.ts             ← unified seed: admin user + domain tables (api/db/seed.sql) + workflows/items
middleware.ts → proxy.ts  ← Next.js 16 auth guard (cookie-based)
```

### Routing

File-system routing via Next.js App Router. `/dashboard?workflow=<id>` — the active workflow is a query param; the server component reads it and fetches from the DB.

Auth guard: `proxy.ts` redirects unauthenticated requests to `/`, `/dashboard`, `/config`, `/settings`. Login sets `hitl_authed=true` cookie; Better Auth handles the session.

---

## The contract system

The contract (`lib/contract/index.ts`) is the **single source of truth** for how every workflow is described and operated. Adding a workflow means inserting rows — never editing UI code.

### Three objects

#### `Workflow`

Describes a workflow and how the UI should render it:

| Field | Purpose |
|---|---|
| `id`, `name`, `description` | Identity |
| `status` | `running \| paused \| error \| idle` — drives the nav status dot |
| `itemSchema` | Array of `FieldDef` — which fields items carry and how to render them |
| `availableActions` | Array of `Action` — the decision buttons in the flyout and bulk bar |
| `stats` | Header stat tiles |
| `steps` | Progress pipeline shown in the config page |
| `sources` | Data sources the workflow ingests from |
| `defaultView` | `table \| cards` |
| `confidenceFloor` | 0–1 threshold; items below are flagged for review |

#### `Item`

One review queue entry:

| Field | Purpose |
|---|---|
| `id`, `status`, `priority`, `createdAt`, `summary` | Universal spine — always rendered |
| `fields` | `Record<string, unknown>` — workflow-specific data, keyed by `FieldDef.key` |
| `sourceContent` | Left flyout pane (the raw input) |
| `proposedOutput` | Right flyout pane (the AI draft) |
| `context` | Marginalia notes array (`ref`, `body`, `createdAt`) |
| `actions` | Optional per-item action override (narrows the workflow's full set) |

#### `Action`

One decision button:

| Field | Purpose |
|---|---|
| `id`, `label` | Identity |
| `intent` | `primary \| neutral \| destructive` — maps to `brass / ghost / danger` button variant |
| `appliesTo` | `single \| bulk \| both` — controls where the button appears |
| `resultingStatus` | The `ItemStatus` this action produces (omit for non-lifecycle actions like edit/reassign) |
| `hotkey` | Single uppercase letter wired to the dashboard keydown handler |
| `confirm` | Whether to show a confirmation prompt |
| `handler` | Plain string key (no-op) or `{ url, method? }` for outbound webhook dispatch |

### Field types

`FieldType` is a **render hint**, not a data type. It tells `renderField.tsx` which formatter or component to use:

| Type | Renderer |
|---|---|
| `text` | Plain string |
| `money` | `fmtMoney` (e.g. `$184,000`) |
| `score` | `<Score>` component (0–100 confidence band) |
| `email` | Styled address |
| `count` | Integer badge (e.g. `6 attachments`) |
| `datetime` | `fmtRelative` / `fmtTime` |
| `badge` | Pill badge |

### Helpers

```ts
resolveItemActions(workflow, item)  // item.actions ?? workflow.availableActions
bulkActions(workflow)               // appliesTo === "bulk" | "both"
singleActions(workflow, item)       // appliesTo === "single" | "both"
intentToVariant                     // { primary: "brass", neutral: "ghost", destructive: "danger" }
```

### Status and priority enums

```ts
ItemStatus:  pending | approved | rejected | escalated | skipped | dispatching
Priority:    high | normal | flagged    // "flagged" lives on priority only, not status
WorkflowStatus: running | paused | error | idle
```

`dispatching` is a transitional state: decision is persisted immediately so the UI responds, then the outbound webhook fires asynchronously.

---

## Database schema

Two workflow tables alongside the Better Auth tables:

### `workflows`

Stores workflow config. The jsonb columns (`item_schema`, `available_actions`, `stats`, `steps`, `sources`) are typed via Drizzle's `$type<>()` using the contract types.

### `workflow_items`

One row per review item. The `fields` jsonb column holds the workflow-specific field values keyed by `FieldDef.key`. `decided_by` is an FK to the Better Auth `user` table.

---

## Webhook integration

The app is both a webhook **consumer** (inbound) and a webhook **producer** (outbound).

### Inbound — item ingestion

`POST /api/workflows/[id]/items`

External engines call this to enqueue items for review and to settle items after acting on a decision. The payload is validated against `ItemSchema` (Zod). Authentication is per-workflow HMAC (secret stored in the `workflows` table as `webhook_secret`). Idempotent on `item.id`.

### Outbound — decision dispatch

When a reviewer fires an action whose `handler` is `{ url, method? }`:

1. The server action immediately persists the decision with `status = "dispatching"` and returns — the UI responds instantly.
2. An outbound POST is dispatched to the handler URL, HMAC-signed with the workflow's webhook secret.
3. The receiving engine acts on the decision and calls the inbound endpoint to settle the item to its final status.

Security: outbound URLs are validated against a per-workflow SSRF allowlist stored in the DB. No outbound dispatch fires to an unregistered host.

---

## Adding a new workflow

1. Define it in `lib/contract/seed.ts` as a `WorkflowSchema.parse({...})` object.
2. Run `npx tsx scripts/seed.ts` to insert it into the DB.
3. The nav, dashboard, and config page render it automatically.

No UI code changes needed.

---

## Design system

All styling lives in `app/globals.css`. **Do not add styles outside it.**

Structure:
1. Design tokens — CSS custom properties (`--bg`, `--fg`, `--c-brass`, etc.)
2. Component classes — `.btn`, `.nav`, `.topbar`, `.page`, `.flyout`, etc.
3. `@import "tailwindcss/utilities"` — Tailwind utilities only (no Preflight reset)

Button variants: `brass` (primary action), `ghost` (default), `danger`. Applied via `components/ui/Button.tsx`.

## Keyboard affordances

`Escape` closes the flyout. Hotkeys from `Action.hotkey` fire the corresponding action on the open item. Input/textarea elements are excluded from hotkey handling. Hotkeys must be unique within a workflow's `availableActions`.
