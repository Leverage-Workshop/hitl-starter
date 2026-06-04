"""Weekly Margin & Ops Digest router.

Aggregates the trailing period's loads and carrier performance, writes back
carrier scorecard fields, and (when fully built) creates a single
``workflow_items`` row carrying the draft digest narrative for approval.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Load
from api.db.session import get_session
from api.models.schemas import WeeklyDigestTrigger, WorkflowRunResult

router = APIRouter(prefix="/workflows/weekly-digest", tags=["weekly_digest"])


@router.post("/run", response_model=WorkflowRunResult)
async def run_weekly_digest(
    payload: WeeklyDigestTrigger,
    session: AsyncSession = Depends(get_session),
) -> WorkflowRunResult:
    """Compute the period digest metrics and prepare the draft narrative."""
    cutoff = dt.date.today() - dt.timedelta(days=payload.period_days)

    result = await session.execute(
        select(
            func.count(Load.id),
            func.coalesce(func.sum(Load.gross_margin), Decimal("0")),
            func.coalesce(func.avg(Load.margin_percent), Decimal("0")),
        ).where(
            Load.pickup_date >= cutoff,
            Load.status.in_(("completed", "invoiced", "paid")),
        )
    )
    load_count, total_margin, avg_margin_pct = result.one()

    # TODO: write back carrier scorecard fields (on_time_rate, loads_completed,
    # invoice_accuracy_rate) and create the single digest workflow_items row.

    return WorkflowRunResult(
        workflow="weekly_margin_digest",
        items_created=0,
        detail=(
            f"Period {payload.period_days}d: {load_count} loads, "
            f"${total_margin} gross margin, {avg_margin_pct}% avg margin; "
            "HITL writeback pending."
        ),
    )
