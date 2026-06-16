/**
 * Quote-desk draft + confidence + item-mapping helpers (feat-017).
 *
 * Closes the quote-desk loop: an extracted {@link RfqPayload} (feat-015) is
 * priced against the FastAPI RateInsights band (feat-016), scored against the
 * `confidenceFloor` (0.75), drafted in Halberd's voice, and mapped onto a
 * `workflow_items` write for HITL review. The send-on-approval reply is built
 * from the persisted item by {@link quoteReplyFromItem}.
 *
 * Everything here is pure and deterministic — unit-testable offline. The LLM
 * draft call and the Gmail/data-API I/O live in the trigger tasks
 * (`trigger/quote-desk-draft.ts`, `trigger/quote-desk-send.ts`).
 */
import { z } from "zod";

import type { OutboundEmail } from "./gmail";
import { EQUIPMENT_LABELS, type RfqPayload } from "./rfq";
import type {
  RateInsightsEstimate,
  RateInsightsRequest,
  WorkflowItemCreate,
  WorkflowItemOut,
} from "./data-api";

/** The workflow these items belong to (matches the seeded contract id). */
export const QUOTE_WORKFLOW_ID = "quote-desk";

/** Auto-pass threshold — mirrors the quote-desk contract `confidenceFloor`. */
export const CONFIDENCE_FLOOR = 0.75;

/** Default sender for the quote reply when `QUOTE_FROM_ADDRESS` is unset. */
export const DEFAULT_QUOTE_FROM = "quotes@halberd-co.com";

/** Assumed line-haul pace for the transit-day estimate. */
const MILES_PER_DAY = 500;

/** Pickups within this many days count as hot → high priority. */
const PICKUP_SOON_DAYS = 2;

/* ------------------------------------------------------------------ */
/* RateInsights request                                                */
/* ------------------------------------------------------------------ */

/** Build a RateInsights lookup from an extracted RFQ. */
export function rfqToRateRequest(payload: RfqPayload): RateInsightsRequest {
  const { origin, destination, equipmentCode, pickupDate } = payload.rfq;
  return {
    origin_city: origin.city,
    origin_state_code: origin.state.toUpperCase(),
    destination_city: destination.city,
    destination_state_code: destination.state.toUpperCase(),
    equipment_code: equipmentCode,
    origin_zip_code: origin.zip,
    destination_zip_code: destination.zip,
    pickup_date: pickupDate,
  };
}

/* ------------------------------------------------------------------ */
/* Pricing + confidence                                                */
/* ------------------------------------------------------------------ */

/** Round an all-in dollar figure to the nearest $25 for a clean quote. */
export function roundRate(value: number): number {
  return Math.round(value / 25) * 25;
}

/** Estimate transit days from mileage (≥ 1 day), or null when unknown. */
export function estimateTransitDays(mileage: number | null): number | null {
  if (mileage == null || mileage <= 0) return null;
  return Math.max(1, Math.ceil(mileage / MILES_PER_DAY));
}

/** True when a pickup date is within {@link PICKUP_SOON_DAYS} of `now`. */
export function isPickupSoon(pickupDate: string | null, now: Date = new Date()): boolean {
  if (!pickupDate) return false;
  const pickup = new Date(`${pickupDate}T00:00:00Z`);
  if (Number.isNaN(pickup.getTime())) return false;
  const days = (pickup.getTime() - now.getTime()) / 86_400_000;
  return days <= PICKUP_SOON_DAYS;
}

/**
 * Tiers that carry a lane-specific rate worth quoting. State-level
 * (`loose_snapshots`) and empty (`none`) matches are too thin/odd — the number
 * is suppressed and the broker prices it.
 */
function tierHasRate(tier: string): boolean {
  return tier === "lane_snapshots" || tier === "lane_aggregate";
}

export interface QuoteDecision {
  /** Confidence on the 0–1 scale (mirrors the estimate). */
  confidence: number;
  /** 0–100 integer for the item `score` field / Score component. */
  score: number;
  /** Band is solid enough to auto-pass in high-volume mode (≥ floor + rate). */
  autoPassEligible: boolean;
  /** Too thin/odd to quote a number — broker prices it. */
  suppressRate: boolean;
  /** The all-in target rate to quote, or null when suppressed. */
  targetRate: number | null;
  /** Estimated transit days, or null when mileage is unknown. */
  transitDays: number | null;
  /** Item priority — `high` for hot/time-sensitive lanes. */
  priority: "high" | "normal";
  /** Short reason the item is held for a broker, or null when auto-pass. */
  holdReason: string | null;
}

/**
 * Score a rate estimate against the confidence floor and decide how the draft
 * should be handled (auto-pass vs hold, quote the number vs suppress it).
 */
export function decideQuote(
  estimate: RateInsightsEstimate,
  opts: { pickupSoon?: boolean } = {},
): QuoteDecision {
  const confidence = estimate.confidence_score;
  const score = Math.round(confidence * 100);
  const hasRate = tierHasRate(estimate.match_tier) && estimate.total_avg != null;
  const suppressRate = !hasRate;
  const autoPassEligible = hasRate && confidence >= CONFIDENCE_FLOOR;
  const targetRate = hasRate && estimate.total_avg != null ? roundRate(estimate.total_avg) : null;
  const transitDays = estimateTransitDays(estimate.mileage);

  let holdReason: string | null = null;
  if (!hasRate) {
    holdReason = "No lane-specific comparables — broker to price.";
  } else if (confidence < CONFIDENCE_FLOOR) {
    holdReason = `Below confidence floor (${score}/100) — broker to confirm the rate.`;
  }

  return {
    confidence,
    score,
    autoPassEligible,
    suppressRate,
    targetRate,
    transitDays,
    priority: opts.pickupSoon ? "high" : "normal",
    holdReason,
  };
}

/* ------------------------------------------------------------------ */
/* Draft prompt + schema                                               */
/* ------------------------------------------------------------------ */

/** The structured quote reply the model is asked to produce. */
export const QuoteDraftSchema = z.object({
  subject: z.string().describe("Reply subject line, e.g. 'Re: <original subject>'"),
  body: z
    .string()
    .describe(
      "The full quote email body in Halberd & Co's voice: greeting, the all-in " +
        "rate (or a note that a rep will follow up if no rate is given), transit " +
        "estimate, validity window, and a clear ask to book.",
    ),
});
export type QuoteDraft = z.infer<typeof QuoteDraftSchema>;

/** One-line description of the rate evidence behind the band. */
export function rateEvidenceLine(estimate: RateInsightsEstimate): string {
  if (estimate.match_tier === "none" || estimate.comparable_count === 0) {
    return "No comparable lanes found in the recent window.";
  }
  const band =
    estimate.total_low != null && estimate.total_high != null
      ? `$${Math.round(estimate.total_low).toLocaleString()}–$${Math.round(estimate.total_high).toLocaleString()} all-in`
      : estimate.avg_rate_per_mile != null
        ? `${estimate.avg_rate_per_mile.toFixed(2)}/mi`
        : "rate unavailable";
  const miles = estimate.mileage != null ? `${estimate.mileage.toLocaleString()} mi` : "mileage n/a";
  return (
    `${estimate.comparable_count} comparable lane(s) [${estimate.match_tier}]: ${band}, ` +
    `${miles}, confidence ${Math.round(estimate.confidence_score * 100)}/100.`
  );
}

/** Build the drafting prompt for `generateObject`. */
export function buildDraftPrompt(
  payload: RfqPayload,
  estimate: RateInsightsEstimate,
  decision: QuoteDecision,
): string {
  const { rfq } = payload;
  const equipment = EQUIPMENT_LABELS[rfq.equipmentCode];
  const lines: string[] = [
    "You are a freight broker at Halberd & Co writing a quote reply to an inbound shipper RFQ.",
    "Voice: warm, direct, confident, concise — a couple of short paragraphs, no corporate filler.",
    "Always include: a greeting, the transit estimate, a validity window, and a clear ask to book.",
    "",
    `Lane: ${payload.lane}`,
    `Equipment: ${equipment}`,
    rfq.pickupDate ? `Pickup: ${rfq.pickupDate}` : "Pickup: not stated",
    rfq.weightLbs ? `Weight: ${rfq.weightLbs.toLocaleString()} lbs` : null,
    rfq.commodity ? `Commodity: ${rfq.commodity}` : null,
    rfq.accessorials.length ? `Accessorials: ${rfq.accessorials.join(", ")}` : null,
    "",
    `Rate evidence: ${rateEvidenceLine(estimate)}`,
    decision.transitDays ? `Transit estimate: about ${decision.transitDays} day(s).` : null,
  ].filter((line): line is string => line !== null);

  if (decision.suppressRate || decision.targetRate == null) {
    lines.push(
      "",
      "IMPORTANT: the lane history is too thin to quote a firm number. Do NOT state a price.",
      "Acknowledge the request, confirm we can likely cover it, and say a Halberd rep will follow",
      "up shortly with a firm all-in rate. Still ask them to reply so we can lock capacity.",
    );
  } else {
    lines.push(
      "",
      `Quote this all-in target rate to the shipper: $${decision.targetRate.toLocaleString()} (USD, all-in).`,
      "State it as a firm all-in number. Give a validity window (e.g. good through end of day).",
      'Ask them to reply "book it" to lock the truck.',
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* workflow_item mapping                                               */
/* ------------------------------------------------------------------ */

/** Deterministic, idempotent item id keyed on the source Gmail message. */
export function quoteItemId(messageId: string): string {
  return `qd-${messageId}`;
}

/** Left-pane source content: the RFQ plus the rate evidence the band came from. */
export function buildSourceContent(payload: RfqPayload, estimate: RateInsightsEstimate): string {
  const { rfq } = payload;
  const lines: Array<string | null> = [
    `From: ${payload.from}`,
    `Subject: ${payload.subject}`,
    payload.receivedAt ? `Received: ${payload.receivedAt}` : null,
    "",
    `Lane: ${payload.lane}`,
    `Equipment: ${EQUIPMENT_LABELS[rfq.equipmentCode]} (${rfq.equipmentCode})`,
    rfq.pickupDate ? `Pickup: ${rfq.pickupDate}` : null,
    rfq.weightLbs ? `Weight: ${rfq.weightLbs.toLocaleString()} lbs` : null,
    rfq.commodity ? `Commodity: ${rfq.commodity}` : null,
    rfq.accessorials.length ? `Accessorials: ${rfq.accessorials.join(", ")}` : null,
    rfq.notes ? `Notes: ${rfq.notes}` : null,
    "",
    "— Comparable-lane evidence —",
    rateEvidenceLine(estimate),
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

/** Marginalia context refs for the comparable-lane evidence + any hold reason. */
export function buildContext(
  estimate: RateInsightsEstimate,
  decision: QuoteDecision,
): Array<Record<string, unknown>> {
  const context: Array<Record<string, unknown>> = [
    { ref: "[a]", body: rateEvidenceLine(estimate) },
  ];
  if (decision.holdReason) {
    context.push({ ref: "[b]", body: decision.holdReason });
  }
  return context;
}

export interface QuoteItemInput {
  payload: RfqPayload;
  estimate: RateInsightsEstimate;
  decision: QuoteDecision;
  draft: QuoteDraft;
}

/**
 * Map a priced + drafted RFQ onto a `workflow_items` create payload for the
 * FastAPI hitl router. Idempotent on the source message id. Email provenance is
 * stashed under non-display field keys so {@link quoteReplyFromItem} can thread
 * the send-on-approval reply (the contract's `itemSchema` only renders
 * lane/equipment/pickup/rate/score, so these keys are inert in the UI).
 */
export function toQuoteItem({ payload, estimate, decision, draft }: QuoteItemInput): WorkflowItemCreate {
  const { rfq } = payload;
  const equipment = EQUIPMENT_LABELS[rfq.equipmentCode];
  const ask = decision.suppressRate
    ? "Thin lane — broker to price."
    : `Quote $${decision.targetRate?.toLocaleString()} ready to send.`;
  const summary =
    `${equipment}, ${payload.lane}` +
    (rfq.pickupDate ? `, pickup ${rfq.pickupDate}` : "") +
    `. ${ask}`;

  return {
    id: quoteItemId(payload.messageId),
    workflow_id: QUOTE_WORKFLOW_ID,
    summary,
    fields: {
      lane: payload.lane,
      equipment,
      pickup: rfq.pickupDate,
      rate: decision.targetRate,
      score: decision.score,
      // Provenance for the send task — not in itemSchema, so inert in the UI.
      rfqMessageId: payload.messageId,
      rfqThreadId: payload.threadId,
      rfqSubject: payload.subject,
      shipperEmail: payload.from,
      draftSubject: draft.subject,
    },
    source_content: buildSourceContent(payload, estimate),
    proposed_output: draft.body,
    context: buildContext(estimate, decision),
    priority: decision.priority,
    status: "pending",
    created_at: payload.receivedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Send-on-approval reply                                              */
/* ------------------------------------------------------------------ */

/** Parse the `from` header (`"Name <addr@x>"` or bare address) to an address. */
export function parseFromAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

export interface QuoteReply extends OutboundEmail {
  /** Gmail thread id to keep the reply on the RFQ thread. */
  threadId: string | null;
}

/**
 * Build the outbound quote reply from a persisted (approved) item. Recipient,
 * subject and threading come from the provenance stashed by {@link toQuoteItem};
 * the body is the (possibly broker-adjusted) `proposed_output`.
 */
export function quoteReplyFromItem(
  item: WorkflowItemOut,
  opts: { from?: string } = {},
): QuoteReply {
  const fields = item.fields ?? {};
  const shipperEmail = typeof fields.shipperEmail === "string" ? fields.shipperEmail : "";
  const rfqSubject = typeof fields.rfqSubject === "string" ? fields.rfqSubject : "";
  const draftSubject = typeof fields.draftSubject === "string" ? fields.draftSubject : "";
  const threadId = typeof fields.rfqThreadId === "string" ? fields.rfqThreadId : null;

  const subject = draftSubject || (rfqSubject ? `Re: ${rfqSubject}` : "Re: your freight quote request");

  return {
    to: parseFromAddress(shipperEmail),
    from: opts.from ?? DEFAULT_QUOTE_FROM,
    subject,
    body: item.proposed_output ?? "",
    threadId,
  };
}
