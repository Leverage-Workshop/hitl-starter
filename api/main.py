"""Halberd & Co FastAPI data API.

Read/write access to the shared Neon database for trigger.dev workflow tasks.

Run locally (from api/ directory):
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from db.session import engine
from routers import (
    carrier_reconciliation,
    carriers,
    hitl,
    lanes,
    loads,
    quote_desk,
    rate_snapshots,
    shipper_reactivation,
    shippers,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="Halberd & Co Data API",
    description="Database access layer for trigger.dev workflow tasks.",
    version="0.1.0",
    lifespan=lifespan,
)

# Domain CRUD
app.include_router(shippers.router)
app.include_router(carriers.router)
app.include_router(lanes.router)
app.include_router(loads.router)
app.include_router(rate_snapshots.router)

# HITL queue
app.include_router(hitl.router)

# Workflow-specific query shortcuts
app.include_router(quote_desk.router)
app.include_router(shipper_reactivation.router)
app.include_router(carrier_reconciliation.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
