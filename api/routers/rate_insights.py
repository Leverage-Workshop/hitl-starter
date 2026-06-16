"""RateInsights router — mock Truckstop.com rate-estimate endpoint.

Approximates the Truckstop RateInsights API shape from the local ``lanes`` +
``rate_snapshots`` tables. The matching/aggregation is delegated to the pure,
offline-testable helper in ``services/rate_insights.py``; this router only fetches
candidate rows, maps them onto the helper's dataclasses, and (optionally) persists
the lookup back as a ``rate_source='truckstop'`` snapshot.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Lane, RateSnapshot
from db.session import get_session
from models.schemas import RateInsightsEstimateOut, RateInsightsRequest
from services.rate_insights import (
    Comparable,
    LaneAggregate,
    estimate_rate,
)

router = APIRouter(prefix="/rate-insights", tags=["rate_insights"])

# How far back a rate_snapshot can be captured and still count as a comparable.
RECENT_WINDOW_DAYS = 90


def _f(value: object) -> float | None:
    """Numeric/Decimal → float, preserving None."""
    return float(value) if value is not None else None  # type: ignore[arg-type]


@router.post("/estimate", response_model=RateInsightsEstimateOut)
async def estimate(
    body: RateInsightsRequest,
    persist: bool = False,
    session: AsyncSession = Depends(get_session),
) -> RateInsightsEstimateOut:
    """Derive a low/avg/high rate band + confidence for an origin→destination lane.

    Pass ``?persist=true`` to record the lookup as a ``truckstop`` rate_snapshot
    (only when a matching lane is found, so the snapshot can be tied to a lane id).
    """
    now = dt.datetime.now(dt.timezone.utc)
    cutoff = now - dt.timedelta(days=RECENT_WINDOW_DAYS)

    # Best-matching lane (exact city/state + equipment) for the aggregate fallback,
    # estimated mileage, and to anchor a persisted snapshot.
    lane_row = (
        await session.execute(
            select(Lane).where(
                func.lower(Lane.origin_city) == body.origin_city.strip().lower(),
                Lane.origin_state_code == body.origin_state_code,
                func.lower(Lane.destination_city) == body.destination_city.strip().lower(),
                Lane.destination_state_code == body.destination_state_code,
                Lane.equipment_code == body.equipment_code,
            )
        )
    ).scalars().first()

    # Candidate comps: any recent snapshot on the same state pair + equipment. The
    # helper narrows this to exact-city vs. loose-state tiers.
    snap_rows = (
        await session.execute(
            select(RateSnapshot).where(
                RateSnapshot.equipment_code == body.equipment_code,
                RateSnapshot.origin_state_code == body.origin_state_code,
                RateSnapshot.destination_state_code == body.destination_state_code,
                RateSnapshot.captured_at >= cutoff,
            )
        )
    ).scalars().all()

    comparables = [
        Comparable(
            avg_rate_per_mile=_f(s.avg_rate_per_mile),
            low_rate_per_mile=_f(s.low_rate_per_mile),
            high_rate_per_mile=_f(s.high_rate_per_mile),
            fuel_surcharge_per_mile=_f(s.fuel_surcharge_per_mile),
            mileage=s.mileage,
            captured_at=s.captured_at,
            equipment_code=s.equipment_code,
            origin_city=s.origin_city,
            origin_state_code=s.origin_state_code,
            destination_city=s.destination_city,
            destination_state_code=s.destination_state_code,
        )
        for s in snap_rows
    ]

    lane_agg = (
        LaneAggregate(
            estimated_miles=lane_row.estimated_miles,
            avg_carrier_rate_per_mile=_f(lane_row.avg_carrier_rate_per_mile),
            avg_shipper_rate_per_mile=_f(lane_row.avg_shipper_rate_per_mile),
            avg_margin_percent=_f(lane_row.avg_margin_percent),
            load_count=lane_row.load_count,
        )
        if lane_row is not None
        else None
    )

    est = estimate_rate(
        equipment_code=body.equipment_code,
        origin_city=body.origin_city,
        origin_state_code=body.origin_state_code,
        destination_city=body.destination_city,
        destination_state_code=body.destination_state_code,
        comparables=comparables,
        lane=lane_agg,
        reference=now,
        recent_window_days=RECENT_WINDOW_DAYS,
    )

    if persist and lane_row is not None and est.avg_rate_per_mile is not None:
        session.add(
            RateSnapshot(
                lane_id=lane_row.id,
                rate_source="truckstop",
                rate_type="posted",
                low_rate_per_mile=est.low_rate_per_mile,
                avg_rate_per_mile=est.avg_rate_per_mile,
                high_rate_per_mile=est.high_rate_per_mile,
                fuel_surcharge_per_mile=est.fuel_surcharge_per_mile,
                equipment_code=body.equipment_code,
                origin_city=body.origin_city,
                origin_state_code=body.origin_state_code,
                destination_city=body.destination_city,
                destination_state_code=body.destination_state_code,
                mileage=est.mileage,
                raw_response={
                    "match_tier": est.match_tier,
                    "comparable_count": est.comparable_count,
                    "confidence_score": est.confidence_score,
                    "confidence_level": est.confidence_level,
                },
            )
        )
        await session.commit()

    return RateInsightsEstimateOut(
        origin_city=body.origin_city,
        origin_state_code=body.origin_state_code,
        destination_city=body.destination_city,
        destination_state_code=body.destination_state_code,
        equipment_code=body.equipment_code,
        pickup_date=body.pickup_date,
        mileage=est.mileage,
        low_rate_per_mile=est.low_rate_per_mile,
        avg_rate_per_mile=est.avg_rate_per_mile,
        high_rate_per_mile=est.high_rate_per_mile,
        fuel_surcharge_per_mile=est.fuel_surcharge_per_mile,
        total_low=est.total_low,
        total_avg=est.total_avg,
        total_high=est.total_high,
        match_tier=est.match_tier,
        comparable_count=est.comparable_count,
        confidence_score=est.confidence_score,
        confidence_level=est.confidence_level,
        as_of=est.as_of,
    )
