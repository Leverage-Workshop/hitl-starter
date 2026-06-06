# Halberd & Co — FastAPI Data API

A lightweight data access layer over the shared Neon Postgres database. trigger.dev workflow tasks call this API to read and write domain data, and to enqueue items into the HITL review queue.

- **Frontend + HITL console:** Next.js (repo root) → Drizzle → Neon
- **Workflow execution:** trigger.dev tasks → this API → Neon
- **Human review:** Next.js console reads `workflow_items` via Drizzle

## Endpoints

### Shippers

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/shippers` | `?status=active\|inactive\|prospect` |
| `GET` | `/shippers/{id}` | |
| `POST` | `/shippers` | |
| `PATCH` | `/shippers/{id}` | |
| `DELETE` | `/shippers/{id}` | |

### Carriers

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/carriers` | `?is_active=true\|false &tier=preferred\|backup\|spot` |
| `GET` | `/carriers/{id}` | |
| `POST` | `/carriers` | |
| `PATCH` | `/carriers/{id}` | |
| `DELETE` | `/carriers/{id}` | |

### Lanes

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/lanes` | `?is_active=true\|false &equipment_code=V\|R\|F\|SD\|DD` |
| `GET` | `/lanes/{id}` | |
| `POST` | `/lanes` | |
| `PATCH` | `/lanes/{id}` | |
| `DELETE` | `/lanes/{id}` | |

### Loads

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/loads` | `?status= &shipper_id= &carrier_id=` |
| `GET` | `/loads/{id}` | |
| `POST` | `/loads` | `gross_margin` is a computed column — never set directly |
| `PATCH` | `/loads/{id}` | |
| `DELETE` | `/loads/{id}` | |

### Rate Snapshots (append-only)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/rate-snapshots` | `?load_id= &lane_id=` |
| `GET` | `/rate-snapshots/{id}` | |
| `POST` | `/rate-snapshots` | |

### HITL queue

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/workflows` | List all registered workflows |
| `GET` | `/workflows/{id}` | Workflow config (item schema, actions) |
| `GET` | `/workflows/{id}/items` | `?status=pending\|approved\|rejected\|…` |
| `GET` | `/workflow-items/{id}` | |
| `POST` | `/workflow-items` | Enqueue a draft for review — idempotent on `id` |
| `PATCH` | `/workflow-items/{id}` | Settle status, revise proposed output, append context |

### Workflow query shortcuts

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/workflows/quote-desk/pending` | Loads with `status = pending` |
| `GET` | `/workflows/shipper-reactivation/dormant` | `?dormant_days_threshold=45` |
| `GET` | `/workflows/carrier-reconciliation/discrepancies` | Loads with invoice discrepancies |

### Meta

| Method | Path |
|--------|------|
| `GET` | `/health` |

Full interactive docs: `http://localhost:8000/docs`

## Layout

```
api/
├── main.py                  FastAPI app entry point
├── config.py                Settings (DATABASE_URL, …)
├── requirements.txt
├── pyproject.toml
├── .python-version          Pins Python 3.12
├── .env.example             Copy to api/.env
├── db/
│   ├── session.py           Async engine + session factory
│   ├── models.py            SQLAlchemy ORM models (domain + HITL tables)
│   └── migrations/
│       └── 001_initial_schema.sql   Domain table schema (source of truth)
│   └── seed.sql             Domain seed data
├── routers/
│   ├── hitl.py              workflow + workflow_items read/write
│   ├── shippers.py          CRUD
│   ├── carriers.py          CRUD
│   ├── lanes.py             CRUD
│   ├── loads.py             CRUD
│   ├── rate_snapshots.py    append-only
│   ├── quote_desk.py        pending RFQ query shortcut
│   ├── shipper_reactivation.py  dormant shipper query shortcut
│   └── carrier_reconciliation.py  invoice discrepancy query shortcut
├── models/
│   └── schemas.py           Pydantic request/response shapes
├── alembic.ini
└── alembic/                 Migration env + versions/
```

## Setup

```bash
cd api
uv venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL (postgresql+asyncpg://…)
```

`DATABASE_URL` must use the `postgresql+asyncpg://` scheme.

## Database bootstrap

```bash
# 1. Apply the domain schema
cd api && alembic upgrade head

# 2. Seed everything (from repo root): admin user + domain tables + workflows/items
npx tsx scripts/seed.ts
```

## Run

```bash
uvicorn api.main:app --reload --port 8000   # from the repo root
```

## Deployment

Deployed on **Render** as a Web Service pointed at `api/`. Required env vars:
`DATABASE_URL` (asyncpg scheme) and any trigger.dev job-verification secrets.
