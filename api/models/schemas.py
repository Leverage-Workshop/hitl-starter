"""Pydantic request/response models for the FastAPI data API."""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Shipper
# ---------------------------------------------------------------------------

class ShipperOut(ORMModel):
    id: uuid.UUID
    hubspot_company_id: str | None = None
    company_name: str
    doing_business_as: str | None = None
    city: str | None = None
    state_code: str | None = None
    zip_code: str | None = None
    credit_terms_days: int | None = None
    status: str
    last_load_date: dt.date | None = None
    lifetime_load_count: int | None = None
    notes: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime


class ShipperCreate(BaseModel):
    company_name: str
    status: str = "active"
    hubspot_company_id: str | None = None
    doing_business_as: str | None = None
    city: str | None = None
    state_code: str | None = None
    zip_code: str | None = None
    credit_terms_days: int | None = 30
    last_load_date: dt.date | None = None
    lifetime_load_count: int | None = 0
    notes: str | None = None


class ShipperUpdate(BaseModel):
    company_name: str | None = None
    status: str | None = None
    hubspot_company_id: str | None = None
    doing_business_as: str | None = None
    city: str | None = None
    state_code: str | None = None
    zip_code: str | None = None
    credit_terms_days: int | None = None
    last_load_date: dt.date | None = None
    lifetime_load_count: int | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Carrier
# ---------------------------------------------------------------------------

class CarrierOut(ORMModel):
    id: uuid.UUID
    dot_number: str
    mc_number: str | None = None
    company_name: str
    doing_business_as: str | None = None
    carrier_operation: str | None = None
    entity_type: str | None = None
    city: str | None = None
    state_code: str | None = None
    postal_code: str | None = None
    country: str | None = None
    authority_status: str | None = None
    safety_rating: str | None = None
    insurance_expiry: dt.date | None = None
    compliance_status: str | None = None
    last_fmcsa_check_at: dt.datetime | None = None
    is_active: bool
    relationship_type: str | None = None
    tier: str | None = None
    tender_enabled: bool | None = None
    loads_completed: int | None = None
    on_time_rate: Decimal | None = None
    claim_count: int | None = None
    invoice_accuracy_rate: Decimal | None = None
    last_load_date: dt.date | None = None
    payment_terms_days: int | None = None
    quick_pay_enrolled: bool | None = None
    factoring_company: str | None = None
    preferred_lane_notes: str | None = None
    risk_summary: str | None = None
    risk_updated_at: dt.datetime | None = None
    notes: str | None = None
    added_date: dt.datetime
    updated_at: dt.datetime


class CarrierCreate(BaseModel):
    dot_number: str
    company_name: str
    mc_number: str | None = None
    doing_business_as: str | None = None
    carrier_operation: str | None = None
    entity_type: str = "Carrier"
    city: str | None = None
    state_code: str | None = None
    postal_code: str | None = None
    country: str = "US"
    authority_status: str | None = None
    safety_rating: str | None = None
    insurance_expiry: dt.date | None = None
    compliance_status: str | None = None
    is_active: bool = True
    relationship_type: str = "Watched"
    tier: str | None = None
    tender_enabled: bool = False
    payment_terms_days: int = 30
    quick_pay_enrolled: bool = False
    factoring_company: str | None = None
    preferred_lane_notes: str | None = None
    notes: str | None = None


class CarrierUpdate(BaseModel):
    dot_number: str | None = None
    mc_number: str | None = None
    company_name: str | None = None
    doing_business_as: str | None = None
    carrier_operation: str | None = None
    entity_type: str | None = None
    city: str | None = None
    state_code: str | None = None
    postal_code: str | None = None
    country: str | None = None
    authority_status: str | None = None
    safety_rating: str | None = None
    insurance_expiry: dt.date | None = None
    compliance_status: str | None = None
    last_fmcsa_check_at: dt.datetime | None = None
    is_active: bool | None = None
    relationship_type: str | None = None
    tier: str | None = None
    tender_enabled: bool | None = None
    loads_completed: int | None = None
    on_time_rate: Decimal | None = None
    claim_count: int | None = None
    invoice_accuracy_rate: Decimal | None = None
    last_load_date: dt.date | None = None
    payment_terms_days: int | None = None
    quick_pay_enrolled: bool | None = None
    factoring_company: str | None = None
    preferred_lane_notes: str | None = None
    risk_summary: str | None = None
    risk_updated_at: dt.datetime | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Lane
# ---------------------------------------------------------------------------

class LaneOut(ORMModel):
    id: uuid.UUID
    origin_city: str
    origin_state_code: str
    origin_zip_code: str | None = None
    origin_latitude: Decimal | None = None
    origin_longitude: Decimal | None = None
    destination_city: str
    destination_state_code: str
    destination_zip_code: str | None = None
    destination_latitude: Decimal | None = None
    destination_longitude: Decimal | None = None
    equipment_code: str
    transportation_mode: str
    estimated_miles: int | None = None
    avg_carrier_rate_per_mile: Decimal | None = None
    avg_shipper_rate_per_mile: Decimal | None = None
    avg_margin_percent: Decimal | None = None
    load_count: int | None = None
    last_load_date: dt.date | None = None
    has_backhaul_pair: bool | None = None
    paired_lane_id: uuid.UUID | None = None
    is_active: bool | None = None
    notes: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime


class LaneCreate(BaseModel):
    origin_city: str
    origin_state_code: str
    destination_city: str
    destination_state_code: str
    equipment_code: str = "V"
    transportation_mode: str = "TL"
    origin_zip_code: str | None = None
    origin_latitude: Decimal | None = None
    origin_longitude: Decimal | None = None
    destination_zip_code: str | None = None
    destination_latitude: Decimal | None = None
    destination_longitude: Decimal | None = None
    estimated_miles: int | None = None
    has_backhaul_pair: bool = False
    paired_lane_id: uuid.UUID | None = None
    is_active: bool = True
    notes: str | None = None


class LaneUpdate(BaseModel):
    origin_city: str | None = None
    origin_state_code: str | None = None
    origin_zip_code: str | None = None
    origin_latitude: Decimal | None = None
    origin_longitude: Decimal | None = None
    destination_city: str | None = None
    destination_state_code: str | None = None
    destination_zip_code: str | None = None
    destination_latitude: Decimal | None = None
    destination_longitude: Decimal | None = None
    equipment_code: str | None = None
    transportation_mode: str | None = None
    estimated_miles: int | None = None
    avg_carrier_rate_per_mile: Decimal | None = None
    avg_shipper_rate_per_mile: Decimal | None = None
    avg_margin_percent: Decimal | None = None
    load_count: int | None = None
    last_load_date: dt.date | None = None
    has_backhaul_pair: bool | None = None
    paired_lane_id: uuid.UUID | None = None
    is_active: bool | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------

class LoadOut(ORMModel):
    id: uuid.UUID
    load_number: str | None = None
    shipper_id: uuid.UUID
    carrier_id: uuid.UUID | None = None
    lane_id: uuid.UUID | None = None
    origin_city: str
    origin_state_code: str
    origin_address: str | None = None
    origin_zip_code: str | None = None
    destination_city: str
    destination_state_code: str
    destination_address: str | None = None
    destination_zip_code: str | None = None
    equipment_code: str
    transportation_mode: str
    commodity_description: str | None = None
    weight_lbs: int | None = None
    pallet_count: int | None = None
    mileage: int | None = None
    pickup_date: dt.date | None = None
    delivery_date: dt.date | None = None
    shipper_rate: Decimal | None = None
    carrier_rate: Decimal | None = None
    fuel_surcharge: Decimal | None = None
    gross_margin: Decimal | None = None
    margin_percent: Decimal | None = None
    status: str
    carrier_invoice_status: str | None = None
    invoice_discrepancy_amt: Decimal | None = None
    invoice_discrepancy_notes: str | None = None
    on_time_pickup: bool | None = None
    on_time_delivery: bool | None = None
    had_claim: bool | None = None
    claim_amount: Decimal | None = None
    rfq_source: str | None = None
    internal_notes: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime


class LoadCreate(BaseModel):
    shipper_id: uuid.UUID
    origin_city: str
    origin_state_code: str
    destination_city: str
    destination_state_code: str
    status: str = "pending"
    equipment_code: str = "V"
    transportation_mode: str = "TL"
    carrier_id: uuid.UUID | None = None
    lane_id: uuid.UUID | None = None
    load_number: str | None = None
    origin_address: str | None = None
    origin_zip_code: str | None = None
    destination_address: str | None = None
    destination_zip_code: str | None = None
    commodity_description: str | None = None
    weight_lbs: int | None = None
    pallet_count: int | None = None
    mileage: int | None = None
    pickup_date: dt.date | None = None
    delivery_date: dt.date | None = None
    shipper_rate: Decimal | None = None
    carrier_rate: Decimal | None = None
    fuel_surcharge: Decimal | None = None
    fuel_included: bool = False
    margin_percent: Decimal | None = None
    rfq_source: str | None = None
    internal_notes: str | None = None


class LoadUpdate(BaseModel):
    status: str | None = None
    carrier_id: uuid.UUID | None = None
    lane_id: uuid.UUID | None = None
    load_number: str | None = None
    shipper_rate: Decimal | None = None
    carrier_rate: Decimal | None = None
    fuel_surcharge: Decimal | None = None
    fuel_included: bool | None = None
    margin_percent: Decimal | None = None
    pickup_date: dt.date | None = None
    delivery_date: dt.date | None = None
    actual_pickup_at: dt.datetime | None = None
    actual_delivery_at: dt.datetime | None = None
    bol_number: str | None = None
    pod_received_at: dt.datetime | None = None
    carrier_invoice_number: str | None = None
    carrier_invoice_amount: Decimal | None = None
    carrier_invoice_status: str | None = None
    invoice_discrepancy_amt: Decimal | None = None
    invoice_discrepancy_notes: str | None = None
    on_time_pickup: bool | None = None
    on_time_delivery: bool | None = None
    had_claim: bool | None = None
    claim_amount: Decimal | None = None
    internal_notes: str | None = None


# ---------------------------------------------------------------------------
# RateSnapshot (append-only — no update)
# ---------------------------------------------------------------------------

class RateSnapshotOut(ORMModel):
    id: uuid.UUID
    load_id: uuid.UUID | None = None
    lane_id: uuid.UUID | None = None
    rate_source: str
    captured_at: dt.datetime
    rate_type: str | None = None
    low_rate_per_mile: Decimal | None = None
    avg_rate_per_mile: Decimal | None = None
    high_rate_per_mile: Decimal | None = None
    fuel_surcharge_per_mile: Decimal | None = None
    equipment_code: str | None = None
    origin_city: str | None = None
    origin_state_code: str | None = None
    destination_city: str | None = None
    destination_state_code: str | None = None
    mileage: int | None = None


class RateSnapshotCreate(BaseModel):
    rate_source: str
    load_id: uuid.UUID | None = None
    lane_id: uuid.UUID | None = None
    rate_type: str | None = None
    low_rate_per_mile: Decimal | None = None
    avg_rate_per_mile: Decimal | None = None
    high_rate_per_mile: Decimal | None = None
    fuel_surcharge_per_mile: Decimal | None = None
    equipment_code: str | None = None
    origin_city: str | None = None
    origin_state_code: str | None = None
    destination_city: str | None = None
    destination_state_code: str | None = None
    mileage: int | None = None
    raw_response: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# HITL write shapes (workflow_items table)
# ---------------------------------------------------------------------------

class WorkflowItemCreate(BaseModel):
    """Payload trigger.dev sends to enqueue a draft for HITL review."""

    id: str
    workflow_id: str
    summary: str
    fields: dict[str, Any] = Field(default_factory=dict)
    source_content: str | None = None
    proposed_output: str | None = None
    context: list[dict[str, Any]] = Field(default_factory=list)
    actions: list[dict[str, Any]] | None = None
    priority: str = "normal"
    status: str = "pending"
    created_at: dt.datetime | None = None


class WorkflowItemUpdate(BaseModel):
    """Partial update — trigger.dev settles or revises an item."""

    status: str | None = None
    proposed_output: str | None = None
    fields: dict[str, Any] | None = None
    context: list[dict[str, Any]] | None = None
    priority: str | None = None


class WorkflowItemOut(ORMModel):
    id: str
    workflow_id: str
    status: str
    priority: str
    summary: str
    fields: dict[str, Any]
    source_content: str | None = None
    proposed_output: str | None = None
    context: list[dict[str, Any]]
    actions: list[dict[str, Any]] | None = None
    decided_at: dt.datetime | None = None
    decided_by: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime


# ---------------------------------------------------------------------------
# RateInsights — mock Truckstop.com rate-estimate endpoint
# ---------------------------------------------------------------------------

class RateInsightsRequest(BaseModel):
    """Lookup parameters mirroring Truckstop RateInsights' query shape."""

    origin_city: str
    origin_state_code: str
    destination_city: str
    destination_state_code: str
    equipment_code: str = "V"
    origin_zip_code: str | None = None
    destination_zip_code: str | None = None
    pickup_date: dt.date | None = None


class RateInsightsEstimateOut(BaseModel):
    """Rate estimate approximating the Truckstop RateInsights response."""

    # Echoed lookup
    origin_city: str
    origin_state_code: str
    destination_city: str
    destination_state_code: str
    equipment_code: str
    pickup_date: dt.date | None = None

    # Estimate
    mileage: int | None = None
    low_rate_per_mile: Decimal | None = None
    avg_rate_per_mile: Decimal | None = None
    high_rate_per_mile: Decimal | None = None
    fuel_surcharge_per_mile: Decimal | None = None
    total_low: Decimal | None = None
    total_avg: Decimal | None = None
    total_high: Decimal | None = None

    # Provenance + scoring
    rate_source: str = "truckstop"
    match_tier: str
    comparable_count: int
    confidence_score: float
    confidence_level: str
    as_of: dt.datetime | None = None
