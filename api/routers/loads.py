"""Loads CRUD router."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Load
from api.db.session import get_session
from api.models.schemas import LoadCreate, LoadOut, LoadUpdate

router = APIRouter(prefix="/loads", tags=["loads"])


@router.get("", response_model=list[LoadOut])
async def list_loads(
    status: str | None = None,
    shipper_id: uuid.UUID | None = None,
    carrier_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[Load]:
    query = select(Load).order_by(Load.created_at.desc())
    if status:
        query = query.where(Load.status == status)
    if shipper_id:
        query = query.where(Load.shipper_id == shipper_id)
    if carrier_id:
        query = query.where(Load.carrier_id == carrier_id)
    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/{load_id}", response_model=LoadOut)
async def get_load(
    load_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Load:
    load = await session.get(Load, load_id)
    if load is None:
        raise HTTPException(status_code=404, detail="load not found")
    return load


@router.post("", response_model=LoadOut, status_code=201)
async def create_load(
    body: LoadCreate, session: AsyncSession = Depends(get_session)
) -> Load:
    load = Load(**body.model_dump())
    session.add(load)
    await session.commit()
    await session.refresh(load)
    return load


@router.patch("/{load_id}", response_model=LoadOut)
async def update_load(
    load_id: uuid.UUID,
    body: LoadUpdate,
    session: AsyncSession = Depends(get_session),
) -> Load:
    load = await session.get(Load, load_id)
    if load is None:
        raise HTTPException(status_code=404, detail="load not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(load, field, value)
    load.updated_at = dt.datetime.now(dt.timezone.utc)
    await session.commit()
    await session.refresh(load)
    return load


@router.delete("/{load_id}", status_code=204, response_model=None, response_class=Response)
async def delete_load(
    load_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> None:
    load = await session.get(Load, load_id)
    if load is None:
        raise HTTPException(status_code=404, detail="load not found")
    await session.delete(load)
    await session.commit()
