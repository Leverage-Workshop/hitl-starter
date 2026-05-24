# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A zero-dependency, no-build human-in-the-loop (HITL) workflow review console. React 18 and Babel run entirely in-browser via CDN — there is no npm, no bundler, no build step, and no node_modules.

## Running the app

Open `index.html` directly in a browser, or serve the directory with any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

There are no tests, no lint commands, and no CI. The browser console is the development environment.

**Browser console shortcut:** `go('dashboard')`, `go('config')`, `go('settings')` — a tiny imperative nav API wired in `App.jsx` for bypassing the login page during development.

## Architecture

### Script loading order matters

`index.html` loads scripts in strict dependency order — there is no module system:

1. `data.js` — plain JS, sets globals on `window`
2. `components.jsx` — shared primitives (`Nav`, `Topbar`, `Button`, `StatusCell`, `PrioCell`, `Score`, format utils)
3. `pages/Flyout.jsx` — `DetailFlyout`, `FlyoutTwoPane`
4. `pages/Dashboard.jsx` — `Dashboard`
5. `pages/Login.jsx`, `pages/Config.jsx`, `pages/Settings.jsx`
6. `App.jsx` — root, mounts to `#root`

Each file ends with `Object.assign(window, { ... })` to export its symbols. Any new file must follow this pattern and be added to `index.html` in the correct position.

### Global state model

`App.jsx` owns `page` (routing) and `workflowId`. `Dashboard` owns `items` (local copy of `ITEMS`), `view` (`table`|`cards`), `selected` (Set of ids), `openId`, and `query`. There is no external state library.

### The primary extension point: `data.js`

Forking this starter means editing `data.js` — nothing else needs to change for a new workflow:

| Symbol | Purpose |
|---|---|
| `CLIENT` | White-label identity (name shown in the nav header) |
| `WORKFLOWS` | Left-nav list with pending counts and status dots |
| `ACTIVE_WORKFLOW_ID` | Which workflow is selected on load |
| `ITEMS` | The review queue — shape documented inline in `data.js` |
| `ACTION_SET` | Decision buttons rendered in the flyout action bar |
| `STATS` | Header stat tiles (overridden live by `Dashboard` for pending/approved counts) |

### Flyout extension points

`DetailFlyout` in `pages/Flyout.jsx` has two configurable slots called out in comments:
- **Body slot** (line ~44): defaults to `FlyoutTwoPane` (source vs. AI draft, side-by-side). Replace with a single-pane renderer for workflows without a comparison axis.
- **Action bar slot** (line ~49): driven entirely by `ACTION_SET` from `data.js`. Swap that array to change decisions.

### Item data shape

Each `ITEMS` entry carries: `id`, `status` (`pending|approved|rejected|escalated`), `priority` (`high|normal|flagged`), `submitted` (ISO timestamp), `subject`, `from`, `value`, `score` (0–100 confidence), `attachments`, `summary` (card one-liner), `source` (left flyout pane), `draft` (right flyout pane), `notes` (marginalia array `{tag, ts, body}`).

## Design system

Styling comes from two CSS files — do not add styles outside them:
- `assets/colors_and_type.css` — design tokens (CSS variables for color, typography, spacing)
- `app.css` — layout and component classes

Button variants: `brass` (primary action), `ghost` (default), `danger`. Applied via the `Button` primitive.

## Keyboard affordances

Wired in `Dashboard.jsx` — `Escape` closes the flyout; hotkeys from `ACTION_SET[n].hotkey` fire the corresponding action on the open item. Input/textarea elements are excluded from hotkey handling.
