/**
 * Quote-desk send-on-approval (feat-017).
 *
 * Fired when a broker approves (or adjusts + approves) a quote item. The
 * Next.js outbound decision dispatch (feat-006) POSTs the decision to
 * `/api/quote-desk/send`, which triggers this task. We rebuild the approved
 * reply from the persisted item, send it to the shipper via the Gmail send API
 * threaded onto the original RFQ, and settle the item.
 *
 * The reply assembly is pure (`quoteReplyFromItem` in `trigger/lib/quote.ts`);
 * this task owns the Gmail send + item update I/O.
 */
import { logger, task } from "@trigger.dev/sdk";

import { getDataApi } from "./lib/data-api";
import { GmailClient, buildRawMessage } from "./lib/gmail";
import { quoteReplyFromItem } from "./lib/quote";

/**
 * Resolve a Gmail OAuth token with `gmail.send` scope. Prefers a dedicated
 * `GMAIL_SEND_TOKEN`, falling back to the read token used by intake. Production
 * should mint/refresh a delegated token (see quote-desk-setup.md §5).
 */
function resolveGmailSendToken(override?: string): string {
  const token = override ?? process.env.GMAIL_SEND_TOKEN ?? process.env.GMAIL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "GMAIL_SEND_TOKEN/GMAIL_ACCESS_TOKEN is not set — required to send the quote reply (see quote-desk-setup.md §5).",
    );
  }
  return token;
}

export const quoteDeskSend = task({
  id: "quote-desk-send",
  run: async (payload: { itemId: string; accessToken?: string }) => {
    const api = getDataApi();

    const item = await api.getItem(payload.itemId);
    const reply = quoteReplyFromItem(item, { from: process.env.QUOTE_FROM_ADDRESS });

    if (!reply.to) {
      throw new Error(`quote-desk-send: item ${item.id} has no shipper address to reply to.`);
    }
    if (!reply.body.trim()) {
      throw new Error(`quote-desk-send: item ${item.id} has an empty draft body.`);
    }

    const client = new GmailClient({ accessToken: resolveGmailSendToken(payload.accessToken) });
    const sent = await client.sendMessage({
      raw: buildRawMessage(reply),
      threadId: reply.threadId,
    });

    // Settle the item. Marking the underlying load `quoted` is a loads-table
    // concern handled by the FastAPI service / engine once a load exists.
    await api.updateItem(item.id, { status: "approved" });

    logger.info("quote-desk reply sent", {
      itemId: item.id,
      to: reply.to,
      gmailMessageId: sent.id,
      threadId: sent.threadId,
    });

    return { ok: true, itemId: item.id, gmailMessageId: sent.id, threadId: sent.threadId };
  },
});
