/**
 * Quote-desk draft generation + queue write (feat-017).
 *
 * Consumes a validated {@link RfqPayload} (emitted by the feat-015 intake task),
 * prices it against the FastAPI RateInsights endpoint (feat-016), drafts a quote
 * reply in Halberd's voice via the AI SDK over OpenRouter, scores it against the
 * `confidenceFloor` (0.75), and writes a `quote-desk` `workflow_item` through the
 * FastAPI hitl router for broker review.
 *
 *   intake → quote-desk-draft → workflow_item (pending)
 *          → broker "Approve & send" → quote-desk-send (feat-006 dispatch)
 *
 * The pure pricing/draft/mapping logic lives in `trigger/lib/quote.ts`; this task
 * owns the I/O (RateInsights lookup, LLM call, item write).
 */
import { generateObject } from "ai";
import { logger, task } from "@trigger.dev/sdk";

import { getModel } from "./lib/ai";
import { getDataApi } from "./lib/data-api";
import type { RateInsightsEstimate } from "./lib/data-api";
import type { RfqPayload } from "./lib/rfq";
import {
  QuoteDraftSchema,
  buildDraftPrompt,
  decideQuote,
  isPickupSoon,
  rfqToRateRequest,
  toQuoteItem,
  type QuoteDecision,
  type QuoteDraft,
} from "./lib/quote";

/** Draft the quote reply for a priced RFQ via the LLM. */
export async function draftQuote(
  payload: RfqPayload,
  estimate: RateInsightsEstimate,
  decision: QuoteDecision,
  modelId?: string,
): Promise<QuoteDraft> {
  const { object } = await generateObject({
    model: getModel(modelId),
    schema: QuoteDraftSchema,
    prompt: buildDraftPrompt(payload, estimate, decision),
  });
  return object;
}

export const quoteDeskDraft = task({
  id: "quote-desk-draft",
  run: async (payload: RfqPayload) => {
    const api = getDataApi();

    // Persist the lookup as a truckstop rate_snapshot so the band is auditable.
    const estimate = await api.estimateRate(rfqToRateRequest(payload), true);
    const decision = decideQuote(estimate, {
      pickupSoon: isPickupSoon(payload.rfq.pickupDate),
    });
    const draft = await draftQuote(payload, estimate, decision);
    const created = await api.createItem(toQuoteItem({ payload, estimate, decision, draft }));

    logger.info("quote-desk draft queued", {
      itemId: created.id,
      lane: payload.lane,
      matchTier: estimate.match_tier,
      score: decision.score,
      autoPassEligible: decision.autoPassEligible,
      suppressRate: decision.suppressRate,
    });

    return {
      ok: true,
      itemId: created.id,
      autoPassEligible: decision.autoPassEligible,
      suppressRate: decision.suppressRate,
      score: decision.score,
    };
  },
});
