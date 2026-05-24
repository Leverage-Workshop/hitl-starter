/* ============================================================
   Seed data — rfp-intake review queue.

   This file is THE extension point for forking the starter:
   - swap WORKFLOWS / ACTIVE_WORKFLOW / ITEMS to model your own queue
   - swap ACTION_SET to change the decision buttons on the flyout
   - the rest of the app is generic.
   ============================================================ */

// -- client identity ------------------------------------------
// This console is a per-client, white-label deployment. CLIENT
// is the company the instance is FOR — change it when you fork.
// Appears in the top-left of the app header and on the login page.
const CLIENT = {
  name:  'Halberd Co',     // human-readable, shown in the header
  slug:  'halberd-co',     // used wherever a token is needed
};

const WORKFLOWS = [
  { id: 'rfp-intake',           name: 'rfp-intake',           pending: 12, status: 'running', cadence: '40/wk' },
  { id: 'invoice-reconciler',   name: 'invoice-reconciler',   pending: 7,  status: 'running', cadence: '220/mo' },
  { id: 'lead-qualifier',       name: 'lead-qualifier',       pending: 18, status: 'running', cadence: '60/wk' },
  { id: 'ticket-triage',        name: 'ticket-triage',        pending: 3,  status: 'running', cadence: '180/wk' },
  { id: 'on-call-summarizer',   name: 'on-call-summarizer',   pending: 0,  status: 'idle',    cadence: '14/wk' },
  { id: 'weekly-ops-digest',    name: 'weekly-ops-digest',    pending: 0,  status: 'idle',    cadence: '1/wk' },
  { id: 'churn-signal-watcher', name: 'churn-signal-watcher', pending: 0,  status: 'off',     cadence: '—' },
  { id: 'pricing-sheet-builder',name: 'pricing-sheet-builder',pending: 2,  status: 'running', cadence: '6/wk' },
];

const ACTIVE_WORKFLOW_ID = 'rfp-intake';

// -- review items (one row in table view, one card in cards view)
//
// shape:
//   id           — short identifier, shown in mono
//   status       — pending | approved | rejected | escalated
//   priority     — high | normal | flagged   (drives card color stripe)
//   submitted    — ISO timestamp (formatted at render time)
//   subject      — short title for the item
//   from         — counterparty / requester
//   value        — domain-specific scalar (here: deal size, USD)
//   score        — model confidence 0–100
//   attachments  — count
//   summary      — one-line summary for cards
//   source       — left pane: the raw input
//   draft        — right pane: the AI-proposed action (for two-pane review)
//   notes        — marginalia entries shown beside the body
//
const ITEMS = [
  {
    id: 'rfp-2026-0142',
    status: 'pending', priority: 'high',
    submitted: '2026-05-23T14:32:08',
    subject: 'Northwind Logistics — fleet telematics RFP',
    from: 'procurement@northwind-logistics.com',
    value: 184000, score: 92, attachments: 6,
    summary: 'Mid-market freight broker; 12-mo telematics + driver-app rollout. Asking pricing by Fri.',
    source: `From: procurement@northwind-logistics.com
To: rfps@halberd-co.com
Subject: RFP — fleet telematics, 12-mo pilot

Hello,

We are running a procurement cycle for a 12-month telematics rollout across our 240-unit reefer fleet, with a driver-app pilot in the first 60 days. Halberd-Co was recommended by a partner at Stratton Marine.

Required by EOW: indicative pricing band, integration notes for our Samsara fleet (we are mid-migration off Geotab), and references in cold-chain. Six attachments include our current MSA template, the IT security questionnaire, and a fleet inventory.

Best,
M. Avila — Procurement`,
    draft: `Hi M. — thanks for reaching out and for the Stratton intro.

Quick read on fit: cold-chain reefer telematics is in our wheelhouse (see Granite & Cole and Stratton case studies). The Samsara/Geotab mid-migration is the part that needs a 30-min call — we have a clean migration pattern but it depends on whether you've already cut over the driver IDs.

Indicative pricing band for a 240-unit pilot, 12 months, with the driver-app scope you described: $145k–$185k all-in, weighted to the front for the migration work. Full proposal Wednesday.

References attached. MSA redlines minor; security questionnaire returned Friday.

— J. Grant`,
    notes: [
      { tag: 'a', ts: '14:32', body: 'matched against 7 known patterns — pattern 3 (mid-migration), 92% conf.' },
      { tag: 'b', ts: '14:32', body: 'pricing band pulled from pricing-sheet-builder · v0.4.2' },
      { tag: 'c', ts: '14:33', body: 'Stratton referral verified in CRM (deal 2026-04)' },
    ],
  },
  {
    id: 'rfp-2026-0141',
    status: 'pending', priority: 'normal',
    submitted: '2026-05-23T13:18:55',
    subject: 'Hibiscus Health Group — patient-intake workflow',
    from: 'cto@hibiscushealth.org',
    value: 64000, score: 78, attachments: 2,
    summary: 'Multi-clinic group; wants a triage assistant. Light brief, no security questionnaire yet.',
    source: `From: cto@hibiscushealth.org
To: rfps@halberd-co.com
Subject: Quick question — patient intake

Hi — found you via the Foundry case study. We run six clinics and the front-desk intake is killing us. Could you scope a small assistant similar to what you did for Foundry, but for HIPAA-bound patient intake?

— R. Castellanos, CTO`,
    draft: `Hi R. — happy to scope this. Patient intake adjacent to Foundry is plausible, but HIPAA changes the deployment surface materially (BAA, on-prem inference for any PHI touched, audit trail).

Proposed: a 1-week paid diagnostic to draw the current intake flow at one of the six clinics and identify the 3–4 frictions worth automating. Output is a diagram + scoped build proposal. $9k flat. If we proceed to build, the diagnostic cost rolls into the build SOW.

Calendar link below. The earlier we can sit with front-desk staff for 2 hours, the better.

— J. Grant`,
    notes: [
      { tag: 'a', ts: '13:18', body: 'HIPAA flag — auto-routes to "regulated" subqueue on approve' },
      { tag: 'b', ts: '13:19', body: 'Foundry referral verified; no BAA on file yet' },
    ],
  },
  {
    id: 'rfp-2026-0140',
    status: 'pending', priority: 'flagged',
    submitted: '2026-05-23T11:47:02',
    subject: 'Granite & Cole — scope expansion, year 2',
    from: 'ops@granitecole.com',
    value: 220000, score: 64, attachments: 3,
    summary: 'Existing client, expansion ask is materially larger than y1 scope. Flagged for senior review.',
    source: `From: ops@granitecole.com
To: rfps@halberd-co.com
Subject: Y2 expansion — broader scope

Hi J. — really happy with the dispatch assistant. For year 2 we'd like to expand to: (1) driver onboarding chat, (2) maintenance scheduler, (3) customer-comm rewriter, plus a shared dashboard. Three attachments with detail.

— D. Cole`,
    draft: `Hi D. — glad it's working.

Three things at once is more than I'd usually take on solo. Honest framing: I can ship (2) maintenance scheduler in 6 weeks given the data shape I already know, but (1) and (3) need their own diagnostics — driver onboarding has a regulatory layer I haven't measured, and (3) is a tone-of-voice problem that's only worth solving if we can measure it.

Counter-proposal: sequence them. Maint. scheduler now, onboarding diagnostic in parallel, customer-comm last. Total y2 spend lands close to your number; risk profile is much lower.

— J. Grant`,
    notes: [
      { tag: 'a', ts: '11:47', body: 'scope >2× year 1 — flagged per workflow rule "expansion_ratio"' },
      { tag: 'b', ts: '11:47', body: 'draft confidence 64% — below auto-send threshold (80%)' },
      { tag: 'c', ts: '11:48', body: 'recommend reviewer: J. Grant (owner of y1 engagement)' },
    ],
  },
  {
    id: 'rfp-2026-0139',
    status: 'pending', priority: 'normal',
    submitted: '2026-05-23T10:11:43',
    subject: 'Vandermeer Industries — attachment fetch failed',
    from: 'rfp@vandermeer.de',
    value: 0, score: 0, attachments: 0,
    summary: 'Inbound RFP with broken attachments. Needs human reach-out.',
    source: `From: rfp@vandermeer.de
To: rfps@halberd-co.com
Subject: RFP packet — Vandermeer Industries

Please find attached our 2026 RFP packet (4 documents).

[system: attachment fetch returned 502 — no documents retrieved]`,
    draft: `(draft suppressed — no source material available)

Suggested human action: reply requesting the packet be re-sent via the secure-share link in our footer, or scheduled with the sender for a 15-min walk-through.`,
    notes: [
      { tag: 'a', ts: '10:11', body: 'attachment fetch 502 — retried 3×, all failed' },
      { tag: 'b', ts: '10:11', body: 'draft suppressed — workflow rule "no_source_no_draft"' },
    ],
  },
  {
    id: 'rfp-2026-0138',
    status: 'pending', priority: 'normal',
    submitted: '2026-05-23T09:04:17',
    subject: 'Foundry & Sons — invoice tooling, 1-page brief',
    from: 'finance@foundryandsons.com',
    value: 48000, score: 84, attachments: 1,
    summary: 'Tight brief, known buyer pattern. Confidence 84%, auto-drafted reply ready.',
    source: `From: finance@foundryandsons.com
To: rfps@halberd-co.com
Subject: One-pager — AP reconciliation

J. — quick one. We need to cut the time my AP clerk spends matching POs to invoices. ~8 hrs/wk now. Can you scope?

— S. Foundry`,
    draft: `Hi S. — yes, this is a small, well-shaped problem.

Diagnostic week first (paid, $9k). I'll sit with the AP clerk for two of those eight hours, map what they're actually doing, and we'll know within four days whether automation gets you to 1 hr/wk or 4 hrs/wk. The build, if we proceed, is 4–6 weeks at $32–48k depending on the shape of your ERP integration.

Calendar link below.

— J. Grant`,
    notes: [
      { tag: 'a', ts: '09:04', body: 'matched pattern 1 (existing client small-scope) — 84% conf.' },
      { tag: 'b', ts: '09:04', body: 'pricing pulled from "diagnostic-then-build" template' },
    ],
  },
  {
    id: 'rfp-2026-0137',
    status: 'approved', priority: 'normal',
    submitted: '2026-05-22T18:50:11',
    subject: 'Stratton Marine — referral follow-up',
    from: 'k.stratton@strattonmarine.com',
    value: 72000, score: 91, attachments: 4,
    summary: 'Referral from existing engagement; approved & sent yesterday.',
    source: `(see thread #2026-0117 — approved by jgrant 18:50)`,
    draft: `(sent reply, 2026-05-22 18:51)`,
    notes: [
      { tag: 'a', ts: '18:50', body: 'auto-approved on threshold — confidence 91%' },
    ],
  },
  {
    id: 'rfp-2026-0136',
    status: 'rejected', priority: 'flagged',
    submitted: '2026-05-22T16:34:29',
    subject: 'Orca Civic — out-of-scope solicitation',
    from: 'partnerships@orcacivic.org',
    value: 0, score: 22, attachments: 2,
    summary: 'Civic outreach unrelated to studio scope. Rejected with referral.',
    source: `(rejected as out-of-scope by jgrant 16:34)`,
    draft: `(declined-with-referral template, sent 2026-05-22 16:35)`,
    notes: [
      { tag: 'a', ts: '16:34', body: 'flagged as out-of-scope by "domain_match" rule' },
    ],
  },
  {
    id: 'rfp-2026-0135',
    status: 'pending', priority: 'high',
    submitted: '2026-05-22T15:02:48',
    subject: 'Halberd internal — RFP routing rule change',
    from: 'ops@halberd-co.com',
    value: 0, score: 88, attachments: 1,
    summary: 'Proposed change to routing rule "expansion_ratio". Needs operator sign-off.',
    source: `From: ops@halberd-co.com
Subject: Proposed rule change — expansion_ratio threshold

Currently flags any scope expansion ≥ 2× prior year. Proposing 1.75×. Single attachment with 90-day backtest.`,
    draft: `Approve — backtest shows 1.75× catches the two near-misses from Q1 without adding false positives. Recommend approve and re-baseline in 60 days.`,
    notes: [
      { tag: 'a', ts: '15:02', body: 'internal item — does not count against external SLA' },
      { tag: 'b', ts: '15:03', body: 'backtest reviewed — 0 new false positives in 90d' },
    ],
  },
  {
    id: 'rfp-2026-0134',
    status: 'pending', priority: 'normal',
    submitted: '2026-05-22T11:18:09',
    subject: 'Birch & Lowell — broad consulting ask',
    from: 'cmo@birchlowell.com',
    value: 90000, score: 41, attachments: 2,
    summary: 'Asking for "AI strategy" — too broad for the studio template. Needs scoping reply.',
    source: `From: cmo@birchlowell.com
Subject: AI strategy engagement

We'd like to engage you for an AI strategy across our marketing org. Budget ~$90k. Two attachments outline our brand goals for 2026.`,
    draft: `Hi — appreciate the note. The studio doesn't take strategy engagements — every build I run starts with a 1-week diagnostic of one specific recurring task, not a roadmap.

If there's one task in your marketing ops that takes >5 hours of someone's week and feels mechanical, I'd love to hear about it specifically. Otherwise, two friends I'd recommend for the strategy work: [redacted] and [redacted].

— J. Grant`,
    notes: [
      { tag: 'a', ts: '11:18', body: 'pattern 6 — "strategy ask without specific task"' },
      { tag: 'b', ts: '11:18', body: 'draft uses decline-with-referral template' },
    ],
  },
  {
    id: 'rfp-2026-0133',
    status: 'pending', priority: 'normal',
    submitted: '2026-05-22T09:47:55',
    subject: 'Cedar Quarry — repeat sender, deduped',
    from: 'rfp@cedarquarry.com',
    value: 36000, score: 73, attachments: 3,
    summary: 'Looks like a duplicate of thread 2026-05-19/0042. Confirm before drafting.',
    source: `From: rfp@cedarquarry.com
Subject: RFP packet (resend)

(this thread appears to be a resend of the earlier 2026-05-19 packet)`,
    draft: `(awaiting dedup confirmation — no draft generated)`,
    notes: [
      { tag: 'a', ts: '09:47', body: 'subject + sender match thread 2026-05-19/0042' },
      { tag: 'b', ts: '09:48', body: 'attachments hash identical — recommend dedup' },
    ],
  },
  {
    id: 'rfp-2026-0132',
    status: 'pending', priority: 'normal',
    submitted: '2026-05-21T17:22:14',
    subject: 'Pendleton Mfg — site walkthrough request',
    from: 'plant.mgr@pendletonmfg.com',
    value: 110000, score: 70, attachments: 5,
    summary: 'Wants an on-site diagnostic week. Travel scoping needed.',
    source: `From: plant.mgr@pendletonmfg.com
Subject: Site walkthrough — June

J. — Pendleton would like you on-site for a diagnostic week, mid-June. We are in Akron. Five attachments include our floor plan and shift schedule.`,
    draft: `Hi — yes, I do on-site diagnostics. Akron in June works. I'd propose Monday–Thursday on-site (32 hrs in the plant), Friday remote for the writeup. Travel + lodging billed at cost, separate from the $9k diagnostic fee.

Holding June 15–19 for you pending confirmation by Thursday.

— J. Grant`,
    notes: [
      { tag: 'a', ts: '17:22', body: 'on-site flag — travel quote auto-attached on send' },
    ],
  },
  {
    id: 'rfp-2026-0131',
    status: 'pending', priority: 'normal',
    submitted: '2026-05-21T14:09:33',
    subject: 'Linwood Capital — vendor security review',
    from: 'security@linwoodcap.com',
    value: 0, score: 80, attachments: 8,
    summary: 'Security questionnaire prereq. 8 attachments, mostly forms.',
    source: `Standard vendor security review packet — 8 forms including SOC2 attestations, subprocessor list, data-flow diagram. Response due 7 days from receipt.`,
    draft: `(forms pre-populated from security-vault template; 6/8 ready for review, 2 require human input — see flagged fields in vault)`,
    notes: [
      { tag: 'a', ts: '14:09', body: '6 of 8 forms auto-completed from template' },
      { tag: 'b', ts: '14:09', body: '2 forms flagged: subprocessor list (new vendor added Apr), DPA section 4.2' },
    ],
  },
];

// -- action set for the flyout decision bar -------------------
// Swap this when you fork the starter. Each action has:
//   key      — used internally + as a keyboard hint
//   label    — what's shown on the button
//   variant  — 'brass' (primary), 'ghost' (default), 'danger'
//   hotkey   — single key for keyboard shortcut
//
const ACTION_SET = [
  { key: 'approve', label: 'Approve & send', variant: 'brass',  hotkey: 'A' },
  { key: 'edit',    label: 'Edit draft',     variant: 'ghost',  hotkey: 'E' },
  { key: 'reassign',label: 'Reassign',       variant: 'ghost',  hotkey: 'R' },
  { key: 'reject',  label: 'Reject',         variant: 'danger', hotkey: 'X' },
];

// -- stat tiles shown on the dashboard header -----------------
const STATS = [
  { label: 'PENDING',           value: '12',     sub: 'in queue' },
  { label: 'APPROVED // 7D',    value: '34',     sub: '+ 6 vs prior 7d' },
  { label: 'AVG DECISION',      value: '1m 48s', sub: 'open → decide' },
  { label: 'EST. VALUE // 7D',  value: '$ 412k', sub: 'pipeline reached' },
];

// expose globally for the Babel scripts that consume this
Object.assign(window, {
  CLIENT, WORKFLOWS, ACTIVE_WORKFLOW_ID, ITEMS, ACTION_SET, STATS,
});
