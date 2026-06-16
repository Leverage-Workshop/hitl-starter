/**
 * Quote-desk RFQ intake (feat-015).
 *
 * Turns an inbound RFQ at quotes@halberd-co.com into a validated structured
 * {@link RfqPayload} consumed by the draft/queue step (feat-017).
 *
 * Real-time path:
 *   Gmail users.watch → Pub/Sub topic → push subscription → POST /api/gmail/push
 *   → tasks.trigger("quote-desk-intake", notification) → this task.
 *
 * Fallback: the `quote-desk-poll` scheduled task replays history from the last
 * known historyId when the push channel is down (see quote-desk-setup.md).
 *
 * The task: resolves the Gmail change → fetches each added message → extracts
 * structured RFQ JSON with the AI SDK `generateObject` + {@link RfqSchema} over
 * OpenRouter (Claude default from feat-014) → emits validated RFQ payloads.
 */
import { generateObject } from "ai";
import { logger, schedules, task } from "@trigger.dev/sdk";

import { getModel } from "./lib/ai";
import { GmailClient, type GmailNotification, type ParsedEmail } from "./lib/gmail";
import { RfqSchema, buildExtractionPrompt, toRfqPayload, type RfqPayload } from "./lib/rfq";

/**
 * Resolve a Gmail OAuth access token. The scaffold reads `GMAIL_ACCESS_TOKEN`;
 * production should mint/refresh a domain-wide-delegation token for the mailbox
 * (see quote-desk-setup.md §4). Kept here so the helpers stay env-free.
 */
function resolveGmailToken(override?: string): string {
  const token = override ?? process.env.GMAIL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "GMAIL_ACCESS_TOKEN is not set — required to read quotes@halberd-co.com (see quote-desk-setup.md).",
    );
  }
  return token;
}

/** Extract a single parsed email into a validated RFQ payload via the LLM. */
export async function extractRfq(email: ParsedEmail, modelId?: string): Promise<RfqPayload> {
  const { object } = await generateObject({
    model: getModel(modelId),
    schema: RfqSchema,
    prompt: buildExtractionPrompt(email),
  });
  return toRfqPayload(email, object);
}

/** Fetch the added messages for a notification and extract each into an RFQ. */
async function processNotification(
  notification: GmailNotification,
  client: GmailClient,
): Promise<RfqPayload[]> {
  const ids = await client.addedMessageIds(notification.historyId);
  const payloads: RfqPayload[] = [];
  for (const id of ids) {
    const email = await client.getMessage(id);
    if (!email.body.trim()) {
      logger.warn("skipping message with empty body", { messageId: id });
      continue;
    }
    payloads.push(await extractRfq(email));
  }
  return payloads;
}

/**
 * Push-triggered intake task. Payload is the Gmail change notification decoded
 * from the Pub/Sub push envelope by `/api/gmail/push`.
 */
export const quoteDeskIntake = task({
  id: "quote-desk-intake",
  run: async (payload: GmailNotification & { accessToken?: string }) => {
    const client = new GmailClient({ accessToken: resolveGmailToken(payload.accessToken) });
    const rfqs = await processNotification(payload, client);
    logger.info("quote-desk RFQ intake", {
      emailAddress: payload.emailAddress,
      historyId: payload.historyId,
      extracted: rfqs.length,
    });
    return { ok: true, extracted: rfqs.length, rfqs };
  },
});

/**
 * Scheduled poll fallback (hourly). Replays Gmail history from
 * `GMAIL_START_HISTORY_ID` so RFQs are not lost while the push channel is down.
 * Disabled until that env var is set. Real deployments persist the last seen
 * historyId after each successful run.
 */
export const quoteDeskPoll = schedules.task({
  id: "quote-desk-poll",
  cron: "0 * * * *",
  run: async () => {
    const startHistoryId = process.env.GMAIL_START_HISTORY_ID;
    const emailAddress = process.env.GMAIL_WATCH_ADDRESS ?? "quotes@halberd-co.com";
    if (!startHistoryId) {
      logger.warn("quote-desk-poll skipped — GMAIL_START_HISTORY_ID not set");
      return { ok: true, extracted: 0, skipped: true as const };
    }
    const client = new GmailClient({ accessToken: resolveGmailToken() });
    const rfqs = await processNotification({ emailAddress, historyId: startHistoryId }, client);
    logger.info("quote-desk poll fallback", { emailAddress, startHistoryId, extracted: rfqs.length });
    return { ok: true, extracted: rfqs.length, rfqs };
  },
});
