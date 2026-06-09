# Design system

All styling lives in `app/globals.css`. **Do not add styles outside it.**

Structure:
1. Design tokens — CSS custom properties (`--bg`, `--fg`, `--c-brass`, etc.)
2. Component classes — `.btn`, `.nav`, `.topbar`, `.page`, `.flyout`, etc.
3. `@import "tailwindcss/utilities"` — Tailwind utilities only (no Preflight reset)

Button variants: `brass` (primary action), `ghost` (default), `danger`. Applied via
`components/ui/Button.tsx`.

## Keyboard affordances

`Escape` closes the flyout. Hotkeys from `Action.hotkey` fire the corresponding action on
the open item. Input/textarea elements are excluded from hotkey handling. Hotkeys must be
unique within a workflow's `availableActions`.
