"""Halberd & Co FastAPI workflow service.

Entry point for the Render-hosted workflow service. trigger.dev calls these
endpoints as jobs; each workflow router runs its LangGraph definition, reads/
writes the Neon domain tables, and hands drafts off to the HITL console by
writing ``workflow_items`` rows.

Run locally:
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.db.session import engine
from api.routers import (
    carrier_reconciliation,
    quote_desk,
    shipper_reactivation,
    weekly_digest,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup — engine is created at import time in api.db.session
    yield
    # shutdown — dispose the connection pool cleanly
    await engine.dispose()


app = FastAPI(
    title="Halberd & Co Workflow Service",
    description="LangGraph HITL workflow runners over the Neon operational schema.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(quote_desk.router)
app.include_router(shipper_reactivation.router)
app.include_router(weekly_digest.router)
app.include_router(carrier_reconciliation.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
