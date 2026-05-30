# Workflow: Shipper Reactivation

**Archetype:** refresh old leads · **Trigger:** scheduled sweep · **Lineage:** new
(complements the paused `churn-signal-watcher` stub) · **Default view:** `cards`

---

## Purpose

Catch revenue leaking out the back. Shippers tender in bursts and go quiet; this workflow
notices the fade and drafts a tailored re-engagement so a broker can reach out before the
relationship cools. The broker keeps the relationship judgment; the agent does the watching
and the first draft.

## Trigger & cadence

Scheduled. A daily/weekly sweep of HubSpot + Airtable flags shippers with **no tender in N
weeks** (default 6) that previously had meaningful volume. Each flagged account becomes one
review item. (Variant: the same pattern reactivates dormant **carriers** who used to be
reliable.)

## Sources

| Source | `kind` | Role |
|---|---|---|
| HubSpot deals/contacts | `crm` | Account owner, last activity, contact |
| Airtable tender history | `database` | Past lanes, volume, recency |

## What the agent does

1. Sweep for accounts whose last tender is older than the dormancy threshold but whose prior
   12-week volume cleared a floor.
2. Summarize the relationship: top lanes, typical volume, last load, account owner.
3. Pull a current rate on the shipper's top lane from Airtable history.
4. Draft a short, specific re-engagement email — references their actual lanes/volume and
   offers the fresh rate, in the owner's voice.
5. Score: higher for recently-large, cleanly-faded accounts; lower for erratic or tiny ones.

## Proposed output (flyout — right pane)

The drafted re-engagement email — personalized to the account's history and lane, with a
concrete rate and a soft ask to send a load.

## Source content (flyout — left pane)

The relationship snapshot: last tender date, top lanes, 12-week volume trend, account owner,
and the lane rate the offer is built on.

## Human decision & actions

| Action | `intent` | `appliesTo` | `resultingStatus` | `hotkey` | Notes |
|---|---|---|---|---|---|
| Approve & send | `primary` | `both` | `approved` | `A` | Sends the re-engagement |
| Edit draft | `neutral` | `single` | `approved` | `E` | Tune tone/offer, then send |
| Skip | `neutral` | `both` | `skipped` | `S` | Not worth re-engaging now |
| Escalate to owner | `neutral` | `single` | `escalated` | `O` | Hand to the named account owner |

## Confidence handling

`confidenceFloor: 0.7`. High-confidence drafts (clean fade, strong prior volume, current
contact) are batch-approvable; low-confidence ones (erratic history, stale contact) always
wait for a human so Halberd never sends a tone-deaf "we miss you" to a churned or annoyed
account.

---

## Contract mapping

```ts
{
  id: "shipper-reactivation",
  name: "shipper-reactivation",
  description:
    "Sweeps for shippers gone quiet and drafts a tailored re-engagement " +
    "referencing their past lanes and a fresh rate. Human approves per account.",
  status: "running",
  defaultView: "cards",
  confidenceFloor: 0.7,
  steps: [
    { label: "sweep",   status: "done" },
    { label: "profile", status: "done" },
    { label: "draft",   status: "active" },
    { label: "send",    status: "pending" },
  ],
  stats: [
    { label: "DORMANT",          value: 14, unit: "accounts", emphasized: true },
    { label: "REACTIVATED // 30D", value: 5, trend: "+2 vs prior 30d" },
    { label: "VOLUME AT RISK",   value: "$ 88k", unit: "trailing-qtr" },
    { label: "AVG DORMANCY",     value: "9w", unit: "since last tender" },
  ],
  itemSchema: [
    { key: "account",    label: "Account",     type: "text" },
    { key: "topLane",    label: "Top lane",    type: "text" },
    { key: "lastTender", label: "Last tender", type: "datetime" },
    { key: "qtrVolume",  label: "Qtr volume",  type: "money" },
    { key: "score",      label: "Fit",         type: "score" },
  ],
  availableActions: [ /* approve, edit, skip, escalate — see table above */ ],
  sources: [
    { id: "hubspot",       label: "HubSpot deals",          kind: "crm" },
    { id: "tender-history", label: "Airtable tender history", kind: "database" },
  ],
}
```

**Item shape:** `priority` is `high` for the largest dormant accounts, else `normal`;
`summary` names the account and how long it's been quiet; `proposedOutput` is the draft email;
`sourceContent` is the relationship snapshot.
