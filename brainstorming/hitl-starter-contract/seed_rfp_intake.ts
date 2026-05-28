/**
 * Seed example — the rfp-intake workflow, expressed via the contract.
 *
 * Demonstrates how a real workflow plugs in: define the workflow, its item
 * schema, its available actions, and the items it produces. The dashboard
 * renders all of this without knowing anything specific about RFP intake.
 *
 * Validate it parses:  npx tsx seed_rfp_intake.ts
 */

import {
  WorkflowSchema,
  bulkActions,
  singleActions,
  type Action,
  type Workflow,
} from "./contract";

/* actions available on rfp-intake items */

const APPROVE: Action = {
  id: "approve",
  label: "Approve",
  intent: "primary",
  appliesTo: "both", // works in flyout and in bulk
  confirm: false,
  resultingStatus: "approved",
  handler: "rfp.approve",
};

const EDIT: Action = {
  id: "edit",
  label: "Edit",
  intent: "neutral",
  appliesTo: "single", // editing a draft is a single-item act
  confirm: false,
  resultingStatus: "pending", // stays pending after edit
  handler: "rfp.edit",
};

const REJECT: Action = {
  id: "reject",
  label: "Reject",
  intent: "destructive",
  appliesTo: "both",
  confirm: true,
  resultingStatus: "rejected",
  handler: "rfp.reject",
};

/* the workflow — validated through the schema so defaults are applied */

const rfpIntake: Workflow = WorkflowSchema.parse({
  id: "rfp-intake",
  name: "rfp-intake",
  description:
    "Reads inbound RFP emails, drafts a first response in the studio voice, " +
    "attaches the right pricing sheet, and files the thread in the correct " +
    "CRM pipeline. Flags anything above the confidence floor for a human " +
    "decision before sending.",
  status: "running",
  defaultView: "table",
  confidenceFloor: 0.82,
  steps: [
    { label: "read", status: "done" },
    { label: "classify", status: "done" },
    { label: "draft", status: "active" },
    { label: "file", status: "pending" },
  ],
  stats: [
    { label: "PENDING", value: 10, unit: "in queue", emphasized: true },
    { label: "APPROVED // 7D", value: 35, trend: "+6 vs prior 7d" },
    { label: "AVG DECISION", value: "1m 48s", unit: "open -> decide" },
  ],
  itemSchema: [
    { key: "subject", label: "Subject", type: "string" },
    { key: "from", label: "From", type: "email" },
    { key: "attachments", label: "Attachments", type: "count" },
  ],
  availableActions: [APPROVE, EDIT, REJECT],
  sources: [
    { id: "inbox", label: "rfp@studio inbox", kind: "inbox" },
    { id: "crm", label: "CRM pipeline", kind: "crm" },
  ],
  items: [
    {
      id: "rfp-2026-0142",
      status: "pending",
      priority: "high",
      createdAt: "2026-05-12T14:32:08Z",
      summary: "Northwind Logistics — fleet telematics RFP",
      fields: {
        subject: "Northwind Logistics — fleet telematics RFP",
        from: "procurement@northwind-logistics.com",
        attachments: 6,
      },
      sourceContent:
        "Hi, we're soliciting proposals for a fleet telematics integration...",
      proposedOutput:
        "Thanks for reaching out — happy to put together a proposal. " +
        "Attaching our standard pricing sheet...",
      context: [
        { ref: "[a]", label: "confidence", body: "0.71 — below floor, flagged for review." },
      ],
    },
    {
      id: "rfp-2026-0140",
      status: "pending",
      priority: "flagged",
      createdAt: "2026-05-12T11:47:02Z",
      summary: "Granite & Cole — scope expansion, year 2",
      fields: {
        subject: "Granite & Cole — scope expansion, year 2",
        from: "ops@granitecole.com",
        attachments: 3,
      },
      // this item narrows its actions: an existing client can't be "rejected"
      actions: [APPROVE, EDIT],
    },
  ],
});

/* exercise the helpers */

const bulk = bulkActions(rfpIntake);
const singles = singleActions(rfpIntake, rfpIntake.items[1]);

console.assert(
  JSON.stringify(bulk.map((a) => a.id).sort()) ===
    JSON.stringify(["approve", "reject"]),
  "bulk should exclude edit",
);
console.assert(
  JSON.stringify(singles.map((a) => a.id).sort()) ===
    JSON.stringify(["approve", "edit"]),
  "item narrowed to approve+edit",
);

console.log("OK — rfp-intake seed validates and helpers resolve correctly.");
console.log(`  workflow: ${rfpIntake.name} (${rfpIntake.status})`);
console.log(`  items:    ${rfpIntake.items.length}`);
console.log(`  bulk actions:    ${bulk.map((a) => a.id).join(", ")}`);
console.log(`  single (item 2): ${singles.map((a) => a.id).join(", ")}`);
