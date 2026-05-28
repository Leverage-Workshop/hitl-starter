/**
 * Contract-valid seed data.
 *
 * Expresses the workflows from lib/data.ts as WorkflowSchema-parsed objects.
 * Each workflow is parsed through the schema so defaults are applied and
 * validation runs at module load time (not lazily).
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

/* ------------------------------------------------------------------ */
/* rfp-intake — full workflow with items                               */
/* ------------------------------------------------------------------ */

const RFP_APPROVE: Action = {
  id: "approve",
  label: "Approve & send",
  intent: "primary",
  appliesTo: "both",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "A",
  handler: "rfp.approve",
};

const RFP_EDIT: Action = {
  id: "edit",
  label: "Edit draft",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  // resultingStatus omitted — edit doesn't change lifecycle status
  hotkey: "E",
  handler: "rfp.edit",
};

const RFP_REASSIGN: Action = {
  id: "reassign",
  label: "Reassign",
  intent: "neutral",
  appliesTo: "single",
  confirm: false,
  // resultingStatus omitted — reassign doesn't change lifecycle status
  hotkey: "R",
  handler: "rfp.reassign",
};

const RFP_REJECT: Action = {
  id: "reject",
  label: "Reject",
  intent: "destructive",
  appliesTo: "both",
  confirm: true,
  resultingStatus: "rejected",
  hotkey: "X",
  handler: "rfp.reject",
};

export const rfpIntake: Workflow = WorkflowSchema.parse({
  id: "rfp-intake",
  name: "rfp-intake",
  description:
    "Reads inbound RFP emails, drafts a first response in the studio voice, " +
    "attaches the right pricing sheet, and files the thread in the correct " +
    "CRM pipeline. Flags anything above the confidence floor for a human " +
    "decision before sending.",
  status: "running",
  defaultView: "table",
  confidenceFloor: 0.8,
  steps: [
    { label: "read", status: "done" },
    { label: "classify", status: "done" },
    { label: "draft", status: "active" },
    { label: "file", status: "pending" },
  ],
  stats: [
    { label: "PENDING", value: 12, unit: "in queue", emphasized: true },
    { label: "APPROVED // 7D", value: 34, trend: "+6 vs prior 7d" },
    { label: "AVG DECISION", value: "1m 48s", unit: "open → decide" },
    { label: "EST. VALUE // 7D", value: "$ 412k", unit: "pipeline reached" },
  ],
  itemSchema: [
    { key: "subject", label: "Subject", type: "text" },
    { key: "from", label: "From", type: "email" },
    { key: "value", label: "Value", type: "money" },
    { key: "score", label: "Score", type: "score" },
    { key: "attachments", label: "Attachments", type: "count" },
  ],
  availableActions: [RFP_APPROVE, RFP_EDIT, RFP_REASSIGN, RFP_REJECT],
  sources: [
    { id: "inbox", label: "rfp@halberd-co.com", kind: "inbox" },
    { id: "crm", label: "CRM pipeline", kind: "crm" },
  ],
  items: [
    {
      id: "rfp-2026-0142",
      status: "pending",
      priority: "high",
      createdAt: "2026-05-23T14:32:08Z",
      summary:
        "Mid-market freight broker; 12-mo telematics + driver-app rollout. Asking pricing by Fri.",
      fields: {
        subject: "Northwind Logistics — fleet telematics RFP",
        from: "procurement@northwind-logistics.com",
        value: 184000,
        score: 92,
        attachments: 6,
      },
      sourceContent: `From: procurement@northwind-logistics.com
To: rfps@halberd-co.com
Subject: RFP — fleet telematics, 12-mo pilot

Hello,

We are running a procurement cycle for a 12-month telematics rollout across our 240-unit reefer fleet, with a driver-app pilot in the first 60 days. Halberd-Co was recommended by a partner at Stratton Marine.

Required by EOW: indicative pricing band, integration notes for our Samsara fleet (we are mid-migration off Geotab), and references in cold-chain. Six attachments include our current MSA template, the IT security questionnaire, and a fleet inventory.

Best,
M. Avila — Procurement`,
      proposedOutput: `Hi M. — thanks for reaching out and for the Stratton intro.

Quick read on fit: cold-chain reefer telematics is in our wheelhouse (see Granite & Cole and Stratton case studies). The Samsara/Geotab mid-migration is the part that needs a 30-min call — we have a clean migration pattern but it depends on whether you've already cut over the driver IDs.

Indicative pricing band for a 240-unit pilot, 12 months, with the driver-app scope you described: $145k–$185k all-in, weighted to the front for the migration work. Full proposal Wednesday.

References attached. MSA redlines minor; security questionnaire returned Friday.

— J. Grant`,
      context: [
        {
          ref: "[a]",
          body: "matched against 7 known patterns — pattern 3 (mid-migration), 92% conf.",
          createdAt: "2026-05-23T14:32:00Z",
        },
        {
          ref: "[b]",
          body: "pricing band pulled from pricing-sheet-builder · v0.4.2",
          createdAt: "2026-05-23T14:32:00Z",
        },
        {
          ref: "[c]",
          body: "Stratton referral verified in CRM (deal 2026-04)",
          createdAt: "2026-05-23T14:33:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0141",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-23T13:18:55Z",
      summary:
        "Multi-clinic group; wants a triage assistant. Light brief, no security questionnaire yet.",
      fields: {
        subject: "Hibiscus Health Group — patient-intake workflow",
        from: "cto@hibiscushealth.org",
        value: 64000,
        score: 78,
        attachments: 2,
      },
      sourceContent: `From: cto@hibiscushealth.org
To: rfps@halberd-co.com
Subject: Quick question — patient intake

Hi — found you via the Foundry case study. We run six clinics and the front-desk intake is killing us. Could you scope a small assistant similar to what you did for Foundry, but for HIPAA-bound patient intake?

— R. Castellanos, CTO`,
      proposedOutput: `Hi R. — happy to scope this. Patient intake adjacent to Foundry is plausible, but HIPAA changes the deployment surface materially (BAA, on-prem inference for any PHI touched, audit trail).

Proposed: a 1-week paid diagnostic to draw the current intake flow at one of the six clinics and identify the 3–4 frictions worth automating. Output is a diagram + scoped build proposal. $9k flat. If we proceed to build, the diagnostic cost rolls into the build SOW.

Calendar link below. The earlier we can sit with front-desk staff for 2 hours, the better.

— J. Grant`,
      context: [
        {
          ref: "[a]",
          body: "HIPAA flag — auto-routes to \"regulated\" subqueue on approve",
          createdAt: "2026-05-23T13:18:00Z",
        },
        {
          ref: "[b]",
          body: "Foundry referral verified; no BAA on file yet",
          createdAt: "2026-05-23T13:19:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0140",
      status: "pending",
      priority: "flagged",
      createdAt: "2026-05-23T11:47:02Z",
      summary:
        "Existing client, expansion ask is materially larger than y1 scope. Flagged for senior review.",
      fields: {
        subject: "Granite & Cole — scope expansion, year 2",
        from: "ops@granitecole.com",
        value: 220000,
        score: 64,
        attachments: 3,
      },
      sourceContent: `From: ops@granitecole.com
To: rfps@halberd-co.com
Subject: Y2 expansion — broader scope

Hi J. — really happy with the dispatch assistant. For year 2 we'd like to expand to: (1) driver onboarding chat, (2) maintenance scheduler, (3) customer-comm rewriter, plus a shared dashboard. Three attachments with detail.

— D. Cole`,
      proposedOutput: `Hi D. — glad it's working.

Three things at once is more than I'd usually take on solo. Honest framing: I can ship (2) maintenance scheduler in 6 weeks given the data shape I already know, but (1) and (3) need their own diagnostics — driver onboarding has a regulatory layer I haven't measured, and (3) is a tone-of-voice problem that's only worth solving if we can measure it.

Counter-proposal: sequence them. Maint. scheduler now, onboarding diagnostic in parallel, customer-comm last. Total y2 spend lands close to your number; risk profile is much lower.

— J. Grant`,
      // existing client can't be "rejected" — narrows actions
      actions: [RFP_APPROVE, RFP_EDIT, RFP_REASSIGN],
      context: [
        {
          ref: "[a]",
          body: "scope >2× year 1 — flagged per workflow rule \"expansion_ratio\"",
          createdAt: "2026-05-23T11:47:00Z",
        },
        {
          ref: "[b]",
          body: "draft confidence 64% — below auto-send threshold (80%)",
          createdAt: "2026-05-23T11:47:00Z",
        },
        {
          ref: "[c]",
          body: "recommend reviewer: J. Grant (owner of y1 engagement)",
          createdAt: "2026-05-23T11:48:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0139",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-23T10:11:43Z",
      summary: "Inbound RFP with broken attachments. Needs human reach-out.",
      fields: {
        subject: "Vandermeer Industries — attachment fetch failed",
        from: "rfp@vandermeer.de",
        value: 0,
        score: 0,
        attachments: 0,
      },
      sourceContent: `From: rfp@vandermeer.de
To: rfps@halberd-co.com
Subject: RFP packet — Vandermeer Industries

Please find attached our 2026 RFP packet (4 documents).

[system: attachment fetch returned 502 — no documents retrieved]`,
      proposedOutput: `(draft suppressed — no source material available)

Suggested human action: reply requesting the packet be re-sent via the secure-share link in our footer, or scheduled with the sender for a 15-min walk-through.`,
      context: [
        {
          ref: "[a]",
          body: "attachment fetch 502 — retried 3×, all failed",
          createdAt: "2026-05-23T10:11:00Z",
        },
        {
          ref: "[b]",
          body: "draft suppressed — workflow rule \"no_source_no_draft\"",
          createdAt: "2026-05-23T10:11:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0138",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-23T09:04:17Z",
      summary:
        "Tight brief, known buyer pattern. Confidence 84%, auto-drafted reply ready.",
      fields: {
        subject: "Foundry & Sons — invoice tooling, 1-page brief",
        from: "finance@foundryandsons.com",
        value: 48000,
        score: 84,
        attachments: 1,
      },
      sourceContent: `From: finance@foundryandsons.com
To: rfps@halberd-co.com
Subject: One-pager — AP reconciliation

J. — quick one. We need to cut the time my AP clerk spends matching POs to invoices. ~8 hrs/wk now. Can you scope?

— S. Foundry`,
      proposedOutput: `Hi S. — yes, this is a small, well-shaped problem.

Diagnostic week first (paid, $9k). I'll sit with the AP clerk for two of those eight hours, map what they're actually doing, and we'll know within four days whether automation gets you to 1 hr/wk or 4 hrs/wk. The build, if we proceed, is 4–6 weeks at $32–48k depending on the shape of your ERP integration.

Calendar link below.

— J. Grant`,
      context: [
        {
          ref: "[a]",
          body: "matched pattern 1 (existing client small-scope) — 84% conf.",
          createdAt: "2026-05-23T09:04:00Z",
        },
        {
          ref: "[b]",
          body: "pricing pulled from \"diagnostic-then-build\" template",
          createdAt: "2026-05-23T09:04:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0137",
      status: "approved",
      priority: "normal",
      createdAt: "2026-05-22T18:50:11Z",
      summary: "Referral from existing engagement; approved & sent yesterday.",
      fields: {
        subject: "Stratton Marine — referral follow-up",
        from: "k.stratton@strattonmarine.com",
        value: 72000,
        score: 91,
        attachments: 4,
      },
      sourceContent: "(see thread #2026-0117 — approved by jgrant 18:50)",
      proposedOutput: "(sent reply, 2026-05-22 18:51)",
      context: [
        {
          ref: "[a]",
          body: "auto-approved on threshold — confidence 91%",
          createdAt: "2026-05-22T18:50:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0136",
      status: "rejected",
      priority: "flagged",
      createdAt: "2026-05-22T16:34:29Z",
      summary: "Civic outreach unrelated to studio scope. Rejected with referral.",
      fields: {
        subject: "Orca Civic — out-of-scope solicitation",
        from: "partnerships@orcacivic.org",
        value: 0,
        score: 22,
        attachments: 2,
      },
      sourceContent: "(rejected as out-of-scope by jgrant 16:34)",
      proposedOutput: "(declined-with-referral template, sent 2026-05-22 16:35)",
      context: [
        {
          ref: "[a]",
          body: "flagged as out-of-scope by \"domain_match\" rule",
          createdAt: "2026-05-22T16:34:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0135",
      status: "pending",
      priority: "high",
      createdAt: "2026-05-22T15:02:48Z",
      summary:
        "Proposed change to routing rule \"expansion_ratio\". Needs operator sign-off.",
      fields: {
        subject: "Halberd internal — RFP routing rule change",
        from: "ops@halberd-co.com",
        value: 0,
        score: 88,
        attachments: 1,
      },
      sourceContent: `From: ops@halberd-co.com
Subject: Proposed rule change — expansion_ratio threshold

Currently flags any scope expansion ≥ 2× prior year. Proposing 1.75×. Single attachment with 90-day backtest.`,
      proposedOutput: `Approve — backtest shows 1.75× catches the two near-misses from Q1 without adding false positives. Recommend approve and re-baseline in 60 days.`,
      context: [
        {
          ref: "[a]",
          body: "internal item — does not count against external SLA",
          createdAt: "2026-05-22T15:02:00Z",
        },
        {
          ref: "[b]",
          body: "backtest reviewed — 0 new false positives in 90d",
          createdAt: "2026-05-22T15:03:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0134",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-22T11:18:09Z",
      summary:
        "Asking for \"AI strategy\" — too broad for the studio template. Needs scoping reply.",
      fields: {
        subject: "Birch & Lowell — broad consulting ask",
        from: "cmo@birchlowell.com",
        value: 90000,
        score: 41,
        attachments: 2,
      },
      sourceContent: `From: cmo@birchlowell.com
Subject: AI strategy engagement

We'd like to engage you for an AI strategy across our marketing org. Budget ~$90k. Two attachments outline our brand goals for 2026.`,
      proposedOutput: `Hi — appreciate the note. The studio doesn't take strategy engagements — every build I run starts with a 1-week diagnostic of one specific recurring task, not a roadmap.

If there's one task in your marketing ops that takes >5 hours of someone's week and feels mechanical, I'd love to hear about it specifically. Otherwise, two friends I'd recommend for the strategy work: [redacted] and [redacted].

— J. Grant`,
      context: [
        {
          ref: "[a]",
          body: "pattern 6 — \"strategy ask without specific task\"",
          createdAt: "2026-05-22T11:18:00Z",
        },
        {
          ref: "[b]",
          body: "draft uses decline-with-referral template",
          createdAt: "2026-05-22T11:18:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0133",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-22T09:47:55Z",
      summary:
        "Looks like a duplicate of thread 2026-05-19/0042. Confirm before drafting.",
      fields: {
        subject: "Cedar Quarry — repeat sender, deduped",
        from: "rfp@cedarquarry.com",
        value: 36000,
        score: 73,
        attachments: 3,
      },
      sourceContent: `From: rfp@cedarquarry.com
Subject: RFP packet (resend)

(this thread appears to be a resend of the earlier 2026-05-19 packet)`,
      proposedOutput: "(awaiting dedup confirmation — no draft generated)",
      context: [
        {
          ref: "[a]",
          body: "subject + sender match thread 2026-05-19/0042",
          createdAt: "2026-05-22T09:47:00Z",
        },
        {
          ref: "[b]",
          body: "attachments hash identical — recommend dedup",
          createdAt: "2026-05-22T09:48:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0132",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-21T17:22:14Z",
      summary: "Wants an on-site diagnostic week. Travel scoping needed.",
      fields: {
        subject: "Pendleton Mfg — site walkthrough request",
        from: "plant.mgr@pendletonmfg.com",
        value: 110000,
        score: 70,
        attachments: 5,
      },
      sourceContent: `From: plant.mgr@pendletonmfg.com
Subject: Site walkthrough — June

J. — Pendleton would like you on-site for a diagnostic week, mid-June. We are in Akron. Five attachments include our floor plan and shift schedule.`,
      proposedOutput: `Hi — yes, I do on-site diagnostics. Akron in June works. I'd propose Monday–Thursday on-site (32 hrs in the plant), Friday remote for the writeup. Travel + lodging billed at cost, separate from the $9k diagnostic fee.

Holding June 15–19 for you pending confirmation by Thursday.

— J. Grant`,
      context: [
        {
          ref: "[a]",
          body: "on-site flag — travel quote auto-attached on send",
          createdAt: "2026-05-21T17:22:00Z",
        },
      ],
    },
    {
      id: "rfp-2026-0131",
      status: "pending",
      priority: "normal",
      createdAt: "2026-05-21T14:09:33Z",
      summary: "Security questionnaire prereq. 8 attachments, mostly forms.",
      fields: {
        subject: "Linwood Capital — vendor security review",
        from: "security@linwoodcap.com",
        value: 0,
        score: 80,
        attachments: 8,
      },
      sourceContent: `Standard vendor security review packet — 8 forms including SOC2 attestations, subprocessor list, data-flow diagram. Response due 7 days from receipt.`,
      proposedOutput: `(forms pre-populated from security-vault template; 6/8 ready for review, 2 require human input — see flagged fields in vault)`,
      context: [
        {
          ref: "[a]",
          body: "6 of 8 forms auto-completed from template",
          createdAt: "2026-05-21T14:09:00Z",
        },
        {
          ref: "[b]",
          body: "2 forms flagged: subprocessor list (new vendor added Apr), DPA section 4.2",
          createdAt: "2026-05-21T14:09:00Z",
        },
      ],
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Stub workflows (nav items without full item sets)                   */
/* ------------------------------------------------------------------ */

const GENERIC_APPROVE: Action = {
  id: "approve",
  label: "Approve",
  intent: "primary",
  appliesTo: "both",
  confirm: false,
  resultingStatus: "approved",
  hotkey: "A",
  handler: "generic.approve",
};

const GENERIC_REJECT: Action = {
  id: "reject",
  label: "Reject",
  intent: "destructive",
  appliesTo: "both",
  confirm: true,
  resultingStatus: "rejected",
  hotkey: "X",
  handler: "generic.reject",
};

export const invoiceReconciler: Workflow = WorkflowSchema.parse({
  id: "invoice-reconciler",
  name: "invoice-reconciler",
  description:
    "Matches purchase orders to inbound invoices, flags discrepancies, " +
    "and routes exceptions for human review before posting.",
  status: "running",
  itemSchema: [
    { key: "vendor", label: "Vendor", type: "text" },
    { key: "amount", label: "Amount", type: "money" },
    { key: "score", label: "Match", type: "score" },
  ],
  availableActions: [GENERIC_APPROVE, GENERIC_REJECT],
  stats: [{ label: "PENDING", value: 7, unit: "in queue", emphasized: true }],
});

export const leadQualifier: Workflow = WorkflowSchema.parse({
  id: "lead-qualifier",
  name: "lead-qualifier",
  description:
    "Scores inbound leads against ICP criteria and routes qualified " +
    "leads to the CRM with a recommended next action.",
  status: "running",
  itemSchema: [
    { key: "company", label: "Company", type: "text" },
    { key: "email", label: "Email", type: "email" },
    { key: "score", label: "ICP Score", type: "score" },
  ],
  availableActions: [GENERIC_APPROVE, GENERIC_REJECT],
  stats: [{ label: "PENDING", value: 18, unit: "in queue", emphasized: true }],
});

export const ticketTriage: Workflow = WorkflowSchema.parse({
  id: "ticket-triage",
  name: "ticket-triage",
  description:
    "Classifies inbound support tickets by product area and urgency, " +
    "drafts an initial response, and routes to the right queue.",
  status: "running",
  itemSchema: [
    { key: "subject", label: "Subject", type: "text" },
    { key: "from", label: "From", type: "email" },
    { key: "score", label: "Urgency", type: "score" },
  ],
  availableActions: [GENERIC_APPROVE, GENERIC_REJECT],
  stats: [{ label: "PENDING", value: 3, unit: "in queue", emphasized: true }],
});

export const onCallSummarizer: Workflow = WorkflowSchema.parse({
  id: "on-call-summarizer",
  name: "on-call-summarizer",
  description:
    "Produces a daily on-call summary from PagerDuty incidents and " +
    "Slack threads, ready for the ops standup.",
  status: "idle",
  itemSchema: [
    { key: "date", label: "Date", type: "datetime" },
    { key: "incidents", label: "Incidents", type: "count" },
  ],
  availableActions: [GENERIC_APPROVE],
  stats: [{ label: "PENDING", value: 0, unit: "in queue", emphasized: true }],
});

export const weeklyOpsDigest: Workflow = WorkflowSchema.parse({
  id: "weekly-ops-digest",
  name: "weekly-ops-digest",
  description:
    "Compiles the weekly ops digest from Notion, Linear, and Slack " +
    "activity, formatted for the Friday all-hands.",
  status: "idle",
  itemSchema: [
    { key: "week", label: "Week", type: "datetime" },
    { key: "sections", label: "Sections", type: "count" },
  ],
  availableActions: [GENERIC_APPROVE],
  stats: [{ label: "PENDING", value: 0, unit: "in queue", emphasized: true }],
});

export const churnSignalWatcher: Workflow = WorkflowSchema.parse({
  id: "churn-signal-watcher",
  name: "churn-signal-watcher",
  description:
    "Monitors product usage and support patterns for churn signals, " +
    "surfacing at-risk accounts for CSM review.",
  status: "paused",
  itemSchema: [
    { key: "account", label: "Account", type: "text" },
    { key: "score", label: "Risk", type: "score" },
  ],
  availableActions: [GENERIC_APPROVE, GENERIC_REJECT],
  stats: [{ label: "PENDING", value: 0, unit: "in queue", emphasized: true }],
});

export const pricingSheetBuilder: Workflow = WorkflowSchema.parse({
  id: "pricing-sheet-builder",
  name: "pricing-sheet-builder",
  description:
    "Assembles custom pricing sheets from approved templates, " +
    "surfaces them for human review before attaching to proposals.",
  status: "running",
  itemSchema: [
    { key: "client", label: "Client", type: "text" },
    { key: "total", label: "Total", type: "money" },
  ],
  availableActions: [GENERIC_APPROVE, GENERIC_REJECT],
  stats: [{ label: "PENDING", value: 2, unit: "in queue", emphasized: true }],
});

/* ------------------------------------------------------------------ */
/* All workflows — ordered to match the nav in lib/data.ts            */
/* ------------------------------------------------------------------ */

export const ALL_WORKFLOWS: Workflow[] = [
  rfpIntake,
  invoiceReconciler,
  leadQualifier,
  ticketTriage,
  onCallSummarizer,
  weeklyOpsDigest,
  churnSignalWatcher,
  pricingSheetBuilder,
];

/* ------------------------------------------------------------------ */
/* Validation assertions — run with: npx tsx lib/contract/seed.ts     */
/* ------------------------------------------------------------------ */

if (require.main === module || process.env.RUN_SEED_ASSERTIONS) {
  const bulk = bulkActions(rfpIntake);
  const item2 = rfpIntake.items[2]; // Granite & Cole — narrowed to approve+edit+reassign
  const singles = singleActions(rfpIntake, item2);

  console.assert(
    JSON.stringify(bulk.map((a) => a.id).sort()) ===
      JSON.stringify(["approve", "reject"]),
    `bulk should be [approve, reject], got: ${bulk.map((a) => a.id).join(", ")}`,
  );

  console.assert(
    JSON.stringify(singles.map((a) => a.id).sort()) ===
      JSON.stringify(["approve", "edit", "reassign"]),
    `item2 singles should be [approve, edit, reassign], got: ${singles.map((a) => a.id).join(", ")}`,
  );

  // intent → variant mapping is exhaustive
  console.assert(intentToVariant.primary === "brass", "primary→brass");
  console.assert(intentToVariant.neutral === "ghost", "neutral→ghost");
  console.assert(intentToVariant.destructive === "danger", "destructive→danger");

  // edit/reassign have no resultingStatus
  const edit = rfpIntake.availableActions.find((a) => a.id === "edit")!;
  const reassign = rfpIntake.availableActions.find((a) => a.id === "reassign")!;
  console.assert(
    edit.resultingStatus === undefined,
    "edit should not have resultingStatus",
  );
  console.assert(
    reassign.resultingStatus === undefined,
    "reassign should not have resultingStatus",
  );

  // all workflows parse without throwing
  console.assert(ALL_WORKFLOWS.length === 8, "should have 8 workflows");

  console.log("OK — all seed assertions pass.");
  console.log(`  workflows:       ${ALL_WORKFLOWS.length}`);
  console.log(`  rfp-intake items: ${rfpIntake.items.length}`);
  console.log(`  bulk actions:    ${bulk.map((a) => a.id).join(", ")}`);
  console.log(`  item2 singles:   ${singles.map((a) => a.id).join(", ")}`);
}
