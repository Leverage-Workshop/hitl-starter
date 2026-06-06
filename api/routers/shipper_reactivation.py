"""Shipper Reactivation router — read access to dormant shippers."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Shipper
from db.session import get_session
from models.schemas import ShipperOut

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
