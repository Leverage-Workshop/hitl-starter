"""Carrier Invoice Reconciliation router.

Surfaces loads whose carrier-billed amount differs from the agreed
``carrier_rate`` (``carrier_invoice_status = 'discrepancy'``). Matched invoices
auto-approve; discrepancies become ``workflow_items`` rows with a recommended
resolution for HITL review.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Load
from api.db.session import get_session
from api.models.schemas import LoadOut, ReconciliationTrigger, WorkflowRunResult

router = APIRouter(
    prefix="/workflows/carrier-reconciliation", tags=["carrier_reconciliation"]
)


@router.get("/discrepancies", response_model=list[LoadOut])
async def list_discrepancies(session: AsyncSession = Depends(get_session)) -> list[Load]:
    """Loads with a carrier-invoice discrepancy awaiting reconciliation."""
    result = await session.execute(
        select(Load)
        .where(Load.carrier_invoice_status == "discrepancy")
        .order_by(Load.invoice_discrepancy_amt.desc().nulls_last())
    )
    return list(result.scalars().all())


@router.post("/run", response_model=WorkflowRunResult)
async def run_carrier_reconciliation(
    payload: ReconciliationTrigger,
    session: AsyncSession = Depends(get_session),
) -> WorkflowRunResult:
    """Reconcile carrier invoices; route discrepancies to HITL review."""
    query = select(Load).where(Load.carrier_invoice_amount.is_not(None))
    if payload.only_discrepancies:
        query = query.where(Load.carrier_invoice_status == "discrepancy")

    result = await session.execute(query)
    loads = list(result.scalars().all())

    # TODO: for each discrepancy, draft a recommended resolution with LangGraph,
    # update loads.carrier_invoice_status, and create a workflow_items row.

    return WorkflowRunResult(
        workflow="carrier_invoice_reconciliation",
        items_created=0,
        detail=f"{len(loads)} invoice(s) to reconcile; HITL writeback pending.",
    )
