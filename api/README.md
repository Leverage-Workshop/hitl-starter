# Halberd & Co — FastAPI Workflow Service

The workflow-execution half of the `hitl-starter` demo. It runs the four Halberd
LangGraph workflows over a shared **Neon** Postgres database and hands drafts off
to the Next.js HITL console by writing `workflow_items` rows.

- **Frontend + HITL console:** Next.js (repo root) → Drizzle → Neon
- **Workflow execution:** this service (FastAPI) → SQLAlchemy async → Neon
- **Job queue:** trigger.dev calls these endpoints as jobs

Both services share one Neon database via separate connection strings. FastAPI
does not expose a data API to the frontend — data fetching stays in Next.js/Drizzle.

## Layout

```
api/
├── main.py                  FastAPI app (lifespan-managed async engine)
├── config.py                Settings (DATABASE_URL, ANTHROPIC_API_KEY, …)
├── requirements.txt
├── .env.example             Copy to api/.env (separate from the Next.js .env)
├── db/
│   ├── session.py           Async engine + async_sessionmaker
│   ├── models.py            SQLAlchemy ORM models (mirror the SQL schema)
│   └── migrations/
│       └── 001_initial_schema.sql   Hand-written schema (source of truth)
│   └── seed.sql             Domain seed data (fixed UUIDs)
├── routers/                 One router per workflow
├── workflows/               LangGraph workflow definitions (one package each)
├── models/                  Pydantic request/response shapes
├── alembic.ini
└── alembic/                 Migration env (async) + versions/
```

## Domain schema

Five operational tables, modelled on the Truckstop API data model so a future
live integration is a connector swap rather than a schema change:

| Table | Purpose |
|---|---|
| `shippers` | Customers. Operational layer (Neon); relationship layer lives in HubSpot, joined via `hubspot_company_id`. |
| `carriers` | Carrier network + FMCSA/CarrierHub compliance fields. |
| `lanes` | Origin–destination corridors + internal rate history. |
| `loads` | The atomic unit — joins shipper, carrier, lane. `gross_margin` is a generated column. |
| `rate_snapshots` | Market rate data captured at quote time (append-only). |

The HITL console's own `workflows` / `workflow_items` tables live in the
Next.js/Drizzle schema and are **not** created here.

## Setup

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in DATABASE_URL (postgresql+asyncpg://…)
```

`DATABASE_URL` **must** use the `postgresql+asyncpg://` scheme — not the plain
`postgresql://` scheme the Next.js side uses.

## Database bootstrap (order matters)

```bash
# 1. Apply the schema (runs 001_initial_schema.sql)
cd api && alembic upgrade head

# 2. Seed the domain tables (fixed UUIDs, referenced by the TS workflow seed)
psql "$PSQL_DATABASE_URL" -f db/seed.sql        # plain postgresql:// URL for psql

# 3. Seed workflows + workflow_items (from the repo root)
cd .. && npx tsx scripts/seed-workflows.ts
```

> `seed.sql` is idempotent — it truncates the five domain tables before
> re-seeding. It never touches `workflows` / `workflow_items`.
>
> Use a plain `postgresql://` URL for the `psql` step; the `+asyncpg` scheme is
> a SQLAlchemy driver selector and is not understood by `psql`.

## Run

```bash
uvicorn api.main:app --reload --port 8000   # from the repo root
```

Then e.g. `GET http://localhost:8000/health`,
`GET /workflows/quote-desk/pending`,
`GET /workflows/carrier-reconciliation/discrepancies`.

## Deployment

Deployed on **Render** as a Web Service pointed at `api/`. Required env vars:
`DATABASE_URL` (asyncpg scheme), `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, plus
any trigger.dev job-verification secrets.
