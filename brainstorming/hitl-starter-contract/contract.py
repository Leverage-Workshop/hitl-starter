"""
HITL-Starter — Workflow & Item Contract
Python + Pydantic v2

The dashboard understands only these three objects: Workflow, Item, Action.
Add a new workflow by implementing this contract — never by editing the shell.

    from contract import Workflow
    wf = Workflow.model_validate(raw)  # runtime-validated, fully typed
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Enums                                                                       #
# --------------------------------------------------------------------------- #


class WorkflowStatus(str, Enum):
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"
    IDLE = "idle"


class ItemStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"
    SKIPPED = "skipped"


class Priority(str, Enum):
    HIGH = "high"
    NORMAL = "normal"
    FLAGGED = "flagged"


class ActionIntent(str, Enum):
    """Maps to design-system button styling. The dashboard styles by intent,
    not by knowing what the action means."""

    PRIMARY = "primary"
    NEUTRAL = "neutral"
    DESTRUCTIVE = "destructive"


class ActionScope(str, Enum):
    """Where an action can be applied. Expresses 'bulk actions only in table
    mode' at the contract level."""

    SINGLE = "single"
    BULK = "bulk"
    BOTH = "both"


class FieldType(str, Enum):
    """Small, display-oriented set. Tells the UI how to render a column — not a
    business-data type system. Extend as real workflows demand."""

    STRING = "string"
    NUMBER = "number"
    DATETIME = "datetime"
    EMAIL = "email"
    BADGE = "badge"
    COUNT = "count"


class StepStatus(str, Enum):
    DONE = "done"
    ACTIVE = "active"
    PENDING = "pending"
    ERROR = "error"


class SourceKind(str, Enum):
    API = "api"
    INBOX = "inbox"
    CRM = "crm"
    DATABASE = "database"
    OTHER = "other"


class ViewMode(str, Enum):
    TABLE = "table"
    CARDS = "cards"


# --------------------------------------------------------------------------- #
# Supporting shapes                                                           #
# --------------------------------------------------------------------------- #


class Step(BaseModel):
    label: str
    status: Optional[StepStatus] = None


class Stat(BaseModel):
    label: str
    value: str | float
    unit: Optional[str] = None
    trend: Optional[str] = None  # e.g. "+6 vs prior 7d"
    emphasized: bool = False  # the accent figure; at most one per workflow


class FieldDef(BaseModel):
    """Describes one field an item carries, so the table can render a column
    and the card the right field."""

    key: str
    label: str
    type: FieldType
    show_in_table: bool = True
    show_in_card: bool = True


class Source(BaseModel):
    id: str
    label: str
    kind: SourceKind = SourceKind.OTHER


class Note(BaseModel):
    ref: Optional[str] = None  # marginalia callout key, e.g. "[a]"
    label: Optional[str] = None
    body: str


# --------------------------------------------------------------------------- #
# Object 3 — Action                                                           #
# --------------------------------------------------------------------------- #


class Action(BaseModel):
    id: str
    label: str
    intent: ActionIntent = ActionIntent.NEUTRAL
    applies_to: ActionScope = ActionScope.SINGLE
    confirm: bool = False
    # The item status this action produces. The lifecycle link — actions are
    # the only thing that change item status.
    resulting_status: ItemStatus
    # Stable handler key the app maps to a function/endpoint. Left abstract on
    # purpose; wire to backend later.
    handler: str


# --------------------------------------------------------------------------- #
# Object 2 — Workflow Item                                                    #
# --------------------------------------------------------------------------- #


class Item(BaseModel):
    id: str
    status: ItemStatus = ItemStatus.PENDING
    priority: Priority = Priority.NORMAL
    created_at: datetime
    summary: str
    # Workflow-specific data conforming to the workflow's item_schema.
    # Keyed by FieldDef.key.
    fields: dict[str, Any] = Field(default_factory=dict)

    # review payload — drives the two-pane flyout body
    source_content: Optional[str] = None
    proposed_output: Optional[str] = None
    context: list[Note] = Field(default_factory=list)

    # Actions available on this specific item. Usually inherited from the
    # workflow's available_actions, but may be narrowed per item.
    actions: Optional[list[Action]] = None


# --------------------------------------------------------------------------- #
# Object 1 — Workflow                                                         #
# --------------------------------------------------------------------------- #


class Workflow(BaseModel):
    id: str
    name: str
    description: str
    status: WorkflowStatus = WorkflowStatus.IDLE

    steps: list[Step] = Field(default_factory=list)
    stats: list[Stat] = Field(default_factory=list)
    default_view: ViewMode = ViewMode.TABLE

    items: list[Item] = Field(default_factory=list)
    item_schema: list[FieldDef] = Field(default_factory=list)
    # The configurable slot. Drives the flyout and bulk-action bars.
    available_actions: list[Action] = Field(default_factory=list)

    sources: list[Source] = Field(default_factory=list)
    # Threshold above which an item is flagged for human review.
    confidence_floor: Optional[float] = Field(default=None, ge=0.0, le=1.0)


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #


def resolve_item_actions(workflow: Workflow, item: Item) -> list[Action]:
    """Resolve the actions for an item: its own narrowed set if present,
    otherwise the workflow's available set."""
    return item.actions if item.actions is not None else workflow.available_actions


def bulk_actions(workflow: Workflow) -> list[Action]:
    """Actions valid for bulk selection (table mode only)."""
    return [
        a
        for a in workflow.available_actions
        if a.applies_to in (ActionScope.BULK, ActionScope.BOTH)
    ]


def single_actions(workflow: Workflow, item: Item) -> list[Action]:
    """Actions valid in the single-item flyout."""
    return [
        a
        for a in resolve_item_actions(workflow, item)
        if a.applies_to in (ActionScope.SINGLE, ActionScope.BOTH)
    ]
