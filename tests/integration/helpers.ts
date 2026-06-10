import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { pushSchema } from 'drizzle-kit/api'
import * as schema from '@/db/schema'
import type { Action } from '@/lib/contract'

export type TestDb = PgliteDatabase<typeof schema>

/**
 * In-memory Postgres with the full app schema applied. The whole schema
 * module is pushed (not just the tables under test) because workflow_items
 * carries FKs to both workflows and user.
 */
export async function createTestDb(): Promise<{ client: PGlite; db: TestDb }> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  const { apply } = await pushSchema(
    schema,
    db as unknown as Parameters<typeof pushSchema>[1],
  )
  await apply()
  return { client, db }
}

type WorkflowRow = typeof schema.workflows.$inferInsert
type ItemRow = typeof schema.workflowItems.$inferInsert

export function makeWorkflow(overrides: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    description: 'Workflow fixture for integration tests',
    itemSchema: [],
    availableActions: [],
    stats: [],
    steps: [],
    sources: [],
    webhookSecret: 's3cret',
    ...overrides,
  }
}

export function makeItem(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: 'item-1',
    workflowId: 'wf-1',
    summary: 'Item fixture',
    fields: {},
    context: [],
    createdAt: new Date(),
    ...overrides,
  }
}

/** Action fixture — intent/appliesTo/confirm are required on the zod output type. */
export function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'approve',
    label: 'Approve',
    intent: 'primary',
    appliesTo: 'both',
    confirm: false,
    handler: 'approve',
    ...overrides,
  }
}

export async function seedUser(db: TestDb, id = 'user-1'): Promise<string> {
  const now = new Date()
  await db.insert(schema.user).values({
    id,
    name: 'Test User',
    email: `${id}@example.com`,
    createdAt: now,
    updatedAt: now,
  })
  return id
}
