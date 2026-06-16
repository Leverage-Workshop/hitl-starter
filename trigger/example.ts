/**
 * Scaffolding task — proves the trigger.dev wiring (config + shared helpers)
 * resolves end to end. The real quote-desk tasks (RFQ extraction in feat-015,
 * draft + queue write in feat-017) replace this.
 */
import { logger, task } from "@trigger.dev/sdk";

import { DEFAULT_MODEL, getModel } from "./lib/ai";
import { getDataApi } from "./lib/data-api";

export const quoteDeskHealth = task({
  id: "quote-desk-health",
  run: async (payload: { workflowId?: string } = {}) => {
    const workflowId = payload.workflowId ?? "quote-desk";

    // Both helpers construct from env; this confirms creds are wired.
    getModel(DEFAULT_MODEL);
    const pending = await getDataApi().listItems(workflowId, "pending");

    logger.info("quote-desk health check", {
      workflowId,
      model: DEFAULT_MODEL,
      pendingItems: pending.length,
    });

    return { ok: true, workflowId, pendingItems: pending.length };
  },
});
