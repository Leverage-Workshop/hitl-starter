Build a starter template for a human-in-the-loop (HITL) workflow dashboard, using the attached Field Studio — Leverage Workshop design system (README.md, SKILL.md, and the styled UI controls) as the single source of truth for all visual styling, components, color, and typography. Apply the design system's own tokens and components throughout — do not introduce styling outside it.

This is a generic, reusable skeleton I will fork for specific workflows later, so favor clear structure and obvious extension points over hardcoded specifics. Seed it with one realistic example workflow (an "rfp-intake" review queue) so the layout renders with real content, but keep the architecture generic.

## Reference screenshots — STRUCTURE ONLY, not style

I've attached screenshots of two things:
- A dashboard/console UI from a DIFFERENT, older design system. Use it ONLY as a reference for information architecture and density: persistent left nav listing workflows with count badges, a main panel with stat tiles and a dense status-coded table, mono numerics, tight vertical rhythm. Do NOT copy its colors, typography, or visual styling — those belong to the old system. Render all of this in the Leverage Workshop design system instead.
- Screenshots of a job board (hiring.cafe) showing an item-to-detail interaction: clicking an item opens a detail panel from the right with the full record and its actions. Use this ONLY as a reference for that click-to-flyout interaction pattern. Ignore its styling entirely.

In short: borrow the bones from these screenshots, render the skin from the Leverage Workshop design system.

## The core concept

The primary object is a "review item" — a single thing flagged for a human decision. The queue of these items is the heart of the app. The starter must support two genuinely different work modes via a view toggle, because future workflows will need one or the other:
- A **dense table mode** for batch/mass-approval workflows (select many, act in bulk).
- A **card mode** for judgment-per-item workflows like lead qualification (consider one at a time, color-coded by priority/quality).

The toggle changes both layout AND available actions — see below.

## Pages (four)

**1. Login page.** Minimal, centered. Logo + wordmark, email field, password field, a primary sign-in button, a small "forgot password" link, and a single line of metadata in the corner (version, environment). No marketing copy.

**2. Dashboard (core page).**
- Persistent left nav: a workspace switcher at top, a list of workflows/queues (each with a name and a pending-item count badge), and user identity at the bottom.
- Main panel header: queue name, a status line, and a row of stat tiles (e.g., PENDING, APPROVED // 7D, AVG DECISION TIME, and one volume or cost metric). The key figure in each tile should use the design system's accent treatment.
- A **Table / Cards view toggle** in the main panel toolbar. It must change both layout and actions:
  - **Table view (default):** dense rows, one review item each, with a leading checkbox column. Selecting one or more rows reveals a bulk action bar (Approve selected, Reject selected, Reassign). For batch workflows.
  - **Cards view:** cards, one item each, color-coded by priority/quality using the design system's accent and secondary-accent treatments (primary accent = high priority, neutral = normal, secondary/error accent = flagged). Per-card quick actions. No bulk actions in this mode.
- Clicking any item (row or card) opens the detail flyout (below).

**3. Config page.** Where a workflow/queue is configured. Use a definition-list layout (label/value rows), not a card layout. Sections: workflow name + description, trigger/schedule, decision criteria, notifications, and an "action configuration" section defining which actions appear in the flyout for this workflow. Primary "Save" action.

**4. User settings page.** Account settings: profile, notification preferences, theme, API keys/tokens, sign-out. Same definition-list layout as config.

## The detail flyout (dashboard)

Slides in from the right when an item is selected, overlaying the queue without navigating away. Structure:
- Header: item identifier, status, close button.
- Body: the item's detail. Where a workflow involves reviewing an AI draft against source material, support a two-pane body (source input vs. AI-proposed output, side by side) so the reviewer can compare before deciding. Use this two-pane body for the seeded rfp-intake example. Include space for marginalia-style context/audit notes alongside the detail.
- Action bar — a CONFIGURABLE SLOT: a consistent area holding the decision buttons. For the seeded example: Approve (primary action), Edit, Reject (error/secondary accent). Comment in the code that this action set is meant to be swapped per workflow.

## General requirements

- This is an app, not a marketing page — use the full viewport, dense information layout, no fixed max-width.
- Keyboard affordances where natural: row selection, open/close flyout, approve.
- Build it as a working interactive prototype with the seeded rfp-intake data so the toggle, flyout, and bulk actions demonstrably function.
- Keep structure generic and well-commented so the skeleton can be forked by swapping the seed data and the flyout action set.
- Table view is the default; the most common future case may be Cards, but the denser view should be the default so layout problems surface under load.