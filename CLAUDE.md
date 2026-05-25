# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js 16 (App Router) human-in-the-loop (HITL) workflow review console with TypeScript and Tailwind CSS (utility layer only — Preflight disabled to preserve the existing design system).

## Running the app

```bash
npm run dev        # dev server → http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npx tsc --noEmit   # type check only
```

Vercel deployment: push to `main` and Vercel picks up automatically (project must be linked to the repo in the Vercel dashboard).

## Architecture

### File tree

```
app/
  layout.tsx          ← root layout, imports globals.css
  globals.css         ← design tokens + component classes + Tailwind utilities
  page.tsx            ← Login (/)
  dashboard/page.tsx  ← Dashboard (/dashboard?workflow=<id>)
  config/page.tsx     ← Config (/config?workflow=<id>)
  settings/page.tsx   ← Settings (/settings)
components/
  ui/
    Nav.tsx           ← left rail nav
    Topbar.tsx        ← top bar with breadcrumbs
    Button.tsx        ← brass / ghost / danger variants
    StatusCell.tsx
    PrioCell.tsx
    Score.tsx
    BracketMark.tsx   ← bracket logo mark SVG
  Flyout.tsx          ← DetailFlyout + FlyoutTwoPane
lib/
  data.ts             ← THE extension point: CLIENT, WORKFLOWS, ITEMS, ACTION_SET, STATS
  types.ts            ← TypeScript interfaces
  format.ts           ← fmtTime, fmtMoney, fmtRelative
middleware.ts → proxy.ts  ← Next.js 16 auth guard (cookie-based)
public/
  logo-horizontal-lockup.svg
  logo-primary.svg
```

### Routing

File-system routing via Next.js App Router. `/dashboard?workflow=<id>` — the active workflow is a query param read via `useSearchParams()` inside a Suspense boundary.

Auth guard: `proxy.ts` redirects unauthenticated requests to `/dashboard`, `/config`, `/settings` back to `/`. Login sets `hitl_authed=true` cookie; sign-out clears it.

### The primary extension point: `lib/data.ts`

Forking this starter means editing `lib/data.ts` — nothing else needs to change for a new workflow:

| Export | Purpose |
|---|---|
| `CLIENT` | White-label identity (name shown in the nav header) |
| `WORKFLOWS` | Left-nav list with pending counts and status dots |
| `ACTIVE_WORKFLOW_ID` | Which workflow is selected on load |
| `ITEMS` | The review queue — shape defined in `lib/types.ts` |
| `ACTION_SET` | Decision buttons rendered in the flyout action bar |
| `STATS` | Header stat tiles (overridden live by Dashboard for pending/approved counts) |

### Flyout extension points

`DetailFlyout` in `components/Flyout.tsx` has two configurable slots (marked with comments):
- **Body slot**: defaults to `FlyoutTwoPane` (source vs. AI draft, side-by-side). Replace with a single-pane renderer for workflows without a comparison axis.
- **Action bar slot**: driven entirely by `ACTION_SET` from `lib/data.ts`. Swap that array to change decisions.

### Item data shape

Each `ITEMS` entry carries: `id`, `status` (`pending|approved|rejected|escalated`), `priority` (`high|normal|flagged`), `submitted` (ISO timestamp), `subject`, `from`, `value`, `score` (0–100 confidence), `attachments`, `summary` (card one-liner), `source` (left flyout pane), `draft` (right flyout pane), `notes` (marginalia array `{tag, ts, body}`).

## Design system

All styling lives in `app/globals.css`. **Do not add styles outside it.**

Structure:
1. Design tokens — CSS custom properties (`--bg`, `--fg`, `--c-brass`, etc.)
2. Component classes — `.btn`, `.nav`, `.topbar`, `.page`, `.flyout`, etc.
3. `@import "tailwindcss/utilities"` — Tailwind utilities only (no Preflight reset)

Button variants: `brass` (primary action), `ghost` (default), `danger`. Applied via the `Button` primitive in `components/ui/Button.tsx`.

## Keyboard affordances

Wired in `app/dashboard/page.tsx` — `Escape` closes the flyout; hotkeys from `ACTION_SET[n].hotkey` fire the corresponding action on the open item. Input/textarea elements are excluded from hotkey handling.
