# Halberd & Co — Tech Stack

A constraint on this build: **every tool must have a real free tier**, so the whole portfolio
can be stood up at $0 standing cost. The one exception is the Claude API — it's the engine
behind every workflow and is billed by usage. Everything else below has a verified free tier
sufficient for a demo/prototype.

This stack also reflects a realistic *scrappy* brokerage. Halberd hasn't bought a six-figure
enterprise TMS (Turvo/McLeod/MercuryGate); like many ~20-person shops it runs operations on
**Airtable + Google Workspace + QuickBooks**, with HubSpot for sales. That's both believable
and free-tier-friendly.

---

## The stack

| Tool | Role at Halberd | Free-tier reality | API surface used |
|---|---|---|---|
| **Airtable** | Lightweight TMS — the load board, lane history, carrier list | 1,000 records/base, free Web API (~5 req/s, ~1k calls/mo) | Web API (records CRUD) |
| **HubSpot** | Shipper sales CRM — deals, contacts, RFQ web forms | Free CRM + API, 100 req/10s rolling | CRM v3 objects, Forms |
| **Gmail / Google Workspace** | `quotes@ ops@ ap@` inboxes; doc storage in Drive | Free w/ a Google account | Gmail API (read/draft/send) |
| **QuickBooks Online** | AP/AR — carrier settlement, customer invoicing, AR aging | Free developer sandbox: 5 companies, valid 2 yrs, sandbox calls free | Accounting API |
| **FMCSA QCMobile** | Carrier vetting — authority, insurance, safety scores | Free U.S. DOT gov API; webkey via a free Login.gov account | QCMobile (carrier lookup) |
| **Slack** | Internal comms; where the console posts review pings & digests | Free tier | Incoming webhooks / Web API |
| **trigger.dev** | Agent/job orchestration (schedules, webhooks, retries) | $5/mo free compute credit, 10 concurrent runs, 10 schedules | SDK + scheduled tasks |
| **LangGraph** | Agent graph runtime (alternative/complement to trigger.dev) | Open source | self-hosted |
| **Neon Postgres** | This console's own DB (workflows + items), already wired | Free tier | Drizzle ORM (`db/`) |
| **Claude API** | The model that parses, matches, and drafts in every workflow | **Usage-based — only non-free item** | Messages API |

### Rates without a paid data feed

The Quote Desk needs a market rate to anchor a quote. Production brokerages buy that from
**DAT** or **Truckstop**, which have no free tier. For the demo, Halberd derives a rate band
from **its own historical lanes in Airtable** (same origin/destination/equipment, recent
window). A paid market feed is documented as a future upgrade, not a dependency.

---

## Per-workflow tool map

| Workflow | Reads from | Drafts / writes | Settles to |
|---|---|---|---|
| **Quote Desk** | Gmail (`quotes@`), HubSpot forms, Airtable lane history | Quote reply (Gmail draft), HubSpot deal | HubSpot deal stage / Airtable load |
| **Shipper Reactivation** | HubSpot deals, Airtable tender history | Re-engagement email (Gmail draft) | HubSpot activity logged |
| **Weekly Margin & Ops Digest** | Airtable (loads/lanes), QuickBooks (AR/settlement) | Draft digest | Slack post (`#leadership`) |
| **Carrier Invoice Reconciliation** | Gmail (`ap@`) + uploads, Airtable load, FMCSA | AP entry / exception flag | QuickBooks bill, Airtable load status |

---

## How it wires to the console

The console is the **review surface**; the orchestration layer (trigger.dev / LangGraph,
calling Claude) does the work and talks to the console over the contract's webhooks:

- **Inbound** — an engine enqueues an item for review via
  `POST /api/workflows/[id]/items` (HMAC-signed, validated against `ItemSchema`).
- **Outbound** — when a reviewer fires an action whose `handler` is `{ url }`, the console
  persists the decision as `dispatching` and POSTs it back to the engine (SSRF-allowlisted),
  which acts and then settles the item via the inbound endpoint.

So none of these third-party tools are called *from* the console directly — they're called
by the engine. The console only needs Neon + the Claude API (indirectly). That keeps the
free-tier surface small and the security model clean.
