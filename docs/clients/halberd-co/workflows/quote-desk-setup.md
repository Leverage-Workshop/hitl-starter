# Quote Desk — Infrastructure & Third-Party Setup

> **Living doc.** This tracks every piece of external infrastructure, credential, and
> third-party service the quote-desk workflow engine needs. Each implementing feature
> (feat-014…feat-017) appends what it discovers here as it is built. If you hit a new
> credential, API enablement, or config step while implementing, add it.

The *what* of the workflow lives in [`quote-desk.md`](quote-desk.md). This file is the
*how do I stand up the plumbing* companion.

## Status checklist

- [x] trigger.dev scaffolded in-repo: `trigger.config.ts` + `trigger/` dir, SDK + AI
      SDK + OpenRouter deps, env vars in `.env.example` (feat-014). Remaining manual
      step: create the cloud project and set `TRIGGER_PROJECT_REF` / auth the CLI.
- [x] OpenRouter wiring: AI SDK model factory `trigger/lib/ai.ts` (feat-014).
      Remaining manual step: provision `OPENROUTER_API_KEY`.
- [x] Typed FastAPI data-API client `trigger/lib/data-api.ts` writes `workflow_items`
      via the hitl router (feat-014). Remaining manual step: deploy the API and set
      `DATA_API_BASE_URL`.
- [x] RFQ intake task + extraction contract in-repo (feat-015): `trigger/quote-desk-intake.ts`
      (push-triggered `quote-desk-intake` + scheduled `quote-desk-poll` fallback), Gmail/Pub-Sub
      parse helpers `trigger/lib/gmail.ts`, Zod `RfqSchema` + equipment mapping + parsers
      `trigger/lib/rfq.ts`, push endpoint `app/api/gmail/push`. Remaining manual steps ↓.
- [ ] Gmail API enabled + OAuth for `quotes@halberd-co.com` (feat-015 — manual cloud setup)
- [ ] Google Pub/Sub topic + push subscription → `/api/gmail/push` (feat-015 — manual cloud setup)
- [ ] RateInsights endpoint deployed in FastAPI (feat-016)
- [ ] Gmail send capability for the approved-quote reply (feat-017)

---

## 1. trigger.dev (feat-014)

**In-repo scaffolding (done):** `trigger.config.ts` (project ref read from
`TRIGGER_PROJECT_REF`, `dirs: ["./trigger"]`) and the `trigger/` dir — shared helpers in
`trigger/lib/` plus a `quote-desk-health` scaffold task. `@trigger.dev/sdk` is a project
dependency. The build cache dir `.trigger` is gitignored.

**Manual cloud setup (you do this):**

- Create a trigger.dev project (cloud or self-hosted); note the **project ref** → set
  `TRIGGER_PROJECT_REF` (or replace the fallback in `trigger.config.ts`).
- `npx trigger.dev@latest login` to auth the CLI.
- Env: `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY` (deploy), `TRIGGER_ACCESS_TOKEN` (CLI/MCP).
- Local dev: `npx trigger.dev@latest dev`. Deploy: `npx trigger.dev@latest deploy`.

## 2. LLM via OpenRouter (feat-014/015/017)

- Provision an **OpenRouter** API key → `OPENROUTER_API_KEY`.
- AI SDK provider `@openrouter/ai-sdk-provider` is wrapped by the model factory
  `trigger/lib/ai.ts`: `getModel(modelId?)` returns an AI SDK `LanguageModel`, default
  `anthropic/claude-sonnet-4-6` (swap by model id). Structured extraction uses
  `generateObject` + a Zod schema (feat-015); drafting uses `generateText`/`generateObject`
  (feat-017).

## 3. FastAPI data API (feat-014/016/017)

- Tasks write `workflow_items` via the FastAPI `hitl` router (not the Next.js webhook) —
  see `api/db/models.py` header. The typed client `trigger/lib/data-api.ts`
  (`getDataApi()` → `createItem` / `updateItem` / `getItem` / `listItems`) mirrors the
  Pydantic shapes in `api/models/schemas.py`.
- Needs the deployed base URL → `DATA_API_BASE_URL` (+ optional `DATA_API_TOKEN` bearer).
- `DATABASE_URL` (asyncpg) for the FastAPI service itself.

## 4. Gmail intake (feat-015)

**In-repo (done):** the intake engine is wired and offline-checked:

- `trigger/lib/rfq.ts` — `RfqSchema` (Zod) + `normalizeEquipment` (free text ↔ lane
  `equipment_code` V/R/F/SD/DD) + `parseWeight`/`formatLane`/`reconcileEquipment` parser
  helpers + `buildExtractionPrompt`. Pure, unit-tested (`trigger/lib/rfq.test.ts`).
- `trigger/lib/gmail.ts` — `parsePubSubPush` (decode the Pub/Sub envelope → Gmail
  notification), `parseGmailMessage`/`extractPlainText`/`getHeader` (flatten a Gmail message),
  and a thin `GmailClient` (`getMessage`, `addedMessageIds`) that takes an access token. Pure
  parsers are unit-tested (`trigger/lib/gmail.test.ts`).
- `trigger/quote-desk-intake.ts` — the `quote-desk-intake` task: list added messages →
  fetch → `generateObject` with `RfqSchema` over OpenRouter (Claude default) → emit validated
  `RfqPayload[]` (consumed by feat-017). Plus the `quote-desk-poll` **scheduled fallback**
  (hourly cron, replays from `GMAIL_START_HISTORY_ID` when push is down).
- `app/api/gmail/push/route.ts` — the **push URL**: verifies `PUBSUB_VERIFICATION_TOKEN`,
  decodes the envelope, and `tasks.trigger("quote-desk-intake", …)`.

**Manual cloud setup (you do this):**

1. **Enable the Gmail API** in a Google Cloud project. Create a service account with
   **domain-wide delegation**, granting scope `https://www.googleapis.com/auth/gmail.readonly`
   (add `gmail.send` now if doing feat-017) for `quotes@halberd-co.com`.
2. **Pub/Sub topic** — e.g. `projects/<proj>/topics/gmail-rfq`. Grant
   `gmail-api-push@system.gserviceaccount.com` the **Pub/Sub Publisher** role on it.
3. **Push subscription** on that topic with push endpoint
   `https://<app-host>/api/gmail/push?token=$PUBSUB_VERIFICATION_TOKEN`. Record topic,
   subscription, and push URL here.
4. **Start the watch:** call Gmail `users.watch` for the mailbox with
   `{ topicName, labelIds: ["INBOX"] }`. It returns a `historyId`; watches **expire in 7 days**,
   so re-issue `users.watch` on a schedule. Seed `GMAIL_START_HISTORY_ID` for the poll fallback.
5. **Token storage/refresh:** mint a delegated access token for the mailbox and supply it via
   `GMAIL_ACCESS_TOKEN` (the scaffold's `resolveGmailToken`); production should refresh it
   rather than pin a static token.

**Env added by feat-015:** `GMAIL_ACCESS_TOKEN`, `PUBSUB_VERIFICATION_TOKEN`,
`GMAIL_WATCH_ADDRESS` (default `quotes@halberd-co.com`), `GMAIL_START_HISTORY_ID` (poll fallback).

## 5. Gmail send (feat-017)

- Same OAuth scope must allow `gmail.send` (or a transactional sender) to deliver the
  approved quote reply to the shipper, threaded onto the original RFQ where possible.

---

## Environment variables (summary)

| Var | Used by | Notes |
|---|---|---|
| `TRIGGER_PROJECT_REF` / `TRIGGER_SECRET_KEY` / `TRIGGER_ACCESS_TOKEN` | trigger.dev | project + deploy + CLI |
| `OPENROUTER_API_KEY` | extract/draft tasks | LLM via AI SDK (`trigger/lib/ai.ts`) |
| `DATA_API_BASE_URL` / `DATA_API_TOKEN` | tasks → FastAPI | write workflow_items (`trigger/lib/data-api.ts`); token optional |
| `DATABASE_URL` | FastAPI | asyncpg connection |
| `GMAIL_ACCESS_TOKEN` | intake task / Gmail client | delegated read token for `quotes@halberd-co.com` |
| `PUBSUB_VERIFICATION_TOKEN` | `/api/gmail/push` | shared `?token=` verifying the push subscription |
| `GMAIL_WATCH_ADDRESS` | poll fallback | watched mailbox (default `quotes@halberd-co.com`) |
| `GMAIL_START_HISTORY_ID` | `quote-desk-poll` | history cursor for the scheduled fallback |
| `GOOGLE_*` / Gmail OAuth creds, `PUBSUB_*` | Gmail intake/send | enablement + push sub |
