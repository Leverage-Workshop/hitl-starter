/**
 * RFQ (Request-For-Quote) extraction contract for the quote-desk intake task.
 *
 * An inbound shipper email at `quotes@halberd-co.com` is turned into a validated
 * structured object via the AI SDK `generateObject` + {@link RfqSchema}. The pure
 * helpers here (equipment mapping, weight parsing, lane formatting, prompt
 * builder) are deterministic and unit-testable offline — the LLM call lives in
 * the trigger task (`trigger/quote-desk-intake.ts`).
 *
 * Equipment is normalised to the lane `equipment_code` taxonomy used by the
 * FastAPI data API (api/db/models.py: `V | R | F | SD | DD`).
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Equipment taxonomy                                                  */
/* ------------------------------------------------------------------ */

/** Lane equipment codes — mirrors the `lanes_equipment_code_check` constraint. */
export const EQUIPMENT_CODES = ["V", "R", "F", "SD", "DD"] as const;
export type EquipmentCode = (typeof EQUIPMENT_CODES)[number];

/** Human label per code, for prompts and summaries. */
export const EQUIPMENT_LABELS: Record<EquipmentCode, string> = {
  V: "Dry Van",
  R: "Reefer",
  F: "Flatbed",
  SD: "Step Deck",
  DD: "Double Drop",
};

/**
 * Ordered free-text → code rules. Order matters: the most specific phrases are
 * matched first so "reefer van" → R (not V) and "double drop" → DD (not SD).
 * Each rule's keywords are tested as substrings against the lower-cased input.
 */
const EQUIPMENT_RULES: ReadonlyArray<{ code: EquipmentCode; keywords: string[] }> = [
  {
    code: "DD",
    keywords: ["double drop", "double-drop", "rgn", "removable gooseneck", "lowboy"],
  },
  {
    code: "SD",
    keywords: ["step deck", "step-deck", "stepdeck", "drop deck", "dropdeck", "single drop"],
  },
  {
    code: "R",
    keywords: ["reefer", "refrigerated", "refrigeration", "temp control", "temperature control", "frozen", "chilled"],
  },
  {
    code: "F",
    keywords: ["flatbed", "flat bed", "flat-bed", "conestoga", "tarped", "tarp", "step", "flat"],
  },
  {
    code: "V",
    keywords: ["dry van", "dryvan", "dry-van", "53' van", "53 van", "53ft van", "van", "dv", "box truck", "enclosed"],
  },
];

/**
 * Map a free-text equipment description to a canonical {@link EquipmentCode},
 * or `null` if nothing matches. Deterministic and order-sensitive (see
 * {@link EQUIPMENT_RULES}).
 */
export function normalizeEquipment(input: string | null | undefined): EquipmentCode | null {
  if (!input) return null;
  const text = input.toLowerCase();
  for (const { code, keywords } of EQUIPMENT_RULES) {
    if (keywords.some((kw) => text.includes(kw))) return code;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Parser helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a free-text weight into integer pounds, or `null` if unparseable.
 * Handles `42k`, `42.5k`, `42,000 lbs`, `28000`, `~46k lbs`. A bare `k`
 * multiplies by 1000. Values are floored to a whole pound.
 */
export function parseWeight(input: string | null | undefined): number | null {
  if (!input) return null;
  const match = input.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const pounds = match[2] ? value * 1000 : value;
  return Math.floor(pounds);
}

/** Format a `City, ST → City, ST` lane label from origin/destination. */
export function formatLane(origin: RfqLocation, destination: RfqLocation): string {
  return `${formatPlace(origin)} → ${formatPlace(destination)}`;
}

function formatPlace(loc: RfqLocation): string {
  const state = loc.state ? `, ${loc.state.toUpperCase()}` : "";
  return `${loc.city}${state}`;
}

/* ------------------------------------------------------------------ */
/* RFQ schema                                                          */
/* ------------------------------------------------------------------ */

export const RfqLocationSchema = z.object({
  city: z.string().min(1).describe("City name, e.g. 'Fresno'"),
  state: z.string().min(2).describe("US state — 2-letter code preferred, e.g. 'CA'"),
  zip: z.string().nullable().describe("ZIP/postal code if stated, else null"),
});
export type RfqLocation = z.infer<typeof RfqLocationSchema>;

/**
 * The structured RFQ the model is asked to extract. Nullable fields are emitted
 * as `null` when the email does not state them (never invented). `equipmentText`
 * preserves the shipper's wording; `equipmentCode` is the model's best guess and
 * is reconciled deterministically by {@link reconcileEquipment}.
 */
export const RfqSchema = z.object({
  origin: RfqLocationSchema,
  destination: RfqLocationSchema,
  equipmentCode: z
    .enum(EQUIPMENT_CODES)
    .describe("Equipment code: V dry van, R reefer, F flatbed, SD step deck, DD double drop"),
  equipmentText: z.string().nullable().describe("Verbatim equipment wording from the email, if any"),
  pickupDate: z.string().nullable().describe("Pickup date as YYYY-MM-DD if stated, else null"),
  weightLbs: z.number().int().positive().nullable().describe("Weight in pounds, else null"),
  commodity: z.string().nullable().describe("What is being shipped, else null"),
  accessorials: z
    .array(z.string())
    .describe("Extra services requested (tarp, liftgate, team, hazmat…); empty array if none"),
  notes: z.string().nullable().describe("Any other quote-relevant detail, else null"),
});
export type Rfq = z.infer<typeof RfqSchema>;

/**
 * Reconcile the model's equipment guess against a deterministic mapping of the
 * verbatim text. If the free text maps cleanly we trust that mapping; otherwise
 * we keep the model's `equipmentCode`. Returns a new object (no mutation).
 */
export function reconcileEquipment(rfq: Rfq): Rfq {
  const mapped = normalizeEquipment(rfq.equipmentText);
  return mapped ? { ...rfq, equipmentCode: mapped } : rfq;
}

/* ------------------------------------------------------------------ */
/* Outbound payload (consumed by feat-017)                             */
/* ------------------------------------------------------------------ */

/** The validated RFQ plus its email provenance — handed to the draft step. */
export interface RfqPayload {
  messageId: string;
  threadId: string | null;
  from: string;
  subject: string;
  receivedAt: string | null;
  lane: string;
  rfq: Rfq;
}

/** Assemble an {@link RfqPayload} from a parsed email and a validated RFQ. */
export function toRfqPayload(
  email: { messageId: string; threadId: string | null; from: string; subject: string; date: string | null },
  rfq: Rfq,
): RfqPayload {
  const reconciled = reconcileEquipment(rfq);
  return {
    messageId: email.messageId,
    threadId: email.threadId,
    from: email.from,
    subject: email.subject,
    receivedAt: email.date,
    lane: formatLane(reconciled.origin, reconciled.destination),
    rfq: reconciled,
  };
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

/** Build the extraction prompt for `generateObject` from a parsed email. */
export function buildExtractionPrompt(email: { from: string; subject: string; body: string }): string {
  return [
    "You are a freight brokerage quote desk. Extract a structured RFQ from this inbound shipper email.",
    "Only use facts stated in the email — never invent an origin, destination, date, weight, or rate.",
    "If a field is not stated, return null (or an empty array for accessorials).",
    "For equipment, set equipmentText to the shipper's exact wording and equipmentCode to the best match:",
    "V dry van, R reefer/refrigerated, F flatbed, SD step deck, DD double drop.",
    "",
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    "",
    email.body,
  ].join("\n");
}
