# Workflow: Weekly Margin & Ops Digest

**Archetype:** report generation · **Trigger:** scheduled (Friday) · **Lineage:** extends the
`weekly-ops-digest` stub · **Default view:** `cards`

---

## Purpose

Give leadership a consistent, accurate weekly picture of the business without anyone spending
Friday afternoon in spreadsheets. The agent compiles the numbers and drafts the digest; a
leader reviews and approves before it posts to Slack. This is an **internal** report — not
customer-facing.

## Trigger & cadence

Scheduled, weekly (Friday mid-afternoon). Produces a small number of review items — typically
one digest item per week, optionally split into sections (margin, ops, AR) as separate items
when something needs a closer look.

## Sources

| Source | `kind` | Role |
|---|---|---|
| Airtable (loads/lanes) | `database` | Loads moved, revenue, carrier cost, on-time |
| QuickBooks | `api` | AR aging, carrier settlement status |

## What the agent does

1. Pull the week's loads from Airtable: count, revenue, carrier cost → **gross margin**, by
   lane and overall.
2. Compute on-time percentage and a **carrier scorecard** (on-time, claims, responsiveness).
3. Pull **AR aging** and settlement status from QuickBooks.
4. Compare against the prior week / trailing average and surface notable movements.
5. Draft the digest: headline numbers, lane margin table, carrier callouts, AR flags, and a
   short "watch next week" note.

## Proposed output (flyout — right pane)

The drafted digest, formatted for Slack: headline KPIs, a margin-by-lane table, carrier
scorecard highlights, AR aging summary, and flagged items.

## Source content (flyout — left pane)

The underlying figures the digest is built from — the raw weekly aggregates from Airtable and
QuickBooks — so a leader can verify a number before it goes to the whole team.

## Human decision & actions

| Action | `intent` | `appliesTo` | `resultingStatus` | `hotkey` | Notes |
|---|---|---|---|---|---|
| Approve & post | `primary` | `single` | `approved` | `A` | Posts the digest to `#leadership` |
| Edit digest | `neutral` | `single` | `approved` | `E` | Adjust narrative/figures, then post |
| Hold | `neutral` | `single` | `pending` | `H` | Numbers look off — keep investigating |
| Flag for review | `neutral` | `single` | `escalated` | `F` | Route an anomaly to finance/ops mgmt |

## Confidence handling

`confidenceFloor: 0.85` — high, because a report posted to leadership should be right. The
agent flags any figure it couldn't reconcile (e.g. a load missing its carrier cost, an
ambiguous AR record) and lowers confidence so the digest waits for a human rather than
publishing a number it isn't sure of. There's no meaningful auto-pass mode here; the value is
the drafting, and a human always approves.

---

## Contract mapping

```ts
{
  id: "weekly-margin-digest",
  name: "weekly-margin-digest",
  description:
    "Compiles the weekly margin & ops digest — loads, margin per lane, " +
    "on-time %, carrier scorecards, AR aging — from Airtable + QuickBooks. " +
    "Leadership approves before it posts to Slack.",
  status: "idle",                // runs on a Friday schedule
  defaultView: "cards",
  confidenceFloor: 0.85,
  steps: [
    { label: "pull",      status: "done" },
    { label: "compute",   status: "done" },
    { label: "draft",     status: "active" },
    { label: "post",      status: "pending" },
  ],
  stats: [
    { label: "GROSS MARGIN // 7D", value: "$ 47k", unit: "this week", emphasized: true },
    { label: "LOADS // 7D",        value: 213,      trend: "+11 vs prior 7d" },
    { label: "ON-TIME",            value: "94%",    unit: "delivery" },
    { label: "AR > 45D",           value: "$ 31k",  unit: "aging" },
  ],
  itemSchema: [
    { key: "section",     label: "Section",    type: "badge" },
    { key: "margin",      label: "Margin",     type: "money" },
    { key: "loads",       label: "Loads",      type: "count" },
    { key: "onTime",      label: "On-time",    type: "text" },
    { key: "weekEnding",  label: "Week ending", type: "datetime" },
  ],
  availableActions: [ /* approve & post, edit, hold, flag — see table above */ ],
  sources: [
    { id: "airtable-loads", label: "Airtable loads/lanes", kind: "database" },
    { id: "quickbooks",     label: "QuickBooks",           kind: "api" },
  ],
}
```

**Item shape:** `priority` is `normal` for the routine digest, `flagged` when an anomaly is
surfaced; `summary` is the headline (e.g. "Week ending 5/29 — margin +6%, AR creeping");
`proposedOutput` is the Slack-ready digest; `sourceContent` is the raw weekly aggregates.
