# Quote Desk — Infrastructure & Third-Party Setup

> **Living doc.** This tracks every piece of external infrastructure, credential, and
> third-party service the quote-desk workflow engine needs. Each implementing feature
> (feat-014…feat-017) appends what it discovers here as it is built. If you hit a new
> credential, API enablement, or config step while implementing, add it.

The *what* of the workflow lives in [`quote-desk.md`](quote-desk.md). This file is the
*how do I stand up the plumbing* companion.

## Status checklist

- [ ] trigger.dev project created + CLI authed (feat-014)
- [ ] OpenRouter API key provisioned (feat-014)
- [ ] FastAPI data-API client reachable from tasks (feat-014)
- [ ] Gmail API enabled + OAuth for `quotes@halberd-co.com` (feat-015)
- [ ] Google Pub/Sub topic + push subscription → trigger.dev endpoint (feat-015)
- [ ] RateInsights endpoint deployed in FastAPI (feat-016)
- [ ] Gmail send capability for the approved-quote reply (feat-017)

---

## 1. trigger.dev (feat-014)

- Create a trigger.dev project (cloud or self-hosted); note the **project ref**.
- `npx trigger.dev@latest login` / `init`; commit `trigger.config.ts` and the `trigger/` dir.
- Env: `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY` (deploy), `TRIGGER_ACCESS_TOKEN` (CLI/MCP).
- Deploy with `npx trigger.dev@latest deploy`; local dev with `npx trigger.dev@latest dev`.

## 2. LLM via OpenRouter (feat-014/015/017)

- Provision an **OpenRouter** API key → `OPENROUTER_API_KEY`.
- AI SDK provider: `@openrouter/ai-sdk-provider`. Default model `anthropic/claude-sonnet-4-6`
  (swap by model id). Structured extraction uses `generateObject` + a Zod schema; drafting
  uses `generateText`/`generateObject`.

## 3. FastAPI data API (feat-014/016/017)

- Tasks write `workflow_items` via the FastAPI `hitl` router (not the Next.js webhook) —
  see `api/db/models.py` header. Needs the deployed base URL → `DATA_API_BASE_URL`
  (+ any auth header the API requires).
- `DATABASE_URL` (asyncpg) for the FastAPI service itself.

## 4. Gmail intake (feat-015)

- Enable the **Gmail API** in a Google Cloud project; OAuth client/service-account with
  domain-wide delegation for `quotes@halberd-co.com`.
- Real-time path: `users.watch` → **Pub/Sub** topic → push subscription POSTing to a
  trigger.dev HTTP-trigger endpoint. Record topic name, subscription, and the push URL.
- Token storage/refresh strategy for the mailbox.

## 5. Gmail send (feat-017)

- Same OAuth scope must allow `gmail.send` (or a transactional sender) to deliver the
  approved quote reply to the shipper, threaded onto the original RFQ where possible.

---

## Environment variables (summary)

| Var | Used by | Notes |
|---|---|---|
| `TRIGGER_PROJECT_REF` / `TRIGGER_SECRET_KEY` / `TRIGGER_ACCESS_TOKEN` | trigger.dev | project + deploy + CLI |
| `OPENROUTER_API_KEY` | extract/draft tasks | LLM via AI SDK |
| `DATA_API_BASE_URL` | tasks → FastAPI | write workflow_items |
| `DATABASE_URL` | FastAPI | asyncpg connection |
| `GOOGLE_*` / Gmail OAuth creds, `PUBSUB_*` | Gmail intake/send | enablement + push sub |
