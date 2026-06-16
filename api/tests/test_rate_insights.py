"""Offline unit tests for the pure RateInsights matching/aggregation helper.

No database — exercises ``services.rate_insights.estimate_rate`` directly. Folds into
the api/ pytest gate (feat-011/012); runnable now with ``cd api && uv run --with pytest
pytest tests/test_rate_insights.py``.
"""

from __future__ import annotations

import datetime as dt

from services.rate_insights import (
    Comparable,
    LaneAggregate,
    estimate_rate,
)

NOW = dt.datetime(2026, 6, 16, tzinfo=dt.timezone.utc)


def _comp(**kwargs) -> Comparable:
    base = dict(
        avg_rate_per_mile=2.00,
        low_rate_per_mile=1.84,
        high_rate_per_mile=2.24,
        fuel_surcharge_per_mile=0.32,
        mileage=373,
        captured_at=NOW - dt.timedelta(days=10),
        equipment_code="V",
        origin_city="Los Angeles",
        origin_state_code="CA",
        destination_city="Phoenix",
        destination_state_code="AZ",
    )
    base.update(kwargs)
    return Comparable(**base)


def _lookup(**kwargs):
    base = dict(
        equipment_code="V",
        origin_city="Los Angeles",
        origin_state_code="CA",
        destination_city="Phoenix",
        destination_state_code="AZ",
        reference=NOW,
    )
    base.update(kwargs)
    return base


# ---------------------------------------------------------------------------
# Tier 1: exact city snapshots
# ---------------------------------------------------------------------------

def test_exact_city_snapshots_average_band():
    comps = [
        _comp(avg_rate_per_mile=2.00, low_rate_per_mile=1.80, high_rate_per_mile=2.20),
        _comp(avg_rate_per_mile=2.10, low_rate_per_mile=1.90, high_rate_per_mile=2.30),
    ]
    est = estimate_rate(comparables=comps, lane=None, **_lookup())

    assert est.match_tier == "lane_snapshots"
    assert est.comparable_count == 2
    assert est.avg_rate_per_mile == 2.05
    assert est.low_rate_per_mile == 1.85
    assert est.high_rate_per_mile == 2.25
    assert est.fuel_surcharge_per_mile == 0.32
    # mileage falls back to median snapshot mileage when no lane is supplied
    assert est.mileage == 373
    # all-in total = (rpm + fuel) * miles
    assert est.total_avg == round((2.05 + 0.32) * 373, 2)


def test_deeper_comp_set_raises_confidence():
    thin = estimate_rate(comparables=[_comp()], lane=None, **_lookup())
    deep = estimate_rate(comparables=[_comp() for _ in range(7)], lane=None, **_lookup())

    assert thin.confidence_level == "medium"
    assert deep.confidence_level == "high"
    assert deep.confidence_score > thin.confidence_score
    assert deep.confidence_score <= 0.95


def test_lane_mileage_overrides_snapshot_median():
    lane = LaneAggregate(estimated_miles=400, avg_carrier_rate_per_mile=2.05, load_count=64)
    est = estimate_rate(comparables=[_comp(mileage=373)], lane=lane, **_lookup())
    assert est.mileage == 400


# ---------------------------------------------------------------------------
# Tier 2: lane aggregate fallback
# ---------------------------------------------------------------------------

def test_lane_aggregate_fallback_when_no_exact_comps():
    # A loose (state-only) comp exists, but the lane aggregate is preferred over it.
    loose = _comp(origin_city="San Diego", destination_city="Tucson")
    lane = LaneAggregate(estimated_miles=373, avg_carrier_rate_per_mile=2.05, load_count=30)

    est = estimate_rate(comparables=[loose], lane=lane, **_lookup())

    assert est.match_tier == "lane_aggregate"
    assert est.avg_rate_per_mile == 2.05
    assert est.low_rate_per_mile == round(2.05 * 0.92, 4)
    assert est.high_rate_per_mile == round(2.05 * 1.12, 4)
    assert est.comparable_count == 30
    assert est.confidence_level == "high"  # 0.45 + 0.30, capped 0.75 → high
    assert est.as_of is None


# ---------------------------------------------------------------------------
# Tier 3: loose state-pair snapshots
# ---------------------------------------------------------------------------

def test_loose_snapshots_when_no_exact_and_no_lane():
    loose = _comp(origin_city="San Diego", destination_city="Tucson")
    est = estimate_rate(comparables=[loose], lane=None, **_lookup())

    assert est.match_tier == "loose_snapshots"
    assert est.confidence_level == "low"
    assert est.comparable_count == 1


# ---------------------------------------------------------------------------
# Tier 4: nothing matches
# ---------------------------------------------------------------------------

def test_no_match_returns_zero_confidence():
    est = estimate_rate(
        comparables=[_comp(origin_state_code="TX", destination_state_code="FL")],
        lane=None,
        **_lookup(),
    )
    assert est.match_tier == "none"
    assert est.confidence_score == 0.0
    assert est.confidence_level == "none"
    assert est.avg_rate_per_mile is None
    assert est.total_avg is None


def test_equipment_mismatch_excluded():
    est = estimate_rate(comparables=[_comp(equipment_code="R")], lane=None, **_lookup())
    assert est.match_tier == "none"


# ---------------------------------------------------------------------------
# Recency window
# ---------------------------------------------------------------------------

def test_stale_snapshots_filtered_out():
    stale = _comp(captured_at=NOW - dt.timedelta(days=200))
    est = estimate_rate(
        comparables=[stale], lane=None, recent_window_days=90, **_lookup()
    )
    assert est.match_tier == "none"


def test_window_skipped_when_no_reference():
    stale = _comp(captured_at=dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc))
    lookup = _lookup()
    lookup["reference"] = None
    est = estimate_rate(comparables=[stale], lane=None, **lookup)
    assert est.match_tier == "lane_snapshots"


def test_as_of_is_most_recent_used_comp():
    recent = NOW - dt.timedelta(days=3)
    est = estimate_rate(
        comparables=[
            _comp(captured_at=NOW - dt.timedelta(days=30)),
            _comp(captured_at=recent),
        ],
        lane=None,
        **_lookup(),
    )
    assert est.as_of == recent
