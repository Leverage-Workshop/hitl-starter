"""Lanes CRUD router."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Lane
from api.db.session import get_session
from api.models.schemas import LaneCreate, LaneOut, LaneUpdate

router = APIRouter(prefix="/lanes", tags=["lanes"])


@router.get("", response_model=list[LaneOut])
async def list_lanes(
    is_active: bool | None = None,
    equipment_code: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[Lane]:
    query = select(Lane).order_by(Lane.origin_state_code, Lane.origin_city)
    if is_active is not None:
        query = query.where(Lane.is_active == is_active)
    if equipment_code:
        query = query.where(Lane.equipment_code == equipment_code)
    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/{lane_id}", response_model=LaneOut)
async def get_lane(
    lane_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Lane:
    lane = await session.get(Lane, lane_id)
    if lane is None:
        raise HTTPException(status_code=404, detail="lane not found")
    return lane


@router.post("", response_model=LaneOut, status_code=201)
async def create_lane(
    body: LaneCreate, session: AsyncSession = Depends(get_session)
) -> Lane:
    lane = Lane(**body.model_dump())
    session.add(lane)
    await session.commit()
    await session.refresh(lane)
    return lane


@router.patch("/{lane_id}", response_model=LaneOut)
async def update_lane(
    lane_id: uuid.UUID,
    body: LaneUpdate,
    session: AsyncSession = Depends(get_session),
) -> Lane:
    lane = await session.get(Lane, lane_id)
    if lane is None:
        raise HTTPException(status_code=404, detail="lane not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(lane, field, value)
    lane.updated_at = dt.datetime.now(dt.timezone.utc)
    await session.commit()
    await session.refresh(lane)
    return lane


@router.delete("/{lane_id}", status_code=204, response_model=None, response_class=Response)
async def delete_lane(
    lane_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> None:
    lane = await session.get(Lane, lane_id)
    if lane is None:
        raise HTTPException(status_code=404, detail="lane not found")
    await session.delete(lane)
    await session.commit()
