# Webhook integration

The app is both a webhook **consumer** (inbound) and a webhook **producer** (outbound).
This is how external engines (trigger.dev, LangGraph, etc.) connect — see
[reference/trigger-dev.md](./reference/trigger-dev.md) for Trigger.dev task patterns.

## Inbound — item ingestion

`POST /api/workflows/[id]/items`

External engines call this to enqueue items for review and to settle items after acting
on a decision. The payload is validated against `ItemSchema` (Zod). Authentication is
per-workflow HMAC (secret stored in the `workflows` table as `webhook_secret`).
Idempotent on `item.id`.

## Outbound — decision dispatch

When a reviewer fires an action whose `handler` is `{ url, method? }`:

1. The server action immediately persists the decision with `status = "dispatching"` and
   returns — the UI responds instantly.
2. An outbound POST is dispatched to the handler URL, HMAC-signed with the workflow's
   webhook secret.
3. The receiving engine acts on the decision and calls the inbound endpoint to settle the
   item to its final status.

Security: outbound URLs are validated against a per-workflow SSRF allowlist stored in the
DB. **No outbound dispatch fires to an unregistered host.**
