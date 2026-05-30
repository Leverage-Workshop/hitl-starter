# Workflow: Carrier Invoice Reconciliation

**Archetype:** document processing · **Trigger:** inbound document event · **Lineage:**
extends the `invoice-reconciler` stub; replaces `rfp-intake` as the complex flagship ·
**Default view:** `table`

---

## Purpose

Every load generates a rate confirmation, a BOL, a proof of delivery, and a carrier invoice.
Matching the invoice against the rate con and POD by hand is slow and lets overbilling slip
through. This workflow extracts the documents, matches them to the load, runs a carrier check,
and surfaces only the **exceptions** for a human. Clean matches auto-pass; the back office
spends its time on the discrepancies that actually need judgment.

## Trigger & cadence

Event-driven. Fires when a carrier invoice (and its supporting docs) lands at
`ap@halberd-co.com` or is uploaded. Each invoice/load becomes one review item — but most
clean ones settle automatically and never reach the human queue.

## Sources

| Source | `kind` | Role |
|---|---|---|
| `ap@halberd-co.com` + uploads | `inbox` | Carrier invoices, BOLs, PODs |
| Airtable load record | `database` | The agreed rate con / load of record |
| FMCSA QCMobile | `api` | Carrier authority / insurance check |

## What the agent does

1. Extract fields from each document: load number, carrier, agreed rate (rate con), billed
   amount (invoice), delivery signature/date (POD), accessorials.
2. Match the invoice to the load record in Airtable by load number.
3. Reconcile: billed vs agreed, POD present and signed, accessorials authorized.
4. Run an FMCSA check — carrier authority active, insurance current.
5. Classify: **clean match** (auto-settle) or **exception** (rate mismatch, missing POD,
   unknown load, carrier flag) with a reason and a confidence score.
6. For clean matches, draft the AP bill in QuickBooks; for exceptions, draft the proposed
   resolution for a human.

## Proposed output (flyout — right pane)

For a clean match: the drafted QuickBooks AP entry. For an exception: the specific
discrepancy (e.g. "billed $2,450 vs rate con $2,200 — +$250 unexplained; no detention noted")
and the proposed fix (short-pay to rate con, request POD, etc.).

## Source content (flyout — left pane)

The extracted documents side-by-side with the load record — invoice, rate con, POD — so the
human can see exactly where the numbers diverge.

## Human decision & actions

| Action | `intent` | `appliesTo` | `resultingStatus` | `hotkey` | Notes |
|---|---|---|---|---|---|
| Approve payment | `primary` | `both` | `approved` | `A` | Books the AP bill as drafted |
| Short-pay to rate con | `neutral` | `single` | `approved` | `S` | Pay the agreed amount, note the delta |
| Request docs | `neutral` | `both` | `pending` | `D` | Missing/invalid POD — ask the carrier |
| Dispute / hold | `destructive` | `both` | `rejected` | `X` | Reject the invoice (`confirm: true`) |

## Confidence handling

`confidenceFloor: 0.9` — deliberately high, because money moves. A clean three-way match
(invoice = rate con, POD signed, carrier in good standing) above the floor **auto-settles** to
`dispatching` → `approved` and books in QuickBooks with no human touch. Anything below — any
mismatch, missing doc, or carrier flag — is held as an exception for the back office. The
human queue becomes a queue of *problems*, not paperwork.

---

## Contract mapping

```ts
{
  id: "carrier-invoice-reconciliation",
  name: "carrier-invoice-reconciliation",
  description:
    "Extracts carrier invoices, BOLs, and PODs, three-way matches them to the " +
    "load's rate con, runs an FMCSA check, and auto-settles clean matches while " +
    "surfacing exceptions for the back office.",
  status: "running",
  defaultView: "table",
  confidenceFloor: 0.9,
  steps: [
    { label: "extract",     status: "done" },
    { label: "match",       status: "done" },
    { label: "reconcile",   status: "active" },
    { label: "settle",      status: "pending" },
  ],
  stats: [
    { label: "EXCEPTIONS",        value: 9,       unit: "to clear", emphasized: true },
    { label: "AUTO-SETTLED // 7D", value: 187,     trend: "88% of volume" },
    { label: "OVERBILLING CAUGHT", value: "$ 4.1k", unit: "this week" },
    { label: "AVG CLEAR TIME",    value: "3m 12s", unit: "open → decide" },
  ],
  itemSchema: [
    { key: "loadNo",    label: "Load #",   type: "text" },
    { key: "carrier",   label: "Carrier",  type: "text" },
    { key: "billed",    label: "Billed",   type: "money" },
    { key: "variance",  label: "Variance", type: "money" },
    { key: "reason",    label: "Flag",     type: "badge" },
    { key: "score",     label: "Match",    type: "score" },
  ],
  availableActions: [ /* approve, short-pay, request docs, dispute — see table above */ ],
  sources: [
    { id: "ap-inbox",  label: "ap@halberd-co.com",     kind: "inbox" },
    { id: "load",      label: "Airtable load record",  kind: "database" },
    { id: "fmcsa",     label: "FMCSA QCMobile",        kind: "api" },
  ],
}
```

**Item shape:** `priority` is `high` for large-dollar or repeat-offender discrepancies, else
`normal`; `flagged` priority marks anything with an active carrier-compliance issue; `summary`
states the discrepancy in one line; `proposedOutput` is the AP entry or proposed resolution;
`sourceContent` is the extracted docs vs the load record.
