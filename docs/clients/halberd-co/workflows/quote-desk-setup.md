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
- [ ] Gmail API enabled + OAuth for `quotes@halberd-co.com` (feat-015)
- [ ] Google Pub/Sub topic + push subscription → trigger.dev endpoint (feat-015)
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
| `OPENROUTER_API_KEY` | extract/draft tasks | LLM via AI SDK (`trigger/lib/ai.ts`) |
| `DATA_API_BASE_URL` / `DATA_API_TOKEN` | tasks → FastAPI | write workflow_items (`trigger/lib/data-api.ts`); token optional |
| `DATABASE_URL` | FastAPI | asyncpg connection |
| `GOOGLE_*` / Gmail OAuth creds, `PUBSUB_*` | Gmail intake/send | enablement + push sub |
