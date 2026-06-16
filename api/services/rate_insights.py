"""Pure matching + aggregation logic for the mock Truckstop.com RateInsights endpoint.

This module is deliberately free of any database, FastAPI, or SQLAlchemy imports so
it can be unit-tested offline (folds into the api/ pytest gate, feat-011/012). The
router (api/routers/rate_insights.py) is responsible for fetching candidate
``rate_snapshots`` rows and the matching ``lane`` from Postgres, mapping them onto the
plain dataclasses below, and persisting the lookup if asked.

Estimate strategy (mirrors how a broker would lean on Truckstop RateInsights):

1. ``lane_snapshots`` — recent rate_snapshots on the exact origin/destination *city*
   pair for the requested equipment. The freshest, most specific signal.
2. ``lane_aggregate`` — fall back to the lane row's denormalized averages
   (``avg_carrier_rate_per_mile`` etc.) when there are no fresh city-level comps.
3. ``loose_snapshots`` — widen to any recent snapshot on the same origin/destination
   *state* pair + equipment (city ignored).
4. ``none`` — nothing matched; the estimate carries no rate and zero confidence.

Thin history pulls confidence down; a deep, specific comp set pushes it up. The
``high`` threshold (0.75) is aligned with the quote-desk ``confidenceFloor`` so feat-017
can treat a "high" estimate as auto-pass eligible.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from statistics import median

# Default fuel surcharge per mile used when no comparable carries one. Matches the
# 0.32 $/mi baseline the seed data derives fuel from.
DEFAULT_FUEL_SURCHARGE_PER_MILE = 0.32

# Spread applied to a single average rate when low/high are unavailable (e.g. the
# lane-aggregate fallback only exposes a mean). Mirrors the ±8% / +12% band the seed
# snapshots use.
_LOW_SPREAD = 0.92
_HIGH_SPREAD = 1.12

HIGH_CONFIDENCE_THRESHOLD = 0.75
MEDIUM_CONFIDENCE_THRESHOLD = 0.5


@dataclass
class Comparable:
    """A rate_snapshots row reduced to the fields the estimator needs."""

    avg_rate_per_mile: float | None = None
    low_rate_per_mile: float | None = None
    high_rate_per_mile: float | None = None
    fuel_surcharge_per_mile: float | None = None
    mileage: int | None = None
    captured_at: dt.datetime | None = None
    equipment_code: str | None = None
    origin_city: str | None = None
    origin_state_code: str | None = None
    destination_city: str | None = None
    destination_state_code: str | None = None


@dataclass
class LaneAggregate:
    """A lanes row reduced to the denormalized averages the estimator can fall back to."""

    estimated_miles: int | None = None
    avg_carrier_rate_per_mile: float | None = None
    avg_shipper_rate_per_mile: float | None = None
    avg_margin_percent: float | None = None
    load_count: int | None = None


@dataclass
class RateEstimate:
    """The computed estimate — the router maps this onto the Pydantic response model."""

    match_tier: str
    comparable_count: int
    confidence_score: float
    confidence_level: str
    mileage: int | None
    low_rate_per_mile: float | None
    avg_rate_per_mile: float | None
    high_rate_per_mile: float | None
    fuel_surcharge_per_mile: float | None
    total_low: float | None
    total_avg: float | None
    total_high: float | None
    as_of: dt.datetime | None


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _within_window(
    captured_at: dt.datetime | None,
    reference: dt.datetime | None,
    window_days: int,
) -> bool:
    """A comp counts if it has no timestamp, no reference is given, or it is recent.

    ``reference`` is the lookup instant; comps captured on/after ``reference - window``
    qualify. Comps captured after the reference (rare; clock skew / future-dated demo
    rows) are kept — they are at least as fresh as the window.
    """
    if reference is None or captured_at is None:
        return True
    cutoff = reference - dt.timedelta(days=window_days)
    return captured_at >= cutoff


def _confidence(tier: str, count: int) -> tuple[float, str]:
    """Map (tier, comparable count) → (score in [0, 1], level label)."""
    if tier == "lane_snapshots":
        # 1 comp → 0.61, 4 → 0.79, 7+ → capped 0.95.
        score = min(0.95, 0.55 + 0.06 * count)
    elif tier == "lane_aggregate":
        # Driven by how many loads back the lane average. 5 → 0.50, 30+ → capped 0.75.
        score = min(0.75, 0.45 + 0.01 * count)
    elif tier == "loose_snapshots":
        # State-level comps are weak signal regardless of depth. 1 → 0.28, 8+ → 0.5.
        score = min(0.5, 0.25 + 0.03 * count)
    else:
        return 0.0, "none"

    score = round(score, 3)
    if score >= HIGH_CONFIDENCE_THRESHOLD:
        level = "high"
    elif score >= MEDIUM_CONFIDENCE_THRESHOLD:
        level = "medium"
    else:
        level = "low"
    return score, level


def _band_from_comps(
    comps: list[Comparable],
    lane: LaneAggregate | None,
) -> tuple[float | None, float | None, float | None, float | None, int | None, dt.datetime | None]:
    """Aggregate a comp set into (low, avg, high, fuel, mileage, as_of)."""
    avgs = [c.avg_rate_per_mile for c in comps if c.avg_rate_per_mile is not None]
    avg = _mean(avgs)

    lows = [c.low_rate_per_mile for c in comps if c.low_rate_per_mile is not None]
    highs = [c.high_rate_per_mile for c in comps if c.high_rate_per_mile is not None]
    fuels = [c.fuel_surcharge_per_mile for c in comps if c.fuel_surcharge_per_mile is not None]

    low = _mean(lows)
    high = _mean(highs)
    if low is None and avg is not None:
        low = avg * _LOW_SPREAD
    if high is None and avg is not None:
        high = avg * _HIGH_SPREAD

    fuel = _mean(fuels)
    if fuel is None:
        fuel = DEFAULT_FUEL_SURCHARGE_PER_MILE

    mileages = [c.mileage for c in comps if c.mileage is not None]
    mileage: int | None = None
    if lane is not None and lane.estimated_miles is not None:
        mileage = lane.estimated_miles
    elif mileages:
        mileage = int(round(median(mileages)))

    captured = [c.captured_at for c in comps if c.captured_at is not None]
    as_of = max(captured) if captured else None

    return low, avg, high, fuel, mileage, as_of


def estimate_rate(
    *,
    equipment_code: str,
    origin_city: str | None,
    origin_state_code: str,
    destination_city: str | None,
    destination_state_code: str,
    comparables: list[Comparable],
    lane: LaneAggregate | None = None,
    reference: dt.datetime | None = None,
    recent_window_days: int = 90,
) -> RateEstimate:
    """Derive a RateInsights-style estimate from candidate comps + a lane fallback.

    ``comparables`` may be a broad candidate set (e.g. every recent snapshot on the
    state pair + equipment); the tiering below narrows it. ``reference`` is the lookup
    instant used for the recency window — pass ``None`` to skip windowing (tests).
    """
    equip = equipment_code
    o_state = origin_state_code
    d_state = destination_state_code

    def _matches(c: Comparable, *, city: bool) -> bool:
        if c.equipment_code is not None and c.equipment_code != equip:
            return False
        if _norm(c.origin_state_code) != _norm(o_state):
            return False
        if _norm(c.destination_state_code) != _norm(d_state):
            return False
        if city:
            if _norm(c.origin_city) != _norm(origin_city):
                return False
            if _norm(c.destination_city) != _norm(destination_city):
                return False
        if not _within_window(c.captured_at, reference, recent_window_days):
            return False
        return True

    exact = [c for c in comparables if _matches(c, city=True)]
    loose = [c for c in comparables if _matches(c, city=False)]

    lane_has_rate = lane is not None and lane.avg_carrier_rate_per_mile is not None

    if exact:
        tier = "lane_snapshots"
        count = len(exact)
        low, avg, high, fuel, mileage, as_of = _band_from_comps(exact, lane)
    elif lane_has_rate:
        tier = "lane_aggregate"
        assert lane is not None
        count = lane.load_count or 0
        avg = float(lane.avg_carrier_rate_per_mile)  # type: ignore[arg-type]
        low = avg * _LOW_SPREAD
        high = avg * _HIGH_SPREAD
        fuel = DEFAULT_FUEL_SURCHARGE_PER_MILE
        mileage = lane.estimated_miles
        as_of = None
    elif loose:
        tier = "loose_snapshots"
        count = len(loose)
        low, avg, high, fuel, mileage, as_of = _band_from_comps(loose, lane)
    else:
        return RateEstimate(
            match_tier="none",
            comparable_count=0,
            confidence_score=0.0,
            confidence_level="none",
            mileage=lane.estimated_miles if lane is not None else None,
            low_rate_per_mile=None,
            avg_rate_per_mile=None,
            high_rate_per_mile=None,
            fuel_surcharge_per_mile=None,
            total_low=None,
            total_avg=None,
            total_high=None,
            as_of=None,
        )

    score, level = _confidence(tier, count)

    def _rpm(value: float | None) -> float | None:
        return round(value, 4) if value is not None else None

    def _total(rpm: float | None) -> float | None:
        if rpm is None or mileage is None or fuel is None:
            return None
        return round((rpm + fuel) * mileage, 2)

    return RateEstimate(
        match_tier=tier,
        comparable_count=count,
        confidence_score=score,
        confidence_level=level,
        mileage=mileage,
        low_rate_per_mile=_rpm(low),
        avg_rate_per_mile=_rpm(avg),
        high_rate_per_mile=_rpm(high),
        fuel_surcharge_per_mile=_rpm(fuel),
        total_low=_total(low),
        total_avg=_total(avg),
        total_high=_total(high),
        as_of=as_of,
    )
