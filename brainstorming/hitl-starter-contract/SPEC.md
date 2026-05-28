# HITL-Starter — Workflow & Item Contract

A plug-in contract for human-in-the-loop workflow dashboards. Defines the three
objects the dashboard understands — **Workflow**, **Item**, and **Action** — so
new workflows can be added without touching the dashboard shell.

---

## Design principle

The dashboard is generic. It knows only this contract, never a specific
workflow. Adding a workflow means *implementing the contract*, not editing the
shell.

The test: if the dashboard ever contains `if (workflow.id === 'rfp-intake')`,
the abstraction has failed. Everything workflow-specific lives behind the
interface.

---

## Object 1 — Workflow

A configured automation that produces items needing human decisions.

### Identity & display
| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable unique key (e.g. `rfp-intake`). |
| `name` | string | Human-readable display name. |
| `description` | string | One or two sentences on what it does. |
| `status` | enum | `running` \| `paused` \| `error` \| `idle`. |

### Structure
| Field | Type | Notes |
|---|---|---|
| `steps` | Step[] | Ordered stages the automation runs, for display/diagram. Each: `label`, optional `status`. |
| `stats` | Stat[] | Summary metrics for the header tiles. Each: `label`, `value`, `unit`, optional `trend`, `emphasized` flag (the accent figure). |
| `defaultView` | enum | `table` \| `cards`. Which view this workflow opens in. Lead-qual → cards; mass-approval → table. |

### Items & behavior
| Field | Type | Notes |
|---|---|---|
| `items` | Item[] | The review queue this workflow produces. |
| `itemSchema` | FieldDef[] | Describes which fields this workflow's items carry, so the table renders the right columns and cards the right fields. |
| `availableActions` | Action[] | The actions valid for this workflow's items. Drives the flyout action bar and the bulk-action bar. The configurable slot. |

### Optional / integration
| Field | Type | Notes |
|---|---|---|
| `sources` | Source[] | External systems read from / written to (APIs, inboxes, CRMs). For display + config. |
| `confidenceFloor` | number | Threshold above which an item is flagged for human review rather than auto-handled. Decides *what lands in the queue*. |

---

## Object 2 — Workflow Item

A single thing flagged for a human decision. The atomic unit of the queue.

### Identity & display
| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable unique key (e.g. `rfp-2026-0142`). |
| `status` | enum | `pending` \| `approved` \| `rejected` \| `flagged` \| `skipped`. Lifecycle state; drives the status dot. |
| `priority` | enum | `high` \| `normal` \| `flagged`. Drives card color-coding and sort. |
| `createdAt` | datetime | When the item entered the queue. |
| `summary` | string | Short one-line description for the row/card. |
| `fields` | record | Workflow-specific data conforming to the workflow's `itemSchema`. |

### Review payload (what the human looks at)
| Field | Type | Notes |
|---|---|---|
| `sourceContent` | string | The input the automation received (e.g. inbound email). |
| `proposedOutput` | string | What the automation wants to do (e.g. drafted response). With `sourceContent`, drives the two-pane flyout body. |
| `context` | Note[] | Marginalia: why flagged, confidence score, audit trail — anything that helps the human decide. |

### Actions
| Field | Type | Notes |
|---|---|---|
| `actions` | Action[] | Actions available on *this specific item*. Usually inherited from the workflow's `availableActions`, but an item may narrow them (e.g. a fetch-failed item offers only Retry + Dismiss). |

---

## Object 3 — Action

What a human can do to an item. Specifying this separately is what makes
workflows pluggable: the dashboard renders whatever actions the contract hands
it, without knowing what they mean.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable key (e.g. `approve`, `reject`, `edit`, `retry`, `reassign`). |
| `label` | string | Button text. |
| `intent` | enum | `primary` \| `neutral` \| `destructive`. Maps to design-system button styling. The dashboard styles by intent, not by knowing the action. |
| `appliesTo` | enum | `single` \| `bulk` \| `both`. Flyout, bulk-action bar, or both. Approve might be both; Edit is single-only. |
| `confirm` | boolean | Whether it requires a confirmation step. Destructive actions usually do. |
| `resultingStatus` | enum | The item status this action produces (approve → `approved`). The lifecycle link: actions are the only thing that change item status. |
| `handler` | reference | The function/endpoint invoked when the action fires. Stubbed in the starter; wire to backend later. |

---

## The lifecycle

```
Workflow runs
   → produces Items (those above the confidence floor land in the queue as `pending`)
   → Human opens Item in flyout → reviews sourceContent vs. proposedOutput
   → Human fires an Action → Action's resultingStatus updates the Item
   → Item leaves the pending queue
```

The dashboard's only job: list a workflow's items, render them by
`priority`/`status`, show the review payload in the flyout, present the valid
`actions`, and call the action's `handler`. Identical for every workflow.

---

## The plugin test

To add a new workflow (say `lead-qualifier`), implement: a Workflow object with
its stats and itemSchema, the items it produces, and its availableActions. Write
**zero** dashboard code. If you find yourself editing the shell, the contract is
missing something.

---

## Notes on intentionally-open details

- **`handler` is left abstract.** Whether it's a REST endpoint, a function
  reference, or a LangGraph node is an implementation choice best made when
  wiring to the real backend. The contract says "an action invokes a handler";
  the mechanism stays open.
- **`itemSchema` field types** are kept to a small display-oriented set
  (`string`, `number`, `datetime`, `email`, `badge`, `count`). Extend as real
  workflows demand, but resist turning this into a full type system — it exists
  to tell the UI how to render a column, not to validate business data.
