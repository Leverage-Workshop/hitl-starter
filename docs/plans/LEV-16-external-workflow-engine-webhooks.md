# LEV-16 Implementation Plan: Integrate External Workflow Engines over Webhooks

## Overview

Bidirectional HTTP webhook protocol between the HITL console and external engines (trigger.dev, LangGraph, etc.). Engines push items in; humans decide; the app dispatches decisions durably outbound; engines confirm results back via the same inbound endpoint.

Lifecycle: engine creates item (inbound) → human decides → app dispatches decision (durable outbound) → engine acts → engine closes/updates item (inbound).

---

## Phase 1 — Schema & Contract Extensions

**Goal:** Prepare DB and types for webhook secrets, outbound targets, and transitional dispatch state.

**Changes:**
- `lib/db/schema.ts` — add `webhookSecret` (text) to `workflows`; add `outboundDispatchRunId` + `dispatchedAt` to `workflow_items`
- `lib/contract/index.ts` — extend `Action.handler` to accept `{ url: string; method?: string }` (webhook target shape); add `dispatching` as a valid item status
- Run `drizzle-kit push` after schema changes

---

## Phase 2 — Inbound Ingestion Endpoint

**Goal:** `POST /api/workflows/[id]/items` — authenticated by per-workflow secret, Zod-validated, upserts items.

**New file:** `app/api/workflows/[id]/items/route.ts`

**Logic:**
- Extract `x-webhook-secret` header; look up workflow from DB; constant-time comparison (prevent timing attacks)
- Validate body against the workflow's item Zod schema
- Upsert into `workflow_items` using item `id` as idempotency key
- Returns 200 (upserted item), 401 (bad secret), 422 (invalid payload)
- Basic rate limiting on the route

---

## Phase 3 — Early/Mock Dispatch (Inline POST)

**Goal:** Prove the round-trip loop before adding trigger.dev complexity.

**Modified file:** server action where `recordDecision` lives

**Logic:**
- Persist decision with status `dispatching`; revalidate so UI updates immediately
- Read `action.handler.url` from the workflow contract
- HMAC-sign payload: `crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')`, sent as `X-Signature-SHA256`
- SSRF guard: validate URL against `ALLOWED_WEBHOOK_DOMAINS` env var before any outbound fetch
- Include `X-Idempotency-Key: <itemId>-<decisionId>` header on outbound
- On success: update item to `action.resultingStatus`; on failure: leave in `dispatching` (engine can retry via inbound)

---

## Phase 4 — Durable Dispatch via trigger.dev

**Goal:** Replace inline fetch with a trigger.dev task for retries, idempotency, and failure isolation.

**New file:** `trigger/dispatch-decision.ts`
**Modified file:** `recordDecision` server action

**Logic:**
- Server action: persist to `dispatching`, trigger `dispatch-decision` task, store run ID in `outboundDispatchRunId`, revalidate immediately (UI is responsive)
- Task: reads decision + action handler URL from DB, HMAC-signs, POSTs with trigger.dev-native retries, calls back to `POST /api/workflows/[id]/items` to settle item to final status
- Idempotency: trigger.dev task ID = `dispatch-<itemId>-<decisionId>`

---

## Phase 5 — Security Hardening

Threading security through all prior phases:

| Concern | Mechanism |
|---|---|
| SSRF | Allowlist via `ALLOWED_WEBHOOK_DOMAINS` env var; reject before any outbound fetch |
| Inbound auth | Constant-time HMAC comparison, 401 with no detail on mismatch |
| Outbound signing | `X-Signature-SHA256` HMAC header on every outbound POST |
| Idempotency | Upsert on inbound; idempotency key on outbound |
| Secret leakage | Secrets never logged; error responses never echo secrets or internal detail |
| Rate limiting | `x-ratelimit-*` headers + 429 reject on ingestion route |

---

## Implementation Order

1. Schema extensions (Phase 1) — unblocks everything
2. Contract extensions (Phase 1) — `dispatching` status + handler shape
3. Inbound endpoint (Phase 2) — test with curl before any UI work
4. Inline dispatch (Phase 3) — prove end-to-end loop
5. Durable dispatch (Phase 4) — swap in trigger.dev, same interface
6. Security thread-through (Phase 5) — validate each phase

---

## Acceptance Criteria Checklist

| Criterion | Phase |
|---|---|
| POST item → appears in queue | 2 |
| Action → transitional state instantly | 3–4 |
| Outbound fires (HMAC verified, retries) | 3–4 |
| Inbound confirmation settles to final status | 4 |
| SSRF guard rejects disallowed URLs | 3 |
| Retried dispatch deduplicated (idempotency) | 2, 3 |
| `tsc --noEmit` clean | all |
