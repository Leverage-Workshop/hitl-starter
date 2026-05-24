# LEV-11 — Convert to Next.js 15 Web App

## Overview

Migrate the CDN-Babel React starter to a production-grade **Next.js 15** (App Router) application
with **TypeScript** and **Tailwind CSS** (utility layer only), targeting **Vercel** deployment via
the existing GitHub repo. All visual UI, design tokens, and component class names are preserved
exactly — only the infrastructure layer changes.

---

## Constraints

- Existing appearance must not change — Tailwind Preflight (CSS reset) is **disabled**
- No Tailwind conversion of existing component classes — they carry over as-is
- No backend / API routes — data remains static in `lib/data.ts`
- No real auth backend — cookie-based login guard matches current behavior
- Vercel project linking and GitHub integration handled by the user after merge

---

## Phase 1 — Scaffold Next.js 15 Project

Replace `index.html` + CDN-Babel approach with a proper `create-next-app` scaffold in-place.

```bash
npx create-next-app@latest . \
  --typescript \
  --app \
  --tailwind \
  --no-src-dir \
  --import-alias "@/*"
```

### `tailwind.config.ts` — disable Preflight, wire design tokens

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false, // preserve existing CSS baseline — no resets
  },
  theme: {
    extend: {
      colors: {
        // mapped from CSS custom properties in globals.css
        brand:   'var(--color-brand)',
        surface: 'var(--color-surface)',
        border:  'var(--color-border)',
        muted:   'var(--color-muted)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
    },
  },
  plugins: [],
}

export default config
```

### `globals.css` structure

```css
/* 1. Design tokens — from assets/colors_and_type.css (unchanged) */
/* 2. Component classes — from app.css (unchanged) */

/* 3. Tailwind utilities — NO @tailwind base (Preflight disabled) */
@tailwind components;
@tailwind utilities;
```

### `next.config.ts` — minimal

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {}

export default config
```

---

## Phase 2 — Port the Data Layer

Convert `data.js` (global `window` exports) → `lib/data.ts` (ES module with TypeScript types).

### `lib/types.ts`

```ts
export type ItemStatus   = 'pending' | 'approved' | 'rejected' | 'escalated'
export type ItemPriority = 'high' | 'normal' | 'flagged'

export interface WorkflowItem {
  id: string
  status: ItemStatus
  priority: ItemPriority
  submitted: string        // ISO timestamp
  subject: string
  from: string
  value: string
  score: number            // 0–100 confidence
  attachments: number
  summary: string
  source: string
  draft: string
  notes: Array<{ tag: string; ts: string; body: string }>
}

export interface Workflow {
  id: string
  name: string
  pending: number
  status: string
}

export interface ActionItem {
  label: string
  variant: 'brass' | 'ghost' | 'danger'
  hotkey?: string
}

export interface Stat {
  label: string
  value: number | string
}
```

### `lib/data.ts`

All `ITEMS`, `WORKFLOWS`, `ACTION_SET`, `STATS`, `CLIENT`, `ACTIVE_WORKFLOW_ID` become
named exports. Remove all `window` assignments.

---

## Phase 3 — Port Shared Components

Convert `components.jsx` → `components/ui/` directory, one file per primitive.

| Old (window export) | New file | Notes |
|---|---|---|
| `Nav` | `components/ui/Nav.tsx` | |
| `Topbar` | `components/ui/Topbar.tsx` | |
| `Button` | `components/ui/Button.tsx` | variants: `brass`, `ghost`, `danger` |
| `StatusCell` | `components/ui/StatusCell.tsx` | |
| `PrioCell` | `components/ui/PrioCell.tsx` | |
| `Score` | `components/ui/Score.tsx` | |
| format utils | `lib/format.ts` | `formatDate`, `formatValue`, etc. |

All files: remove Babel pragma comments, replace `Object.assign(window, {...})` with `export`.
Mark any component using hooks with `'use client'`.

---

## Phase 4 — Port Flyout

`pages/Flyout.jsx` → `components/Flyout.tsx`

- `DetailFlyout` and `FlyoutTwoPane` are client components rendered within the Dashboard page
- **Body slot** and **Action bar slot** remain configurable via props (same extension points)
- `ACTION_SET` from `lib/data.ts` drives the action bar — no change to behavior

---

## Phase 5 — Port Pages to App Router

File-system routing replaces the manual `page` state variable in `App.jsx`.

| Old (`page` state) | New route | File |
|---|---|---|
| `'login'` | `/` | `app/page.tsx` |
| `'dashboard'` | `/dashboard` | `app/dashboard/page.tsx` |
| `'config'` | `/config` | `app/config/page.tsx` |
| `'settings'` | `/settings` | `app/settings/page.tsx` |

### `workflowId` → query param

`/dashboard?workflow=<id>` — read via `useSearchParams()` inside a client component.

### Navigation

Replace the `go()` dev shortcut and manual `setPage()` calls with `useRouter()` + `<Link>`.

### Login guard — `middleware.ts`

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/config', '/settings']

export function middleware(request: NextRequest) {
  const authed = request.cookies.get('hitl_authed')?.value === 'true'
  const isProtected = PROTECTED.some(p => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !authed) {
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/config/:path*', '/settings/:path*'],
}
```

On login form submit: set cookie via `document.cookie`, then `router.push('/dashboard')`.

### Root layout — `app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HITL Review Console',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

No `Nav` or `Topbar` in the root layout — login has no nav; dashboard/config/settings each
render their own shell via shared components.

---

## Phase 6 — Port Assets

| Old path | New path | Notes |
|---|---|---|
| `assets/logo-favicon.svg` | `app/favicon.ico` | Convert SVG → ICO, or use `app/icon.svg` (Next.js 15 supports SVG favicons) |
| `assets/logo-horizontal-lockup.svg` | `public/logo-horizontal-lockup.svg` | |
| `assets/logo-primary.svg` | `public/logo-primary.svg` | |

Reference in components: `<img src="/logo-primary.svg" alt="Logo" />` (served from `public/`).

---

## Phase 7 — Cleanup

Files to delete after migration:
- `index.html`
- `App.jsx`
- `components.jsx`
- `pages/Dashboard.jsx`
- `pages/Flyout.jsx`
- `pages/Login.jsx`
- `pages/Config.jsx`
- `pages/Settings.jsx`
- `app.css` (merged into `globals.css`)
- `assets/colors_and_type.css` (merged into `globals.css`)

### Update `CLAUDE.md`

- Dev server: `npm run dev` → `http://localhost:3000`
- Build: `npm run build`
- Type check: `npx tsc --noEmit`
- Deploy: push to `main` → Vercel picks up automatically

---

## File Tree (post-migration)

```
hitl-starter/
├── app/
│   ├── layout.tsx
│   ├── globals.css          ← design tokens + component classes + Tailwind utilities
│   ├── page.tsx             ← Login
│   ├── dashboard/
│   │   └── page.tsx
│   ├── config/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
├── components/
│   ├── ui/
│   │   ├── Nav.tsx
│   │   ├── Topbar.tsx
│   │   ├── Button.tsx
│   │   ├── StatusCell.tsx
│   │   ├── PrioCell.tsx
│   │   └── Score.tsx
│   └── Flyout.tsx
├── lib/
│   ├── data.ts
│   ├── types.ts
│   └── format.ts
├── middleware.ts
├── public/
│   ├── logo-horizontal-lockup.svg
│   └── logo-primary.svg
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── CLAUDE.md
```

---

## Acceptance Criteria

- [ ] `npm run dev` serves the app at `localhost:3000` with identical appearance to the original
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] All four routes render the correct pages (`/`, `/dashboard`, `/config`, `/settings`)
- [ ] Unauthenticated requests to protected routes redirect to `/`
- [ ] Flyout opens/closes; keyboard hotkeys fire correct actions
- [ ] Vercel preview deployment passes (triggered by PR to `main`)
- [ ] No Tailwind utility classes on any existing component (Tailwind is additive only)
