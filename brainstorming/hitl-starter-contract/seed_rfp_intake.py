"""
Seed example — the rfp-intake workflow, expressed via the contract.

Demonstrates how a real workflow plugs in: define the workflow, its item schema,
its available actions, and the items it produces. The dashboard renders all of
this without knowing anything specific about RFP intake.

Run directly to validate it parses:  python seed_rfp_intake.py
"""

from datetime import datetime, timezone

from contract import (
    Action,
    ActionIntent,
    ActionScope,
    FieldDef,
    FieldType,
    Item,
    ItemStatus,
    Note,
    Priority,
    Source,
    SourceKind,
    Stat,
    Step,
    ViewMode,
    Workflow,
    WorkflowStatus,
    bulk_actions,
    single_actions,
)

# --- actions available on rfp-intake items --------------------------------- #

APPROVE = Action(
    id="approve",
    label="Approve",
    intent=ActionIntent.PRIMARY,
    applies_to=ActionScope.BOTH,  # works in flyout and in bulk
    resulting_status=ItemStatus.APPROVED,
    handler="rfp.approve",
)

EDIT = Action(
    id="edit",
    label="Edit",
    intent=ActionIntent.NEUTRAL,
    applies_to=ActionScope.SINGLE,  # editing a draft is a single-item act
    resulting_status=ItemStatus.PENDING,  # stays pending after edit
    handler="rfp.edit",
)

REJECT = Action(
    id="reject",
    label="Reject",
    intent=ActionIntent.DESTRUCTIVE,
    applies_to=ActionScope.BOTH,
    confirm=True,
    resulting_status=ItemStatus.REJECTED,
    handler="rfp.reject",
)

# --- the workflow ----------------------------------------------------------- #

rfp_intake = Workflow(
    id="rfp-intake",
    name="rfp-intake",
    description=(
        "Reads inbound RFP emails, drafts a first response in the studio voice, "
        "attaches the right pricing sheet, and files the thread in the correct "
        "CRM pipeline. Flags anything above the confidence floor for a human "
        "decision before sending."
    ),
    status=WorkflowStatus.RUNNING,
    default_view=ViewMode.TABLE,
    confidence_floor=0.82,
    steps=[
        Step(label="read", status="done"),
        Step(label="classify", status="done"),
        Step(label="draft", status="active"),
        Step(label="file", status="pending"),
    ],
    stats=[
        Stat(label="PENDING", value=10, unit="in queue", emphasized=True),
        Stat(label="APPROVED // 7D", value=35, trend="+6 vs prior 7d"),
        Stat(label="AVG DECISION", value="1m 48s", unit="open -> decide"),
    ],
    item_schema=[
        FieldDef(key="subject", label="Subject", type=FieldType.STRING),
        FieldDef(key="from", label="From", type=FieldType.EMAIL),
        FieldDef(key="attachments", label="Attachments", type=FieldType.COUNT),
    ],
    available_actions=[APPROVE, EDIT, REJECT],
    sources=[
        Source(id="inbox", label="rfp@studio inbox", kind=SourceKind.INBOX),
        Source(id="crm", label="CRM pipeline", kind=SourceKind.CRM),
    ],
    items=[
        Item(
            id="rfp-2026-0142",
            status=ItemStatus.PENDING,
            priority=Priority.HIGH,
            created_at=datetime(2026, 5, 12, 14, 32, 8, tzinfo=timezone.utc),
            summary="Northwind Logistics — fleet telematics RFP",
            fields={
                "subject": "Northwind Logistics — fleet telematics RFP",
                "from": "procurement@northwind-logistics.com",
                "attachments": 6,
            },
            source_content="Hi, we're soliciting proposals for a fleet "
            "telematics integration...",
            proposed_output="Thanks for reaching out — happy to put together "
            "a proposal. Attaching our standard pricing sheet...",
            context=[
                Note(
                    ref="[a]",
                    label="confidence",
                    body="0.71 — below floor, flagged for review.",
                ),
            ],
        ),
        Item(
            id="rfp-2026-0140",
            status=ItemStatus.PENDING,
            priority=Priority.FLAGGED,
            created_at=datetime(2026, 5, 12, 11, 47, 2, tzinfo=timezone.utc),
            summary="Granite & Cole — scope expansion, year 2",
            fields={
                "subject": "Granite & Cole — scope expansion, year 2",
                "from": "ops@granitecole.com",
                "attachments": 3,
            },
            # this item narrows its actions: an existing client can't be "rejected"
            actions=[APPROVE, EDIT],
        ),
    ],
)


if __name__ == "__main__":
    # Round-trip validate, then exercise the helpers.
    raw = rfp_intake.model_dump()
    parsed = Workflow.model_validate(raw)
    assert parsed.id == "rfp-intake"
    assert len(parsed.items) == 2

    bulk = bulk_actions(parsed)
    assert {a.id for a in bulk} == {"approve", "reject"}, "bulk should exclude edit"

    flagged_item = parsed.items[1]  # Granite & Cole, narrowed actions
    singles = single_actions(parsed, flagged_item)
    assert {a.id for a in singles} == {"approve", "edit"}, "item narrowed to approve+edit"

    print("OK — rfp-intake seed validates and helpers resolve correctly.")
    print(f"  workflow: {parsed.name} ({parsed.status.value})")
    print(f"  items:    {len(parsed.items)}")
    print(f"  bulk actions:   {[a.id for a in bulk]}")
    print(f"  single (item 2): {[a.id for a in singles]}")
