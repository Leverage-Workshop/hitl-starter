"""HITL console router — read/write access to workflows and workflow_items.

trigger.dev tasks call these endpoints to enqueue drafts for human review and
to update item state after a decision is actioned.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Workflow, WorkflowItem
from api.db.session import get_session
from api.models.schemas import WorkflowItemCreate, WorkflowItemOut, WorkflowItemUpdate

router = APIRouter(tags=["hitl"])


# ---------------------------------------------------------------------------
# Workflows (read-only — managed by the Next.js seed script)
# ---------------------------------------------------------------------------

@router.get("/workflows", response_model=list[dict])
async def list_workflows(session: AsyncSession = Depends(get_session)) -> list[dict]:
    """All registered workflows."""
    result = await session.execute(
        select(Workflow.id, Workflow.name, Workflow.status).order_by(Workflow.name)
    )
    return [{"id": row.id, "name": row.name, "status": row.status} for row in result]


@router.get("/workflows/{workflow_id}", response_model=dict)
async def get_workflow(
    workflow_id: str, session: AsyncSession = Depends(get_session)
) -> dict:
    """Single workflow by ID."""
    wf = await session.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="workflow not found")
    return {
        "id": wf.id,
        "name": wf.name,
        "description": wf.description,
        "status": wf.status,
        "item_schema": wf.item_schema,
        "available_actions": wf.available_actions,
    }


# ---------------------------------------------------------------------------
# Workflow items (read + write — trigger.dev is the primary writer)
# ---------------------------------------------------------------------------

@router.get("/workflows/{workflow_id}/items", response_model=list[WorkflowItemOut])
async def list_items(
    workflow_id: str,
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[WorkflowItem]:
    """Items for a workflow, optionally filtered by status."""
    query = (
        select(WorkflowItem)
        .where(WorkflowItem.workflow_id == workflow_id)
        .order_by(WorkflowItem.created_at.desc())
    )
    if status:
        query = query.where(WorkflowItem.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/workflow-items/{item_id}", response_model=WorkflowItemOut)
async def get_item(
    item_id: str, session: AsyncSession = Depends(get_session)
) -> WorkflowItem:
    """Single workflow item by ID."""
    item = await session.get(WorkflowItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="item not found")
    return item


@router.post("/workflow-items", response_model=WorkflowItemOut, status_code=201)
async def create_item(
    body: WorkflowItemCreate, session: AsyncSession = Depends(get_session)
) -> WorkflowItem:
    """Enqueue a new draft item for HITL review.

    Idempotent on ``id`` — if the item already exists the existing row is
    returned unchanged (trigger.dev at-least-once delivery).
    """
    existing = await session.get(WorkflowItem, body.id)
    if existing is not None:
        return existing

    wf = await session.get(Workflow, body.workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="workflow not found")

    item = WorkflowItem(
        id=body.id,
        workflow_id=body.workflow_id,
        summary=body.summary,
        fields=body.fields,
        source_content=body.source_content,
        proposed_output=body.proposed_output,
        context=body.context,
        actions=body.actions,
        priority=body.priority,
        status=body.status,
        created_at=body.created_at or dt.datetime.now(dt.timezone.utc),
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.patch("/workflow-items/{item_id}", response_model=WorkflowItemOut)
async def update_item(
    item_id: str,
    body: WorkflowItemUpdate,
    session: AsyncSession = Depends(get_session),
) -> WorkflowItem:
    """Partial update — settle status, revise proposed output, append context, etc."""
    item = await session.get(WorkflowItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="item not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    item.updated_at = dt.datetime.now(dt.timezone.utc)
    await session.commit()
    await session.refresh(item)
    return item
