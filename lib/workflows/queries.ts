import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { workflows, workflowItems } from '@/db/schema'
import { WorkflowSchema, type Workflow } from '@/lib/contract'

export interface NavWorkflow {
  id: string
  name: string
  status: string
  pendingCount: number
}

export async function getWorkflowList(): Promise<NavWorkflow[]> {
  const rows = await db.select().from(workflows)

  const counts = await db
    .select({
      workflowId: workflowItems.workflowId,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(workflowItems)
    .where(eq(workflowItems.status, 'pending'))
    .groupBy(workflowItems.workflowId)

  const countMap = new Map(counts.map((c) => [c.workflowId, c.count]))

  return rows.map((wf) => ({
    id: wf.id,
    name: wf.name,
    status: wf.status,
    pendingCount: countMap.get(wf.id) ?? 0,
  }))
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const [row] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1)

  if (!row) return null

  const items = await db
    .select()
    .from(workflowItems)
    .where(eq(workflowItems.workflowId, id))
    .orderBy(workflowItems.createdAt)

  return WorkflowSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    defaultView: row.defaultView,
    confidenceFloor: row.confidenceFloor ?? undefined,
    itemSchema: row.itemSchema,
    availableActions: row.availableActions,
    stats: row.stats,
    steps: row.steps,
    sources: row.sources,
    items: items.map((item) => ({
      id: item.id,
      status: item.status,
      priority: item.priority,
      createdAt: item.createdAt.toISOString(),
      summary: item.summary,
      fields: item.fields,
      sourceContent: item.sourceContent ?? undefined,
      proposedOutput: item.proposedOutput ?? undefined,
      context: item.context,
      actions: item.actions ?? undefined,
    })),
  })
}
