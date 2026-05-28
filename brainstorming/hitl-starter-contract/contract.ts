/**
 * HITL-Starter — Workflow & Item Contract
 * TypeScript + Zod
 *
 * The dashboard understands only these three objects: Workflow, Item, Action.
 * Add a new workflow by implementing this contract — never by editing the shell.
 *
 *   import { WorkflowSchema, type Workflow } from "./contract";
 *   const wf = WorkflowSchema.parse(raw); // runtime-validated, fully typed
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const WorkflowStatus = z.enum(["running", "paused", "error", "idle"]);
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;

export const ItemStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "flagged",
  "skipped",
]);
export type ItemStatus = z.infer<typeof ItemStatus>;

export const Priority = z.enum(["high", "normal", "flagged"]);
export type Priority = z.infer<typeof Priority>;

/** Maps to design-system button styling. Dashboard styles by intent,
 *  not by knowing what the action means. */
export const ActionIntent = z.enum(["primary", "neutral", "destructive"]);
export type ActionIntent = z.infer<typeof ActionIntent>;

/** Where an action can be applied. Expresses "bulk actions only in table mode"
 *  at the contract level. */
export const ActionScope = z.enum(["single", "bulk", "both"]);
export type ActionScope = z.infer<typeof ActionScope>;

/** Small, display-oriented set. Tells the UI how to render a column —
 *  not a business-data type system. Extend as real workflows demand. */
export const FieldType = z.enum([
  "string",
  "number",
  "datetime",
  "email",
  "badge",
  "count",
]);
export type FieldType = z.infer<typeof FieldType>;

/* ------------------------------------------------------------------ */
/* Supporting shapes                                                  */
/* ------------------------------------------------------------------ */

export const StepSchema = z.object({
  label: z.string(),
  status: z.enum(["done", "active", "pending", "error"]).optional(),
});
export type Step = z.infer<typeof StepSchema>;

export const StatSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  /** e.g. "+6 vs prior 7d" */
  trend: z.string().optional(),
  /** The accent figure in the tile row. At most one per workflow. */
  emphasized: z.boolean().default(false),
});
export type Stat = z.infer<typeof StatSchema>;

/** Describes one field an item carries, so the table can render a column
 *  and the card the right field. */
export const FieldDefSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: FieldType,
  /** Show as a table column. */
  showInTable: z.boolean().default(true),
  /** Show on the card face. */
  showInCard: z.boolean().default(true),
});
export type FieldDef = z.infer<typeof FieldDefSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["api", "inbox", "crm", "database", "other"]).default("other"),
});
export type Source = z.infer<typeof SourceSchema>;

export const NoteSchema = z.object({
  /** Marginalia callout key, e.g. "[a]". Optional. */
  ref: z.string().optional(),
  label: z.string().optional(),
  body: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

/* ------------------------------------------------------------------ */
/* Object 3 — Action                                                  */
/* ------------------------------------------------------------------ */

export const ActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  intent: ActionIntent.default("neutral"),
  appliesTo: ActionScope.default("single"),
  confirm: z.boolean().default(false),
  /** The item status this action produces. The lifecycle link —
   *  actions are the only thing that change item status. */
  resultingStatus: ItemStatus,
  /** Stable handler key the app maps to a function/endpoint.
   *  Left abstract on purpose; wire to backend later. */
  handler: z.string(),
});
export type Action = z.infer<typeof ActionSchema>;

/* ------------------------------------------------------------------ */
/* Object 2 — Workflow Item                                           */
/* ------------------------------------------------------------------ */

export const ItemSchema = z.object({
  id: z.string(),
  status: ItemStatus.default("pending"),
  priority: Priority.default("normal"),
  createdAt: z.string().datetime(),
  summary: z.string(),
  /** Workflow-specific data conforming to the workflow's itemSchema.
   *  Keyed by FieldDef.key. */
  fields: z.record(z.string(), z.unknown()).default({}),

  /* review payload — drives the two-pane flyout body */
  sourceContent: z.string().optional(),
  proposedOutput: z.string().optional(),
  context: z.array(NoteSchema).default([]),

  /** Actions available on this specific item. Usually inherited from the
   *  workflow's availableActions, but may be narrowed per item. */
  actions: z.array(ActionSchema).optional(),
});
export type Item = z.infer<typeof ItemSchema>;

/* ------------------------------------------------------------------ */
/* Object 1 — Workflow                                                */
/* ------------------------------------------------------------------ */

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: WorkflowStatus.default("idle"),

  steps: z.array(StepSchema).default([]),
  stats: z.array(StatSchema).default([]),
  defaultView: z.enum(["table", "cards"]).default("table"),

  items: z.array(ItemSchema).default([]),
  itemSchema: z.array(FieldDefSchema).default([]),
  /** The configurable slot. Drives the flyout and bulk-action bars. */
  availableActions: z.array(ActionSchema).default([]),

  sources: z.array(SourceSchema).default([]),
  /** Threshold above which an item is flagged for human review. */
  confidenceFloor: z.number().min(0).max(1).optional(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Resolve the actions for an item: its own narrowed set if present,
 *  otherwise the workflow's available set. */
export function resolveItemActions(workflow: Workflow, item: Item): Action[] {
  return item.actions ?? workflow.availableActions;
}

/** Actions valid for bulk selection (table mode only). */
export function bulkActions(workflow: Workflow): Action[] {
  return workflow.availableActions.filter(
    (a) => a.appliesTo === "bulk" || a.appliesTo === "both",
  );
}

/** Actions valid in the single-item flyout. */
export function singleActions(workflow: Workflow, item: Item): Action[] {
  return resolveItemActions(workflow, item).filter(
    (a) => a.appliesTo === "single" || a.appliesTo === "both",
  );
}
