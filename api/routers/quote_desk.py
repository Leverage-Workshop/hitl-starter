"""Quote Desk router — read access to pending RFQs."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Load
from api.db.session import get_session
from api.models.schemas import LoadOut

router = APIRouter(prefix="/workflows/quote-desk", tags=["quote_desk"])


@router.get("/pending", response_model=list[LoadOut])
async def list_pending_rfqs(session: AsyncSession = Depends(get_session)) -> list[Load]:
    """Pending RFQs awaiting a quote."""
    result = await session.execute(
        select(Load).where(Load.status == "pending").order_by(Load.created_at)
    )
    return list(result.scalars().all())
