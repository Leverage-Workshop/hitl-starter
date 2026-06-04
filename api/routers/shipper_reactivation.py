"""Shipper Reactivation router.

Finds dormant shippers (status ``inactive`` / stale ``last_load_date``) and, when
fully built, drafts a re-engagement outreach email per shipper and creates a
``workflow_items`` row for each. Contact details are fetched from HubSpot at
draft time via ``hubspot_company_id`` (no live connection required for the demo).
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Shipper
from api.db.session import get_session
from api.models.schemas import ReactivationTrigger, ShipperOut, WorkflowRunResult

router = APIRouter(prefix="/workflows/shipper-reactivation", tags=["shipper_reactivation"])


@router.get("/dormant", response_model=list[ShipperOut])
async def list_dormant_shippers(
    dormant_days_threshold: int = 45,
    session: AsyncSession = Depends(get_session),
) -> list[Shipper]:
    """Shippers eligible for reactivation outreach."""
    cutoff = dt.date.today() - dt.timedelta(days=dormant_days_threshold)
    result = await session.execute(
        select(Shipper)
        .where(
            or_(
                Shipper.status == "inactive",
                Shipper.last_load_date < cutoff,
            )
        )
        .order_by(Shipper.last_load_date.asc().nulls_last())
    )
    return list(result.scalars().all())


@router.post("/run", response_model=WorkflowRunResult)
async def run_shipper_reactivation(
    payload: ReactivationTrigger,
    session: AsyncSession = Depends(get_session),
) -> WorkflowRunResult:
    """Sweep dormant shippers and prepare a draft outreach for each."""
    cutoff = dt.date.today() - dt.timedelta(days=payload.dormant_days_threshold)
    result = await session.execute(
        select(Shipper).where(
            or_(Shipper.status == "inactive", Shipper.last_load_date < cutoff)
        )
    )
    dormant = list(result.scalars().all())

    # TODO: for each dormant shipper, fetch HubSpot contact via hubspot_company_id,
    # draft outreach email with LangGraph, and create a workflow_items row.

    return WorkflowRunResult(
        workflow="shipper_reactivation",
        items_created=0,
        detail=f"{len(dormant)} dormant shippers identified; HITL writeback pending.",
    )
