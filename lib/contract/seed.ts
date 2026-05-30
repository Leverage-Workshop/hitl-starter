/**
 * Contract-valid seed data — Halberd & Co (dry-van FTL freight brokerage).
 *
 * Each workflow is a WorkflowSchema-parsed object, so defaults are applied and
 * validation runs at module load time (not lazily). The four workflows mirror
 * the client brief in docs/clients/halberd-co/ one-for-one.
 *
 *   carrier-invoice-reconciliation  → document processing (flagship, full items)
 *   quote-desk                      → speed-to-lead
 *   shipper-reactivation            → refresh old leads
 *   weekly-margin-digest            → internal report generation
 *
 * Run validation:  npx tsx lib/contract/seed.ts
 */

import {
  WorkflowSchema,
  bulkActions,
  singleActions,
  intentToVariant,
  type Action,
  type Workflow,
} from "./index";

/* ================================================================== */
/* carrier-invoice-reconciliation — flagship workflow with items       */
/* ================================================================== */

const CIR_APPROVE: Action = {
  id: "approve",
  label: "Approve payment",
  intent: "primary",
  appliesTo: "both",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "A",
  handler: "cir.approve",
};

const CIR_SHORTPAY: Action = {
  id: "short-pay",
  label: "Short-pay to rate con",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "S",
  handler: "cir.shortpay",
};

const CIR_REQUEST_DOCS: Action = {
  id: "request-docs",
  label: "Request docs",
  intent: "neutral",
  appliesTo: "both",
  confirm: false,
  // resultingStatus: holds the item pending until the carrier re-sends
  resultingStatus: "pending",
  hotkey: "D",
  handler: "cir.requestDocs",
};

const CIR_DISPUTE: Action = {
  id: "dispute",
  label: "Dispute / hold",
  intent: "destructive",
  appliesTo: "both",
  confirm: true,
  resultingStatus: "rejected",
  hotkey: "X",
  handler: "cir.dispute",
};

export const carrierInvoiceReconciliation: Workflow = WorkflowSchema.parse({
  id: "carrier-invoice-reconciliation",
  name: "carrier-invoice-reconciliation",
  description:
    "Extracts carrier invoices, BOLs, and PODs, three-way matches them to the " +
    "load's rate confirmation, runs an FMCSA carrier check, and auto-settles " +
    "clean matches while surfacing exceptions — rate mismatches, missing PODs, " +
    "unknown loads, carrier flags — for the back office to clear.",
  status: "running",
  defaultView: "table",
  confidenceFloor: 0.9,
  steps: [
    { label: "extract", status: "done" },
    { label: "match", status: "done" },
    { label: "reconcile", status: "active" },
    { label: "settle", status: "pending" },
  ],
  stats: [
    { label: "EXCEPTIONS", value: 9, unit: "to clear", emphasized: true },
    { label: "AUTO-SETTLED // 7D", value: 187, trend: "88% of volume" },
    { label: "OVERBILLING CAUGHT", value: "$ 4.1k", unit: "this week" },
    { label: "AVG CLEAR TIME", value: "3m 12s", unit: "open → decide" },
  ],
  itemSchema: [
    { key: "loadNo", label: "Load #", type: "text" },
    { key: "carrier", label: "Carrier", type: "text" },
    { key: "billed", label: "Billed", type: "money" },
    { key: "variance", label: "Variance", type: "money" },
    { key: "reason", label: "Flag", type: "badge" },
    { key: "score", label: "Match", type: "score" },
  ],
  availableActions: [CIR_APPROVE, CIR_SHORTPAY, CIR_REQUEST_DOCS, CIR_DISPUTE],
  sources: [
    { id: "ap-inbox", label: "ap@halberd-co.com", kind: "inbox" },
    { id: "load", label: "Airtable load record", kind: "database" },
    { id: "fmcsa", label: "FMCSA QCMobile", kind: "api" },
  ],
  items: [
    {
      id: "cir-2026-0488",
      status: "pending",
      priority: "high",
      createdAt: "2026-05-29T15:41:09Z",
      summary:
        "Ridgeline Carriers billed $2,450 vs rate con $2,200 — +$250 unexplained, no detention noted.",
      fields: {
        loadNo: "HC-41902",
        carrier: "Ridgeline Carriers LLC",
        billed: 2450,
        variance: 250,
        reason: "rate mismatch",
        score: 62,
      },
      sourceContent: `RATE CON  HC-41902
Lane: Fresno, CA → Dallas, TX  ·  Dry van  ·  PU 05/26  DEL 05/28
Agreed all-in: $2,200.00   Accessorials authorized: none

CARRIER INVOICE  #RC-8841 (Ridgeline Carriers LLC, MC-774120)
Line haul: $2,200.00
"Layover": $250.00
Invoice total: $2,450.00

POD: signed 05/28 14:02, receiver J. Ruiz — clean.`,
      proposedOutput: `Discrepancy: invoice $2,450 vs rate con $2,200 (+$250).
The $250 is billed as "layover" but no detention/layover was authorized on
the rate con and the POD shows on-time delivery (05/28, within appointment).

Proposed: short-pay to the agreed $2,200 and send the carrier a note citing
the rate con and the on-time POD. If Ridgeline can document a layover event
we'll reopen.`,
      context: [
        {
          ref: "[a]",
          body: "billed − rate con = +$250, mapped to unauthorized 'layover' line",
          createdAt: "2026-05-29T15:41:00Z",
        },
        {
          ref: "[b]",
          body: "POD on-time (del 05/28 within appt window) — no detention basis",
          createdAt: "2026-05-29T15:41:00Z",
        },
        {
          ref: "[c]",
          body: "FMCSA: MC-774120 authority active, insurance current",
          createdAt: "2026-05-29T15:42:00Z",
        },
      ],
    },
    {
      id: "cir-2026-0487",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-29T13:22:51Z",
      summary:
        "Invoice matches rate con but POD is missing — can't release payment until delivery is proven.",
      fields: {
        loadNo: "HC-41887",
        carrier: "Cobalt Freight Systems",
        billed: 1875,
        variance: 0,
        reason: "missing POD",
        score: 71,
      },
      sourceContent: `RATE CON  HC-41887
Lane: Atlanta, GA → Charlotte, NC  ·  Dry van  ·  PU 05/27  DEL 05/28
Agreed all-in: $1,875.00

CARRIER INVOICE  #1182 (Cobalt Freight Systems, MC-661004)
Line haul: $1,875.00  — matches rate con.

POD: NOT ATTACHED. BOL present (pickup) but no signed delivery receipt.`,
      proposedOutput: `Amount is clean ($1,875 = rate con). The blocker is the missing POD —
we don't pay or invoice the customer without proof of delivery.

Proposed: request the signed POD from Cobalt before releasing payment.
Hold the item pending; auto-resume reconcile once the POD lands.`,
      context: [
        {
          ref: "[a]",
          body: "amount reconciles to rate con exactly — no rate dispute",
          createdAt: "2026-05-29T13:22:00Z",
        },
        {
          ref: "[b]",
          body: "POD absent — workflow rule 'no_pod_no_pay'",
          createdAt: "2026-05-29T13:23:00Z",
        },
      ],
    },
    {
      id: "cir-2026-0486",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-29T11:08:33Z",
      summary:
        "Invoice references load HC-99201 — no matching load in the system. Possible wrong broker.",
      fields: {
        loadNo: "HC-99201",
        carrier: "Sunbelt Logistics Inc",
        billed: 3120,
        variance: 0,
        reason: "no match",
        score: 0,
      },
      sourceContent: `CARRIER INVOICE  #SB-2204 (Sunbelt Logistics Inc, MC-803551)
Referenced load: HC-99201
Lane: Laredo, TX → Memphis, TN
Invoice total: $3,120.00

[system: no load HC-99201 in Airtable; nearest is HC-41201 (different lane,
different carrier). No rate con on file for this carrier this week.]`,
      proposedOutput: `No load HC-99201 exists in our system, and Sunbelt isn't booked on any
open Halberd load this week. Likely a misdirected invoice (wrong broker) or
a typo'd load number.

Proposed: request clarification from Sunbelt — ask for the rate con / booking
confirmation tied to this load. Do not create an AP entry.`,
      context: [
        {
          ref: "[a]",
          body: "load HC-99201 not found; no rate con for MC-803551 this week",
          createdAt: "2026-05-29T11:08:00Z",
        },
        {
          ref: "[b]",
          body: "match score 0 — nothing to three-way against",
          createdAt: "2026-05-29T11:08:00Z",
        },
      ],
    },
    {
      id: "cir-2026-0485",
      status: "pending",
      priority: "flagged",
      createdAt: "2026-05-29T09:54:12Z",
      summary:
        "FMCSA shows carrier authority INACTIVE as of 05/24 — cannot settle until compliance clears.",
      fields: {
        loadNo: "HC-41855",
        carrier: "Vanguard Haulage LLC",
        billed: 2640,
        variance: 0,
        reason: "carrier flag",
        score: 40,
      },
      // compliance hold — payment is blocked; narrow to docs-request or dispute only
      actions: [CIR_REQUEST_DOCS, CIR_DISPUTE],
      sourceContent: `RATE CON  HC-41855
Lane: Denver, CO → Salt Lake City, UT  ·  Dry van  ·  PU 05/22  DEL 05/23
Agreed all-in: $2,640.00

CARRIER INVOICE  #VH-557 (Vanguard Haulage LLC, MC-712889)
Line haul: $2,640.00 — matches rate con. POD signed 05/23, clean.

[FMCSA QCMobile: MC-712889 OPERATING AUTHORITY = INACTIVE (revoked 05/24);
insurance lapsed 05/24. Load delivered 05/23, before the lapse.]`,
      proposedOutput: `Dollars and POD are clean and the load delivered 05/23 — one day before
authority was revoked (05/24). But paying a carrier whose authority is now
inactive needs a compliance decision, not an AP auto-pass.

Proposed: hold for compliance review. Request current insurance + authority
reinstatement docs from Vanguard; if they can't produce them, route to
dispute. Do not release payment on the automated path.`,
      context: [
        {
          ref: "[a]",
          body: "FMCSA: authority revoked 05/24, insurance lapsed 05/24",
          createdAt: "2026-05-29T09:54:00Z",
        },
        {
          ref: "[b]",
          body: "delivery 05/23 predates lapse — load itself was covered",
          createdAt: "2026-05-29T09:54:00Z",
        },
        {
          ref: "[c]",
          body: "approve/short-pay withheld — compliance hold per 'carrier_authority' rule",
          createdAt: "2026-05-29T09:55:00Z",
        },
      ],
    },
    {
      id: "cir-2026-0484",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-28T17:31:40Z",
      summary:
        "Detention of $150 billed above rate con — but it's documented with timestamps. Likely valid.",
      fields: {
        loadNo: "HC-41840",
        carrier: "Granite Line Transport",
        billed: 2050,
        variance: 150,
        reason: "accessorial",
        score: 80,
      },
      sourceContent: `RATE CON  HC-41840
Lane: Columbus, OH → Chicago, IL  ·  Dry van  ·  PU 05/27  DEL 05/28
Agreed line haul: $1,900.00   Detention: $50/hr after 2 free hrs (authorized)

CARRIER INVOICE  #GLT-9931 (Granite Line Transport, MC-690233)
Line haul: $1,900.00
Detention: $150.00 (3 hrs over free time @ $50)
Total: $2,050.00

POD: signed 05/28; check-in 08:05, departed 13:10. Receiver delays noted.`,
      proposedOutput: `The +$150 is detention, which the rate con explicitly authorizes at
$50/hr after 2 free hours. POD timestamps show ~5 hrs on site (08:05–13:10),
i.e. ~3 billable hours = $150. The math checks.

Proposed: approve payment at $2,050 — accessorial is documented and within
the authorized rate.`,
      context: [
        {
          ref: "[a]",
          body: "detention authorized on rate con; 3 billable hrs from POD = $150",
          createdAt: "2026-05-28T17:31:00Z",
        },
        {
          ref: "[b]",
          body: "confidence 80 — below 0.9 floor, so held for a human OK",
          createdAt: "2026-05-28T17:32:00Z",
        },
      ],
    },
    {
      id: "cir-2026-0483",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-28T14:12:07Z",
      summary:
        "Looks like a duplicate of invoice #4471 (same load, same amount) already settled 05/27.",
      fields: {
        loadNo: "HC-41799",
        carrier: "Cobalt Freight Systems",
        billed: 1640,
        variance: 0,
        reason: "duplicate",
        score: 55,
      },
      sourceContent: `CARRIER INVOICE  #4488 (Cobalt Freight Systems, MC-661004)
Load: HC-41799 · Total $1,640.00

[system: load HC-41799 already settled 05/27 against invoice #4471, same
$1,640.00, AP bill posted. This appears to be a re-send.]`,
      proposedOutput: `Load HC-41799 was already settled on 05/27 (invoice #4471, $1,640, bill
posted). Invoice #4488 is the same load and amount — almost certainly a
duplicate re-send, not a second charge.

Proposed: dispute/hold #4488 as a duplicate and notify Cobalt's AR contact.
Do not create a second AP bill.`,
      context: [
        {
          ref: "[a]",
          body: "load + amount match settled invoice #4471 (05/27)",
          createdAt: "2026-05-28T14:12:00Z",
        },
      ],
    },
    {
      id: "cir-2026-0482",
      status: "approved",
      priority: "normal",
      createdAt: "2026-05-28T08:47:55Z",
      summary:
        "Clean three-way match (invoice = rate con, POD signed, carrier in good standing) — auto-settled.",
      fields: {
        loadNo: "HC-41781",
        carrier: "Cobalt Freight Systems",
        billed: 1420,
        variance: 0,
        reason: "clean",
        score: 97,
      },
      sourceContent:
        "(auto-settled — invoice $1,420 = rate con, POD signed 05/27, MC-661004 authority active. AP bill posted to QuickBooks.)",
      proposedOutput:
        "(clean match above 0.9 floor — settled to QuickBooks with no human touch, 2026-05-28 08:48)",
      context: [
        {
          ref: "[a]",
          body: "three-way match 97% — above confidence floor, auto-passed",
          createdAt: "2026-05-28T08:47:00Z",
        },
      ],
    },
  ],
});

/* ================================================================== */
/* quote-desk — speed-to-lead, real-time RFQ intake                    */
/* ================================================================== */

const QD_APPROVE: Action = {
  id: "approve",
  label: "Approve & send",
  intent: "primary",
  appliesTo: "both",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "A",
  handler: "quote.approve",
};

const QD_ADJUST: Action = {
  id: "adjust",
  label: "Adjust rate & send",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "E",
  handler: "quote.adjust",
};

const QD_REASSIGN: Action = {
  id: "reassign",
  label: "Reassign",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  // resultingStatus omitted — reassign doesn't change lifecycle status
  hotkey: "R",
  handler: "quote.reassign",
};

const QD_DECLINE: Action = {
  id: "decline",
  label: "Decline",
  intent: "destructive",
  appliesTo: "both",
  confirm: true,
  resultingStatus: "rejected",
  hotkey: "X",
  handler: "quote.decline",
};

export const quoteDesk: Workflow = WorkflowSchema.parse({
  id: "quote-desk",
  name: "quote-desk",
  description:
    "Parses inbound shipper RFQs, anchors a rate from Halberd's historical " +
    "lanes, and drafts a ready-to-send quote so a broker can approve before a " +
    "competitor answers. Holds low-confidence or thin-history lanes for manual " +
    "pricing.",
  status: "running",
  defaultView: "table",
  confidenceFloor: 0.75,
  steps: [
    { label: "parse", status: "done" },
    { label: "rate", status: "active" },
    { label: "draft", status: "pending" },
    { label: "send", status: "pending" },
  ],
  stats: [
    { label: "PENDING", value: 8, unit: "to quote", emphasized: true },
    { label: "QUOTED // 7D", value: 96, trend: "+14 vs prior 7d" },
    { label: "AVG RESPONSE", value: "52s", unit: "RFQ → quote" },
    { label: "WIN RATE // 7D", value: "31%", unit: "quotes booked" },
  ],
  itemSchema: [
    { key: "lane", label: "Lane", type: "text" },
    { key: "equipment", label: "Equipment", type: "badge" },
    { key: "pickup", label: "Pickup", type: "datetime" },
    { key: "rate", label: "Quoted", type: "money" },
    { key: "score", label: "Confidence", type: "score" },
  ],
  availableActions: [QD_APPROVE, QD_ADJUST, QD_REASSIGN, QD_DECLINE],
  sources: [
    { id: "quotes-inbox", label: "quotes@halberd-co.com", kind: "inbox" },
    { id: "hubspot-form", label: "HubSpot RFQ form", kind: "crm" },
    { id: "lane-history", label: "Airtable lane history", kind: "database" },
  ],
  items: [
    {
      id: "qd-2026-3310",
      status: "pending",
      priority: "high",
      createdAt: "2026-05-29T16:02:44Z",
      summary:
        "Reefer, Fresno → Dallas, pickup Thu. Strong recent comps; quote ready to fire.",
      fields: {
        lane: "Fresno, CA → Dallas, TX",
        equipment: "reefer",
        pickup: "2026-06-04T08:00:00Z",
        rate: 2850,
        score: 88,
      },
      sourceContent: `From: logistics@valleypack.com
To: quotes@halberd-co.com
Subject: Need a reefer Thu — Fresno to Dallas

Hi — got a reefer load, ~42k lbs produce, Fresno to Dallas, pickup Thursday
AM, deliver Saturday. What can you do on rate? Need to book today.

— T. Okafor, Valley Pack`,
      proposedOutput: `Hi T. — yes, we can cover this.

Fresno → Dallas reefer, ~42k produce, PU Thu 6/4 AM, DEL Sat: all-in
$2,850, 2 days transit. Rate's good through end of day.

Reply "book it" and I'll dispatch a truck this afternoon.

— Halberd & Co`,
      context: [
        {
          ref: "[a]",
          body: "5 comparable Fresno→Dallas reefer lanes in last 21d: $2,720–$2,980",
          createdAt: "2026-05-29T16:02:00Z",
        },
        {
          ref: "[b]",
          body: "produce-season uplift applied (+6%) — confidence 88",
          createdAt: "2026-05-29T16:02:00Z",
        },
      ],
    },
    {
      id: "qd-2026-3309",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-29T15:47:18Z",
      summary: "Dry van, Atlanta → Charlotte, pickup Mon. Dense comps, high confidence.",
      fields: {
        lane: "Atlanta, GA → Charlotte, NC",
        equipment: "dry van",
        pickup: "2026-06-01T09:00:00Z",
        rate: 950,
        score: 92,
      },
      sourceContent: `HubSpot RFQ form — Pendleton Mfg
Lane: Atlanta, GA → Charlotte, NC
Equipment: 53' dry van · Weight: 28,000 lbs
Pickup: Monday 6/1 · Delivery: Tuesday 6/2
Notes: recurring lane, standard pallets.`,
      proposedOutput: `Hi — for the Atlanta → Charlotte dry van (28k, PU Mon 6/1, DEL Tue):
all-in $950. This is a lane we run weekly, so the rate's firm.

Happy to set this up as a recurring tender if the volume's steady.

— Halberd & Co`,
      context: [
        {
          ref: "[a]",
          body: "lane run 11× in last 30d — tight band $920–$985, confidence 92",
          createdAt: "2026-05-29T15:47:00Z",
        },
      ],
    },
    {
      id: "qd-2026-3308",
      status: "pending",
      priority: "high",
      createdAt: "2026-05-29T15:30:02Z",
      summary:
        "Flatbed spillover, Denver → Salt Lake. Thin flatbed history — held for manual pricing.",
      fields: {
        lane: "Denver, CO → Salt Lake City, UT",
        equipment: "flatbed",
        pickup: "2026-06-03T07:00:00Z",
        rate: 0,
        score: 41,
      },
      sourceContent: `From: ops@granitecole.com
To: quotes@halberd-co.com
Subject: Flatbed — Denver to SLC, building materials

Need a flatbed for palletized building materials, Denver to Salt Lake,
pickup Wed. ~46k lbs, tarped. Can you quote?

— D. Cole, Granite & Cole`,
      proposedOutput: `(rate suppressed — only 1 comparable flatbed lane on file, outside the
14-day window. Recommend a broker price this manually: Denver→SLC flatbed,
tarped, ~46k. Suggest pulling a live rate before quoting.)`,
      context: [
        {
          ref: "[a]",
          body: "flatbed is dry-van spillover for Halberd — only 1 stale comp",
          createdAt: "2026-05-29T15:30:00Z",
        },
        {
          ref: "[b]",
          body: "confidence 41 — below 0.75 floor, no auto-draft of a number",
          createdAt: "2026-05-29T15:30:00Z",
        },
      ],
    },
    {
      id: "qd-2026-3307",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-29T14:58:39Z",
      summary: "Dry van, Chicago → Columbus, pickup Tue. Solid comps, quote drafted.",
      fields: {
        lane: "Chicago, IL → Columbus, OH",
        equipment: "dry van",
        pickup: "2026-06-02T10:00:00Z",
        rate: 720,
        score: 84,
      },
      sourceContent: `From: shipping@northwind-logistics.com
Subject: Quick quote — Chicago to Columbus

Dry van, 31k lbs, PU Tue 6/2, DEL Wed. Standard freight. Rate?`,
      proposedOutput: `Hi — Chicago → Columbus dry van (31k, PU Tue 6/2, DEL Wed): all-in $720,
1 day transit. Good through tomorrow.

— Halberd & Co`,
      context: [
        {
          ref: "[a]",
          body: "6 comps last 14d: $690–$760, confidence 84",
          createdAt: "2026-05-29T14:58:00Z",
        },
      ],
    },
    {
      id: "qd-2026-3305",
      status: "approved",
      priority: "normal",
      createdAt: "2026-05-29T11:20:11Z",
      summary: "LA → Phoenix reefer quoted and sent yesterday; awaiting shipper book.",
      fields: {
        lane: "Los Angeles, CA → Phoenix, AZ",
        equipment: "reefer",
        pickup: "2026-05-31T06:00:00Z",
        rate: 1180,
        score: 90,
      },
      sourceContent: "(quoted & sent 2026-05-29 11:21 — LA→Phoenix reefer, $1,180)",
      proposedOutput: "(sent quote, $1,180 all-in)",
      context: [
        {
          ref: "[a]",
          body: "auto-eligible at 90 conf; broker approved & sent",
          createdAt: "2026-05-29T11:20:00Z",
        },
      ],
    },
  ],
});

/* ================================================================== */
/* shipper-reactivation — refresh dormant accounts                     */
/* ================================================================== */

const SR_APPROVE: Action = {
  id: "approve",
  label: "Approve & send",
  intent: "primary",
  appliesTo: "both",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "A",
  handler: "react.approve",
};

const SR_EDIT: Action = {
  id: "edit",
  label: "Edit draft",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "E",
  handler: "react.edit",
};

const SR_SKIP: Action = {
  id: "skip",
  label: "Skip",
  intent: "neutral",
  appliesTo: "both",
  confirm: false,
  resultingStatus: "skipped",
  hotkey: "S",
  handler: "react.skip",
};

const SR_ESCALATE: Action = {
  id: "escalate",
  label: "Escalate to owner",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "escalated",
  hotkey: "O",
  handler: "react.escalate",
};

export const shipperReactivation: Workflow = WorkflowSchema.parse({
  id: "shipper-reactivation",
  name: "shipper-reactivation",
  description:
    "Sweeps HubSpot and Airtable for shippers that have gone quiet and drafts a " +
    "tailored re-engagement referencing their past lanes, volume, and a fresh " +
    "rate. A broker approves, edits, or skips each draft.",
  status: "running",
  defaultView: "cards",
  confidenceFloor: 0.7,
  steps: [
    { label: "sweep", status: "done" },
    { label: "profile", status: "done" },
    { label: "draft", status: "active" },
    { label: "send", status: "pending" },
  ],
  stats: [
    { label: "DORMANT", value: 14, unit: "accounts", emphasized: true },
    { label: "REACTIVATED // 30D", value: 5, trend: "+2 vs prior 30d" },
    { label: "VOLUME AT RISK", value: "$ 88k", unit: "trailing-qtr" },
    { label: "AVG DORMANCY", value: "9w", unit: "since last tender" },
  ],
  itemSchema: [
    { key: "account", label: "Account", type: "text" },
    { key: "topLane", label: "Top lane", type: "text" },
    { key: "lastTender", label: "Last tender", type: "datetime" },
    { key: "qtrVolume", label: "Qtr volume", type: "money" },
    { key: "score", label: "Fit", type: "score" },
  ],
  availableActions: [SR_APPROVE, SR_EDIT, SR_SKIP, SR_ESCALATE],
  sources: [
    { id: "hubspot", label: "HubSpot deals", kind: "crm" },
    { id: "tender-history", label: "Airtable tender history", kind: "database" },
  ],
  items: [
    {
      id: "sr-2026-0061",
      status: "pending",
      priority: "high",
      createdAt: "2026-05-29T07:00:00Z",
      summary:
        "Pendleton Mfg — 9 weeks quiet after a steady run. $88k trailing quarter. Strong reactivation fit.",
      fields: {
        account: "Pendleton Mfg",
        topLane: "Akron, OH → Chicago, IL",
        lastTender: "2026-03-27T00:00:00Z",
        qtrVolume: 88000,
        score: 82,
      },
      sourceContent: `Account: Pendleton Mfg  ·  Owner: R. Vance
Last tender: 2026-03-27 (9 weeks ago)
Trailing-quarter volume: $88,000 across 41 loads
Top lanes: Akron→Chicago (28), Akron→Detroit (9), Akron→Columbus (4)
Pattern: steady weekly tenders Jan–Mar, then silence. No lost-reason logged.
Current Akron→Chicago dry van rate (lane history): ~$840.`,
      proposedOutput: `Hi R. — it's been a few weeks since we moved a load for Pendleton, and I
wanted to check in. We ran your Akron → Chicago lane weekly through Q1 and
had a good rhythm going.

If you've got freight moving again, that lane is sitting around $840 right
now and I can lock capacity for you. Happy to set up a standing tender so
it's hands-off on your end.

What's your week look like?

— R. Vance, Halberd & Co`,
      context: [
        {
          ref: "[a]",
          body: "9w dormant after 41 loads/qtr — clean fade, no lost-reason",
          createdAt: "2026-05-29T07:00:00Z",
        },
        {
          ref: "[b]",
          body: "Akron→Chicago current rate $840 pulled from lane history",
          createdAt: "2026-05-29T07:00:00Z",
        },
      ],
    },
    {
      id: "sr-2026-0060",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-29T07:00:00Z",
      summary: "Cedar Quarry — 7 weeks quiet, moderate volume. Worth a light touch.",
      fields: {
        account: "Cedar Quarry",
        topLane: "Cedar Rapids, IA → Kansas City, MO",
        lastTender: "2026-04-10T00:00:00Z",
        qtrVolume: 36000,
        score: 74,
      },
      sourceContent: `Account: Cedar Quarry  ·  Owner: M. Soto
Last tender: 2026-04-10 (7 weeks ago)
Trailing-quarter volume: $36,000 across 18 loads
Top lane: Cedar Rapids→Kansas City (12)
Current rate (lane history): ~$1,050.`,
      proposedOutput: `Hi — checking in from Halberd. We moved a handful of Cedar Rapids → Kansas
City loads for you this spring and things went quiet. That lane's around
$1,050 today if you've got materials moving. Want me to grab capacity for
next week?

— M. Soto, Halberd & Co`,
      context: [
        {
          ref: "[a]",
          body: "7w dormant, 18 loads/qtr — moderate fit, confidence 74",
          createdAt: "2026-05-29T07:00:00Z",
        },
      ],
    },
    {
      id: "sr-2026-0059",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-29T07:00:00Z",
      summary:
        "Birch & Lowell — erratic history, tiny volume. Low fit; recommend skip or owner judgment.",
      fields: {
        account: "Birch & Lowell",
        topLane: "(no dominant lane)",
        lastTender: "2026-02-14T00:00:00Z",
        qtrVolume: 7000,
        score: 41,
      },
      sourceContent: `Account: Birch & Lowell  ·  Owner: (unassigned)
Last tender: 2026-02-14 (15 weeks ago)
Trailing-quarter volume: $7,000 across 4 loads, all different lanes
Pattern: sporadic one-off tenders, no repeat lane. Contact bounced once.`,
      proposedOutput: `(low-confidence draft withheld — no dominant lane to anchor an offer, and
the primary contact bounced. Recommend skip, or assign an owner to verify
the contact before any outreach.)`,
      context: [
        {
          ref: "[a]",
          body: "no repeat lane + bounced contact — confidence 41, below floor",
          createdAt: "2026-05-29T07:00:00Z",
        },
      ],
    },
    {
      id: "sr-2026-0058",
      status: "approved",
      priority: "normal",
      createdAt: "2026-05-22T07:00:00Z",
      summary: "Stratton Marine — re-engagement sent last week; replied, one load booked.",
      fields: {
        account: "Stratton Marine",
        topLane: "Tacoma, WA → Portland, OR",
        lastTender: "2026-03-05T00:00:00Z",
        qtrVolume: 52000,
        score: 88,
      },
      sourceContent: "(re-engagement approved & sent 2026-05-22; reply received, 1 load tendered 2026-05-27)",
      proposedOutput: "(sent — referenced Tacoma→Portland lane + $1,310 rate)",
      context: [
        {
          ref: "[a]",
          body: "reactivated — first tender since 03/05 booked 05/27",
          createdAt: "2026-05-27T10:00:00Z",
        },
      ],
    },
  ],
});

/* ================================================================== */
/* weekly-margin-digest — internal report generation                  */
/* ================================================================== */

const WMD_APPROVE: Action = {
  id: "approve",
  label: "Approve & post",
  intent: "primary",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "A",
  handler: "digest.approve",
};

const WMD_EDIT: Action = {
  id: "edit",
  label: "Edit digest",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "E",
  handler: "digest.edit",
};

const WMD_HOLD: Action = {
  id: "hold",
  label: "Hold",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "pending",
  hotkey: "H",
  handler: "digest.hold",
};

const WMD_FLAG: Action = {
  id: "flag",
  label: "Flag for review",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  resultingStatus: "escalated",
  hotkey: "F",
  handler: "digest.flag",
};

export const weeklyMarginDigest: Workflow = WorkflowSchema.parse({
  id: "weekly-margin-digest",
  name: "weekly-margin-digest",
  description:
    "Compiles the weekly internal margin & ops digest — loads moved, gross " +
    "margin per lane, on-time %, carrier scorecards, and AR aging — from " +
    "Airtable and QuickBooks. Leadership reviews and approves before it posts " +
    "to Slack.",
  status: "idle",
  defaultView: "cards",
  confidenceFloor: 0.85,
  steps: [
    { label: "pull", status: "done" },
    { label: "compute", status: "done" },
    { label: "draft", status: "active" },
    { label: "post", status: "pending" },
  ],
  stats: [
    { label: "GROSS MARGIN // 7D", value: "$ 47k", unit: "this week", emphasized: true },
    { label: "LOADS // 7D", value: 213, trend: "+11 vs prior 7d" },
    { label: "ON-TIME", value: "94%", unit: "delivery" },
    { label: "AR > 45D", value: "$ 31k", unit: "aging" },
  ],
  itemSchema: [
    { key: "section", label: "Section", type: "badge" },
    { key: "margin", label: "Margin", type: "money" },
    { key: "loads", label: "Loads", type: "count" },
    { key: "onTime", label: "On-time", type: "text" },
    { key: "weekEnding", label: "Week ending", type: "datetime" },
  ],
  availableActions: [WMD_APPROVE, WMD_EDIT, WMD_HOLD, WMD_FLAG],
  sources: [
    { id: "airtable-loads", label: "Airtable loads/lanes", kind: "database" },
    { id: "quickbooks", label: "QuickBooks", kind: "api" },
  ],
  items: [
    {
      id: "wmd-2026-w22",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-29T20:00:00Z",
      summary:
        "Week ending 5/29 — margin +6% on +11 loads, on-time steady at 94%, AR creeping over 45d.",
      fields: {
        section: "full digest",
        margin: 47000,
        loads: 213,
        onTime: "94%",
        weekEnding: "2026-05-29T00:00:00Z",
      },
      sourceContent: `Airtable (loads/lanes), week ending 2026-05-29:
  Loads moved: 213  (prior wk 202)
  Revenue: $389,400  ·  Carrier cost: $342,100  ·  Gross margin: $47,300 (12.1%)
  On-time delivery: 94% (200/213)
  Top lanes by margin: Fresno→Dallas (reefer), Atlanta→Charlotte, Chicago→Columbus
  Carrier scorecard: Cobalt 98% OT, Granite Line 95%, Ridgeline 88% (1 layover dispute)
QuickBooks:
  AR total: $211k  ·  AR > 45d: $31k (up from $24k)  ·  2 invoices > 60d`,
      proposedOutput: `*Halberd Weekly — week ending 5/29*

• *Loads:* 213 (+11 vs prior wk)
• *Gross margin:* $47.3k (12.1%), up ~6%
• *On-time:* 94% — steady
• *Top margin lanes:* Fresno→Dallas (reefer), Atlanta→Charlotte, Chicago→Columbus
• *Carriers:* Cobalt 98% OT, Granite Line 95%; Ridgeline 88% (open layover dispute, HC-41902)
• *AR watch:* >45d aging up to $31k (from $24k); two invoices now >60d — collections should chase

_Drafted from Airtable + QuickBooks. Review before posting to #leadership._`,
      context: [
        {
          ref: "[a]",
          body: "margin +6% wk/wk driven by reefer mix (produce season)",
          createdAt: "2026-05-29T20:00:00Z",
        },
        {
          ref: "[b]",
          body: "AR >45d flagged: $31k (+$7k wk/wk) — surfaced for collections",
          createdAt: "2026-05-29T20:00:00Z",
        },
        {
          ref: "[c]",
          body: "all figures reconciled; confidence 0.9 (above 0.85 floor)",
          createdAt: "2026-05-29T20:00:00Z",
        },
      ],
    },
    {
      id: "wmd-2026-w21",
      status: "approved",
      priority: "normal",
      createdAt: "2026-05-22T20:00:00Z",
      summary: "Week ending 5/22 — approved and posted to #leadership.",
      fields: {
        section: "full digest",
        margin: 44600,
        loads: 202,
        onTime: "93%",
        weekEnding: "2026-05-22T00:00:00Z",
      },
      sourceContent: "(week ending 5/22 — posted to #leadership 2026-05-22 17:30 after edit)",
      proposedOutput: "(approved & posted; margin $44.6k, 202 loads, 93% OT)",
      context: [
        {
          ref: "[a]",
          body: "approved after a manual edit to the AR narrative",
          createdAt: "2026-05-22T17:30:00Z",
        },
      ],
    },
  ],
});

/* ------------------------------------------------------------------ */
/* All workflows — ordered to match the nav (quote-desk lands first)   */
/* ------------------------------------------------------------------ */

export const ALL_WORKFLOWS: Workflow[] = [
  quoteDesk,
  shipperReactivation,
  carrierInvoiceReconciliation,
  weeklyMarginDigest,
];

/* ------------------------------------------------------------------ */
/* Validation assertions — run with: npx tsx lib/contract/seed.ts     */
/* ------------------------------------------------------------------ */

if (require.main === module || process.env.RUN_SEED_ASSERTIONS) {
  // Flagship: bulk bar shows only the "both"-scoped actions.
  const bulk = bulkActions(carrierInvoiceReconciliation);
  console.assert(
    JSON.stringify(bulk.map((a) => a.id).sort()) ===
      JSON.stringify(["approve", "dispute", "request-docs"]),
    `CIR bulk should be [approve, dispute, request-docs], got: ${bulk
      .map((a) => a.id)
      .join(", ")}`,
  );

  // The compliance-hold item narrows actions to docs-request / dispute only.
  const heldItem = carrierInvoiceReconciliation.items.find(
    (i) => i.id === "cir-2026-0485",
  )!;
  const heldSingles = singleActions(carrierInvoiceReconciliation, heldItem);
  console.assert(
    JSON.stringify(heldSingles.map((a) => a.id).sort()) ===
      JSON.stringify(["dispute", "request-docs"]),
    `held-item singles should be [dispute, request-docs], got: ${heldSingles
      .map((a) => a.id)
      .join(", ")}`,
  );

  // intent → variant mapping is exhaustive.
  console.assert(intentToVariant.primary === "brass", "primary→brass");
  console.assert(intentToVariant.neutral === "ghost", "neutral→ghost");
  console.assert(intentToVariant.destructive === "danger", "destructive→danger");

  // reassign (quote-desk) is a non-lifecycle action — no resultingStatus.
  const reassign = quoteDesk.availableActions.find((a) => a.id === "reassign")!;
  console.assert(
    reassign.resultingStatus === undefined,
    "quote-desk reassign should not have resultingStatus",
  );

  // Hotkeys are unique within each workflow's action set.
  for (const wf of ALL_WORKFLOWS) {
    const keys = wf.availableActions
      .map((a) => a.hotkey)
      .filter((k): k is string => !!k);
    console.assert(
      new Set(keys).size === keys.length,
      `${wf.id} has duplicate hotkeys: ${keys.join(", ")}`,
    );
  }

  // All workflows parse without throwing.
  console.assert(ALL_WORKFLOWS.length === 4, "should have 4 workflows");

  console.log("OK — all seed assertions pass.");
  console.log(`  workflows:            ${ALL_WORKFLOWS.length}`);
  console.log(`  flagship items:       ${carrierInvoiceReconciliation.items.length}`);
  console.log(`  bulk actions (CIR):   ${bulk.map((a) => a.id).join(", ")}`);
  console.log(`  held-item singles:    ${heldSingles.map((a) => a.id).join(", ")}`);
}
