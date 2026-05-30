# Workflow: Quote Desk

**Archetype:** speed-to-lead · **Trigger:** real-time · **Lineage:** extends the
`lead-qualifier` stub · **Default view:** `table`

---

## Purpose

Turn an inbound shipper RFQ into a credible, ready-to-send quote in seconds, so a broker can
approve and fire it before a competitor answers. The broker keeps the pricing decision; the
agent removes the reading, lane lookup, and drafting.

## Trigger & cadence

Real-time. Fires on a new RFQ arriving at `quotes@halberd-co.com` (Gmail) or via a HubSpot
web form. Each RFQ becomes one review item.

## Sources

| Source | `kind` | Role |
|---|---|---|
| `quotes@halberd-co.com` | `inbox` | Inbound RFQ emails |
| HubSpot RFQ form | `crm` | Web-form quote requests |
| Airtable lane history | `database` | Comparable past loads → rate band |

## What the agent does

1. Parse the RFQ: origin, destination, equipment (dry van / reefer / flatbed), pickup date,
   weight/commodity, any accessorials.
2. Pull comparable lanes from Airtable (same lane + equipment, recent window) and compute a
   rate band (low / target / high) with a confidence score.
3. Draft a quote reply in Halberd's voice — the target rate, transit estimate, and a clear
   call to book.
4. Open (or update) the corresponding deal in HubSpot.
5. Score confidence: thin lane history or ambiguous equipment lowers it.

## Proposed output (flyout — right pane)

The drafted quote email: greeting, the quoted all-in rate, transit time, validity window, and
the booking ask. Ready to send on approve.

## Source content (flyout — left pane)

The raw inbound RFQ (sender, subject, body) plus the comparable-lane evidence the rate was
built from, so the broker can sanity-check the number at a glance.

## Human decision & actions

| Action | `intent` | `appliesTo` | `resultingStatus` | `hotkey` | Notes |
|---|---|---|---|---|---|
| Approve & send | `primary` | `both` | `approved` | `A` | Fires the quote |
| Adjust rate & send | `neutral` | `single` | `approved` | `E` | Edit the number, then send |
| Reassign | `neutral` | `single` | — | `R` | Hand to a specific broker |
| Decline | `destructive` | `both` | `rejected` | `X` | Out-of-network lane / no capacity (`confirm: true`) |

## Confidence handling

`confidenceFloor: 0.75`. Above it (clean lane, solid comps) the draft can auto-pass to send in
high-volume mode; below it (sparse history, odd equipment, exotic lane) the item is held
`pending` for a human to price. Speed matters most where confidence is high — that's where
auto-pass earns its keep.

---

## Contract mapping

Translates to a `WorkflowSchema.parse({...})` object in `lib/contract/seed.ts`.

```ts
{
  id: "quote-desk",
  name: "quote-desk",
  description:
    "Parses inbound shipper RFQs, anchors a rate from historical lanes, and " +
    "drafts a ready-to-send quote. Holds low-confidence lanes for a broker.",
  status: "running",            // WorkflowStatus
  defaultView: "table",
  confidenceFloor: 0.75,
  steps: [                       // Step.status: done | active | pending | error
    { label: "parse",    status: "done" },
    { label: "rate",     status: "active" },
    { label: "draft",    status: "pending" },
    { label: "send",     status: "pending" },
  ],
  stats: [
    { label: "PENDING",         value: 8,        unit: "to quote", emphasized: true },
    { label: "QUOTED // 7D",    value: 96,       trend: "+14 vs prior 7d" },
    { label: "AVG RESPONSE",    value: "52s",    unit: "RFQ → quote" },
    { label: "WIN RATE // 7D",  value: "31%",    unit: "quotes booked" },
  ],
  itemSchema: [                  // FieldType: text | money | score | email | count | datetime | badge
    { key: "lane",      label: "Lane",      type: "text" },
    { key: "equipment", label: "Equipment", type: "badge" },
    { key: "pickup",    label: "Pickup",    type: "datetime" },
    { key: "rate",      label: "Quoted",    type: "money" },
    { key: "score",     label: "Confidence", type: "score" },
  ],
  availableActions: [ /* approve, adjust, reassign, decline — see table above */ ],
  sources: [
    { id: "quotes-inbox", label: "quotes@halberd-co.com", kind: "inbox" },
    { id: "hubspot-form", label: "HubSpot RFQ form",       kind: "crm" },
    { id: "lane-history", label: "Airtable lane history",  kind: "database" },
  ],
}
```

**Item shape:** `priority` is `high` for hot/time-sensitive lanes, else `normal`; `summary`
is a one-line lane + ask; `fields` carries `lane`, `equipment`, `pickup`, `rate`, `score`;
`proposedOutput` holds the draft quote; `sourceContent` holds the RFQ + comps.
