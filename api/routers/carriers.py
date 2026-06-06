"""Carriers CRUD router."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Carrier
from db.session import get_session
from models.schemas import CarrierCreate, CarrierOut, CarrierUpdate

router = APIRouter(prefix="/carriers", tags=["carriers"])


@router.get("", response_model=list[CarrierOut])
async def list_carriers(
    is_active: bool | None = None,
    tier: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[Carrier]:
    query = select(Carrier).order_by(Carrier.company_name)
    if is_active is not None:
        query = query.where(Carrier.is_active == is_active)
    if tier:
        query = query.where(Carrier.tier == tier)
    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/{carrier_id}", response_model=CarrierOut)
async def get_carrier(
    carrier_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Carrier:
    carrier = await session.get(Carrier, carrier_id)
    if carrier is None:
        raise HTTPException(status_code=404, detail="carrier not found")
    return carrier


@router.post("", response_model=CarrierOut, status_code=201)
async def create_carrier(
    body: CarrierCreate, session: AsyncSession = Depends(get_session)
) -> Carrier:
    carrier = Carrier(**body.model_dump())
    session.add(carrier)
    await session.commit()
    await session.refresh(carrier)
    return carrier


@router.patch("/{carrier_id}", response_model=CarrierOut)
async def update_carrier(
    carrier_id: uuid.UUID,
    body: CarrierUpdate,
    session: AsyncSession = Depends(get_session),
) -> Carrier:
    carrier = await session.get(Carrier, carrier_id)
    if carrier is None:
        raise HTTPException(status_code=404, detail="carrier not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(carrier, field, value)
    carrier.updated_at = dt.datetime.now(dt.timezone.utc)
    await session.commit()
    await session.refresh(carrier)
    return carrier


@router.delete("/{carrier_id}", status_code=204, response_model=None, response_class=Response)
async def delete_carrier(
    carrier_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> None:
    carrier = await session.get(Carrier, carrier_id)
    if carrier is None:
        raise HTTPException(status_code=404, detail="carrier not found")
    await session.delete(carrier)
    await session.commit()
