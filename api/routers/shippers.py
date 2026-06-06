"""Shippers CRUD router."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Shipper
from db.session import get_session
from models.schemas import ShipperCreate, ShipperOut, ShipperUpdate

router = APIRouter(prefix="/shippers", tags=["shippers"])


@router.get("", response_model=list[ShipperOut])
async def list_shippers(
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[Shipper]:
    query = select(Shipper).order_by(Shipper.company_name)
    if status:
        query = query.where(Shipper.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/{shipper_id}", response_model=ShipperOut)
async def get_shipper(
    shipper_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Shipper:
    shipper = await session.get(Shipper, shipper_id)
    if shipper is None:
        raise HTTPException(status_code=404, detail="shipper not found")
    return shipper


@router.post("", response_model=ShipperOut, status_code=201)
async def create_shipper(
    body: ShipperCreate, session: AsyncSession = Depends(get_session)
) -> Shipper:
    shipper = Shipper(**body.model_dump())
    session.add(shipper)
    await session.commit()
    await session.refresh(shipper)
    return shipper


@router.patch("/{shipper_id}", response_model=ShipperOut)
async def update_shipper(
    shipper_id: uuid.UUID,
    body: ShipperUpdate,
    session: AsyncSession = Depends(get_session),
) -> Shipper:
    shipper = await session.get(Shipper, shipper_id)
    if shipper is None:
        raise HTTPException(status_code=404, detail="shipper not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(shipper, field, value)
    shipper.updated_at = dt.datetime.now(dt.timezone.utc)
    await session.commit()
    await session.refresh(shipper)
    return shipper


@router.delete("/{shipper_id}", status_code=204, response_model=None, response_class=Response)
async def delete_shipper(
    shipper_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> None:
    shipper = await session.get(Shipper, shipper_id)
    if shipper is None:
        raise HTTPException(status_code=404, detail="shipper not found")
    await session.delete(shipper)
    await session.commit()
