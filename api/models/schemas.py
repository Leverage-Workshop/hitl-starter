"""Pydantic request/response models for the workflow routers.

These are the API surface shapes — they do not need to be 1:1 with the ORM
models in api/db/models.py. They cover the read shapes the HITL console-facing
workflows produce and the trigger payloads the routers accept.
"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    """Base for models read directly from ORM rows."""

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Read shapes
# --------------------------------------------------------------------------- #
class ShipperOut(ORMModel):
    id: uuid.UUID
    hubspot_company_id: str | None = None
    company_name: str
    city: str | None = None
    state_code: str | None = None
    status: str
    last_load_date: dt.date | None = None
    lifetime_load_count: int | None = None


class CarrierOut(ORMModel):
    id: uuid.UUID
    dot_number: str
    mc_number: str | None = None
    company_name: str
    tier: str | None = None
    compliance_status: str | None = None
    authority_status: str | None = None
    insurance_expiry: dt.date | None = None
    on_time_rate: Decimal | None = None
    is_active: bool


class LaneOut(ORMModel):
    id: uuid.UUID
    origin_city: str
    origin_state_code: str
    destination_city: str
    destination_state_code: str
    equipment_code: str
    estimated_miles: int | None = None
    avg_carrier_rate_per_mile: Decimal | None = None
    avg_shipper_rate_per_mile: Decimal | None = None
    avg_margin_percent: Decimal | None = None


class LoadOut(ORMModel):
    id: uuid.UUID
    load_number: str | None = None
    shipper_id: uuid.UUID
    carrier_id: uuid.UUID | None = None
    lane_id: uuid.UUID | None = None
    origin_city: str
    origin_state_code: str
    destination_city: str
    destination_state_code: str
    status: str
    shipper_rate: Decimal | None = None
    carrier_rate: Decimal | None = None
    gross_margin: Decimal | None = None
    margin_percent: Decimal | None = None
    carrier_invoice_status: str | None = None
    invoice_discrepancy_amt: Decimal | None = None


# --------------------------------------------------------------------------- #
# Trigger payloads (trigger.dev -> FastAPI)
# --------------------------------------------------------------------------- #
class WorkflowRunResult(BaseModel):
    """Standard response after a workflow run kicks off / completes."""

    workflow: str
    items_created: int = 0
    detail: str | None = None


class QuoteDeskTrigger(BaseModel):
    """Kick the Quote Desk workflow for a specific pending load (RFQ)."""

    load_id: uuid.UUID


class ReactivationTrigger(BaseModel):
    """Run the Shipper Reactivation sweep. Optional dormancy threshold override."""

    dormant_days_threshold: int = Field(default=45, ge=1)


class WeeklyDigestTrigger(BaseModel):
    """Run the Weekly Margin & Ops Digest. Defaults to the trailing 7 days."""

    period_days: int = Field(default=7, ge=1)


class ReconciliationTrigger(BaseModel):
    """Run Carrier Invoice Reconciliation across loads with discrepancy invoices."""

    only_discrepancies: bool = True
