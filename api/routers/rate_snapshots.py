"""Rate Snapshots router — append-only (no update or delete)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import RateSnapshot
from api.db.session import get_session
from api.models.schemas import RateSnapshotCreate, RateSnapshotOut

router = APIRouter(prefix="/rate-snapshots", tags=["rate_snapshots"])


@router.get("", response_model=list[RateSnapshotOut])
async def list_rate_snapshots(
    load_id: uuid.UUID | None = None,
    lane_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[RateSnapshot]:
    query = select(RateSnapshot).order_by(RateSnapshot.captured_at.desc())
    if load_id:
        query = query.where(RateSnapshot.load_id == load_id)
    if lane_id:
        query = query.where(RateSnapshot.lane_id == lane_id)
    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/{snapshot_id}", response_model=RateSnapshotOut)
async def get_rate_snapshot(
    snapshot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> RateSnapshot:
    snap = await session.get(RateSnapshot, snapshot_id)
    if snap is None:
        raise HTTPException(status_code=404, detail="rate snapshot not found")
    return snap


@router.post("", response_model=RateSnapshotOut, status_code=201)
async def create_rate_snapshot(
    body: RateSnapshotCreate, session: AsyncSession = Depends(get_session)
) -> RateSnapshot:
    snap = RateSnapshot(**body.model_dump())
    session.add(snap)
    await session.commit()
    await session.refresh(snap)
    return snap
