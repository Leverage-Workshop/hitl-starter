"""Carrier Invoice Reconciliation router — read access to invoice discrepancies."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Load
from api.db.session import get_session
from api.models.schemas import LoadOut

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
