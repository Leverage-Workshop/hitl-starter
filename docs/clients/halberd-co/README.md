# Halberd & Co — Client Brief

> Demo client for the HITL-Starter console. This brief describes the company, its
> operational bottlenecks, a free-tier-only tech stack, and four human-in-the-loop
> workflows. Each workflow doc maps directly onto the contract in
> `lib/contract/index.ts`, so it can later be expressed as a `WorkflowSchema.parse({...})`
> entry in `lib/contract/seed.ts` with no UI changes.

---

## What Halberd & Co is

A **dry-van, full-truckload (FTL) freight brokerage / 3PL** — roughly **20 people**.
Halberd doesn't own trucks. It sits between **shippers** (companies with freight to move)
and **carriers** (the trucking companies that haul it), earning a margin on every load it
books. This is the most common shape of third-party logistics provider: an unsexy,
phone-and-email, spreadsheet-driven operations business where the difference between a good
month and a bad one is how fast and how accurately a handful of people make decisions.

**Principal:** J. Grant. **Domain:** `halberd-co.com` (`quotes@`, `ops@`, `ap@`).

### Org (~20)

| Team | Headcount | What they do |
|---|---|---|
| Sales / shipper desk | 6 | Win shippers, quote loads, own the customer relationship |
| Carrier reps | 5 | Source trucks, negotiate carrier rates, vet compliance |
| Ops / track-and-trace | 4 | Cover loads, dispatch, status updates, exception handling |
| Back office (AP/AR) | 3 | Carrier settlement, customer invoicing, collections |
| Leadership / ops mgmt | 2 | Margin, capacity, hiring, the weekly number |

### Customers (shippers)

Mid-market manufacturers and distributors with steady regional freight — e.g.
**Granite & Cole** (quarry & building materials, flatbed spillover), **Pendleton**
(manufacturing), and **Northwind Logistics** (reefer fleet overflow). Lanes are mostly
dry-van FTL across the lower-48, with seasonal produce and retail surges.

---

## The thesis: judgment is the bottleneck

In a brokerage, the scarce resource is **a broker's judgment** — on what to quote, which
carrier to trust, and which invoice discrepancy is real. Everything else is rote: parsing
an RFQ email, pulling a comparable lane rate, matching a carrier invoice to a rate
confirmation, compiling the Friday numbers. Today that rote work is done *by* the people
whose judgment is the actual product, so it queues behind them and slows the whole shop.

Halberd's HITL play: let agents do the parsing, matching, and drafting; keep humans on the
**approve / edit / reject** decision. The console is the review surface where that handoff
happens. Freeing a six-person sales desk from copy-paste quoting, or a three-person back
office from manual invoice matching, lands **directly on margin and cash** — which is the
whole point of this kind of automation.

---

## The four workflows

| # | Workflow | Archetype | Trigger | Existing stub |
|---|---|---|---|---|
| 1 | [Quote Desk](workflows/quote-desk.md) | Speed-to-lead | Real-time (RFQ in) | extends `lead-qualifier` |
| 2 | [Shipper Reactivation](workflows/shipper-reactivation.md) | Refresh old leads | Scheduled sweep | new (cf. `churn-signal-watcher`) |
| 3 | [Weekly Margin & Ops Digest](workflows/weekly-margin-digest.md) | Report generation | Scheduled (Fri) | extends `weekly-ops-digest` |
| 4 | [Carrier Invoice Reconciliation](workflows/carrier-invoice-reconciliation.md) | Document processing | Inbound doc event | extends `invoice-reconciler` |

The lineup is a deliberate ladder: a low-latency real-time workflow (1), a scheduled
outbound-drafting workflow (2), a scheduled internal-reporting workflow (3), and a
high-complexity exception-driven document workflow (4) that replaces `rfp-intake` as the
flagship.

---

## Docs index

- [`tech-stack.md`](tech-stack.md) — the free-tier-only stack and per-workflow tool map.
- [`bottlenecks.md`](bottlenecks.md) — the operational pains and the ROI each workflow targets.
- [`workflows/`](workflows/) — one spec per workflow, each ending in a **Contract mapping** section that is ready to translate into `seed.ts`.

## Status / next steps

This brief is documentation only. Turning it into running workflows — writing the
`WorkflowSchema.parse({...})` objects into `lib/contract/seed.ts` and running
`npx tsx scripts/seed.ts` — is a separate follow-on task. The old
automation-studio framing still lingering in `lib/data.ts` and the seed should be cleaned
up at that time.
