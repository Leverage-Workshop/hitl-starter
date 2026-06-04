"""Quote Desk router.

Reads ``lanes``, ``shippers`` and ``rate_snapshots`` for pricing intelligence and
(when fully built) drafts a quote, writes a new ``loads`` record + a
``rate_snapshots`` row, and creates a ``workflow_items`` row for HITL review.

This module wires the read side against Neon; the LangGraph drafting step and
the ``workflow_items`` writeback are intentionally left as integration points.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Lane, Load, Shipper
from api.db.session import get_session
from api.models.schemas import LoadOut, QuoteDeskTrigger, WorkflowRunResult

router = APIRouter(prefix="/workflows/quote-desk", tags=["quote_desk"])


@router.get("/pending", response_model=list[LoadOut])
async def list_pending_rfqs(session: AsyncSession = Depends(get_session)) -> list[Load]:
    """Pending RFQs awaiting a quote."""
    result = await session.execute(
        select(Load).where(Load.status == "pending").order_by(Load.created_at)
    )
    return list(result.scalars().all())


@router.post("/run", response_model=WorkflowRunResult)
async def run_quote_desk(
    payload: QuoteDeskTrigger,
    session: AsyncSession = Depends(get_session),
) -> WorkflowRunResult:
    """Trigger the Quote Desk workflow for a single pending load.

    Loads the RFQ plus its lane rate history, then (TODO) runs the LangGraph
    drafting step and creates a ``workflow_items`` row with the draft quote.
    """
    load = await session.get(Load, payload.load_id)
    if load is None:
        raise HTTPException(status_code=404, detail="load not found")
    if load.status != "pending":
        raise HTTPException(status_code=409, detail=f"load is {load.status}, not pending")

    shipper = await session.get(Shipper, load.shipper_id)
    lane = await session.get(Lane, load.lane_id) if load.lane_id else None
    if lane is None:
        raise HTTPException(status_code=422, detail="load has no lane for rate lookup")

    # TODO: run LangGraph drafting on (load, shipper, lane, rate_snapshots),
    # then write the draft quote into a workflow_items row for HITL review.
    _ = shipper  # pricing context for the drafting step

    return WorkflowRunResult(
        workflow="quote_desk",
        items_created=0,
        detail=(
            f"Quote draft prepared for {load.load_number} on "
            f"{lane.origin_city}->{lane.destination_city}; HITL writeback pending."
        ),
    )
