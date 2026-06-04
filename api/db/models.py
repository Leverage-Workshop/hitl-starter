"""SQLAlchemy 2.x ORM models for the Halberd & Co domain tables.

These mirror api/db/migrations/001_initial_schema.sql exactly — same snake_case
column names, same constraints. The schema is owned by the raw SQL migration;
these models are the read/write surface for the FastAPI workflow routers. They
deliberately do NOT model the HITL console's own tables (``workflows`` /
``workflow_items``) — those belong to the Next.js/Drizzle side, and FastAPI only
writes to ``workflow_items`` via raw statements when handing off to HITL review.
"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )


class Shipper(Base):
    __tablename__ = "shippers"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'inactive', 'prospect')",
            name="shippers_status_check",
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()

    hubspot_company_id: Mapped[str | None] = mapped_column(Text, unique=True)

    company_name: Mapped[str] = mapped_column(Text, nullable=False)
    doing_business_as: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    state_code: Mapped[str | None] = mapped_column(Text)
    zip_code: Mapped[str | None] = mapped_column(Text)

    credit_terms_days: Mapped[int | None] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    last_load_date: Mapped[dt.date | None] = mapped_column(Date)
    lifetime_load_count: Mapped[int | None] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    loads: Mapped[list["Load"]] = relationship(back_populates="shipper")


class Carrier(Base):
    __tablename__ = "carriers"
    __table_args__ = (
        CheckConstraint(
            "carrier_operation IN ('Interstate', 'IntrastateHmz', 'IntrastateNonHmz')",
            name="carriers_carrier_operation_check",
        ),
        CheckConstraint(
            "authority_status IN ('active', 'inactive', 'revoked')",
            name="carriers_authority_status_check",
        ),
        CheckConstraint(
            "safety_rating IN ('Satisfactory', 'Conditional', 'Unsatisfactory', 'None')",
            name="carriers_safety_rating_check",
        ),
        CheckConstraint(
            "compliance_status IN ('Pass', 'Fail', 'Error', 'Warning', 'Pending')",
            name="carriers_compliance_status_check",
        ),
        CheckConstraint(
            "relationship_type IN ('Favorite', 'Blocked', 'Watched')",
            name="carriers_relationship_type_check",
        ),
        CheckConstraint(
            "tier IN ('preferred', 'backup', 'spot')",
            name="carriers_tier_check",
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()

    dot_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    mc_number: Mapped[str | None] = mapped_column(Text)
    company_name: Mapped[str] = mapped_column(Text, nullable=False)
    doing_business_as: Mapped[str | None] = mapped_column(Text)
    carrier_operation: Mapped[str | None] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(Text, default="Carrier")

    city: Mapped[str | None] = mapped_column(Text)
    state_code: Mapped[str | None] = mapped_column(Text)
    postal_code: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(Text, default="US")

    authority_status: Mapped[str | None] = mapped_column(Text)
    safety_rating: Mapped[str | None] = mapped_column(Text)
    insurance_expiry: Mapped[dt.date | None] = mapped_column(Date)
    compliance_status: Mapped[str | None] = mapped_column(Text)
    last_fmcsa_check_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    relationship_type: Mapped[str | None] = mapped_column(Text, default="Watched")
    tier: Mapped[str | None] = mapped_column(Text)
    tender_enabled: Mapped[bool | None] = mapped_column(Boolean, default=False)

    loads_completed: Mapped[int | None] = mapped_column(Integer, default=0)
    on_time_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    claim_count: Mapped[int | None] = mapped_column(Integer, default=0)
    invoice_accuracy_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    last_load_date: Mapped[dt.date | None] = mapped_column(Date)

    payment_terms_days: Mapped[int | None] = mapped_column(Integer, default=30)
    quick_pay_enrolled: Mapped[bool | None] = mapped_column(Boolean, default=False)
    factoring_company: Mapped[str | None] = mapped_column(Text)

    preferred_lane_notes: Mapped[str | None] = mapped_column(Text)

    risk_summary: Mapped[str | None] = mapped_column(Text)
    risk_updated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    notes: Mapped[str | None] = mapped_column(Text)
    added_date: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    loads: Mapped[list["Load"]] = relationship(back_populates="carrier")


class Lane(Base):
    __tablename__ = "lanes"
    __table_args__ = (
        CheckConstraint(
            "equipment_code IN ('V', 'R', 'F', 'SD', 'DD')",
            name="lanes_equipment_code_check",
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()

    origin_city: Mapped[str] = mapped_column(Text, nullable=False)
    origin_state_code: Mapped[str] = mapped_column(Text, nullable=False)
    origin_zip_code: Mapped[str | None] = mapped_column(Text)
    origin_latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    origin_longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    destination_city: Mapped[str] = mapped_column(Text, nullable=False)
    destination_state_code: Mapped[str] = mapped_column(Text, nullable=False)
    destination_zip_code: Mapped[str | None] = mapped_column(Text)
    destination_latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    destination_longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    equipment_code: Mapped[str] = mapped_column(Text, nullable=False, default="V")
    transportation_mode: Mapped[str] = mapped_column(Text, nullable=False, default="TL")

    estimated_miles: Mapped[int | None] = mapped_column(Integer)

    avg_carrier_rate_per_mile: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    avg_shipper_rate_per_mile: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    avg_margin_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    load_count: Mapped[int | None] = mapped_column(Integer, default=0)
    last_load_date: Mapped[dt.date | None] = mapped_column(Date)

    has_backhaul_pair: Mapped[bool | None] = mapped_column(Boolean, default=False)
    paired_lane_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lanes.id")
    )

    is_active: Mapped[bool | None] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    loads: Mapped[list["Load"]] = relationship(back_populates="lane")


class Load(Base):
    __tablename__ = "loads"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'quoted', 'won', 'covered', 'in_transit', "
            "'delivered', 'completed', 'invoiced', 'paid', 'cancelled', 'lost')",
            name="loads_status_check",
        ),
        CheckConstraint(
            "carrier_invoice_status IN ('pending', 'matched', 'discrepancy', 'approved', 'paid')",
            name="loads_carrier_invoice_status_check",
        ),
        CheckConstraint(
            "rfq_source IN ('email', 'form', 'phone', 'api')",
            name="loads_rfq_source_check",
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()

    shipper_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shippers.id"), nullable=False
    )
    carrier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carriers.id")
    )
    lane_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lanes.id")
    )

    load_number: Mapped[str | None] = mapped_column(Text, unique=True)

    origin_address: Mapped[str | None] = mapped_column(Text)
    origin_city: Mapped[str] = mapped_column(Text, nullable=False)
    origin_state_code: Mapped[str] = mapped_column(Text, nullable=False)
    origin_zip_code: Mapped[str | None] = mapped_column(Text)
    origin_latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    origin_longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    destination_address: Mapped[str | None] = mapped_column(Text)
    destination_city: Mapped[str] = mapped_column(Text, nullable=False)
    destination_state_code: Mapped[str] = mapped_column(Text, nullable=False)
    destination_zip_code: Mapped[str | None] = mapped_column(Text)
    destination_latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    destination_longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    equipment_code: Mapped[str] = mapped_column(Text, nullable=False, default="V")
    equipment_options: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    transportation_mode: Mapped[str] = mapped_column(Text, nullable=False, default="TL")

    commodity_id: Mapped[int | None] = mapped_column(Integer)
    commodity_description: Mapped[str | None] = mapped_column(Text)
    weight_lbs: Mapped[int | None] = mapped_column(Integer)
    pallet_count: Mapped[int | None] = mapped_column(Integer)
    mileage: Mapped[int | None] = mapped_column(Integer)
    multi_pick_drop: Mapped[bool | None] = mapped_column(Boolean, default=False)

    pickup_date: Mapped[dt.date | None] = mapped_column(Date)
    pickup_datetime: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    delivery_date: Mapped[dt.date | None] = mapped_column(Date)
    delivery_datetime: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    actual_pickup_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    actual_delivery_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    shipper_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    carrier_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    fuel_surcharge: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    fuel_included: Mapped[bool | None] = mapped_column(Boolean, default=False)
    # Generated column — computed by Postgres, never written by the ORM.
    gross_margin: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        Computed("shipper_rate - carrier_rate", persisted=True),
    )
    margin_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")

    rate_con_sent_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    bol_number: Mapped[str | None] = mapped_column(Text)
    pod_received_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    carrier_invoice_number: Mapped[str | None] = mapped_column(Text)
    carrier_invoice_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    carrier_invoice_status: Mapped[str | None] = mapped_column(Text)
    invoice_discrepancy_amt: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    invoice_discrepancy_notes: Mapped[str | None] = mapped_column(Text)

    on_time_pickup: Mapped[bool | None] = mapped_column(Boolean)
    on_time_delivery: Mapped[bool | None] = mapped_column(Boolean)
    had_claim: Mapped[bool | None] = mapped_column(Boolean, default=False)
    claim_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    rfq_source: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    shipper: Mapped["Shipper"] = relationship(back_populates="loads")
    carrier: Mapped["Carrier | None"] = relationship(back_populates="loads")
    lane: Mapped["Lane | None"] = relationship(back_populates="loads")
    rate_snapshots: Mapped[list["RateSnapshot"]] = relationship(back_populates="load")


class RateSnapshot(Base):
    __tablename__ = "rate_snapshots"
    __table_args__ = (
        CheckConstraint(
            "rate_source IN ('internal', 'truckstop', 'manual')",
            name="rate_snapshots_rate_source_check",
        ),
        CheckConstraint(
            "rate_type IN ('booked', 'posted')",
            name="rate_snapshots_rate_type_check",
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    load_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loads.id")
    )
    lane_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lanes.id")
    )

    rate_source: Mapped[str] = mapped_column(Text, nullable=False)
    captured_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    rate_type: Mapped[str | None] = mapped_column(Text)
    low_rate_per_mile: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    avg_rate_per_mile: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    high_rate_per_mile: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    fuel_surcharge_per_mile: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))

    equipment_code: Mapped[str | None] = mapped_column(Text)
    origin_city: Mapped[str | None] = mapped_column(Text)
    origin_state_code: Mapped[str | None] = mapped_column(Text)
    destination_city: Mapped[str | None] = mapped_column(Text)
    destination_state_code: Mapped[str | None] = mapped_column(Text)
    mileage: Mapped[int | None] = mapped_column(Integer)

    raw_response: Mapped[dict | None] = mapped_column(JSONB)

    load: Mapped["Load | None"] = relationship(back_populates="rate_snapshots")
