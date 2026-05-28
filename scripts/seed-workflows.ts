/**
 * Seed script — loads contract workflows and items into Postgres idempotently.
 *
 * Prerequisites:
 *   1. DATABASE_URL set in .env (Neon connection string)
 *   2. Schema pushed: `npx drizzle-kit push`
 *   3. (Optional) Admin user seeded: `npx tsx scripts/seed.ts`
 *
 * Usage:
 *   npx tsx scripts/seed-workflows.ts
 */

import 'dotenv/config'
import { db } from '../db'
import { workflows, workflowItems } from '../db/schema'
import { ALL_WORKFLOWS } from '../lib/contract/seed'

async function seedWorkflows() {
  for (const wf of ALL_WORKFLOWS) {
    await db
      .insert(workflows)
      .values({
        id: wf.id,
        name: wf.name,
        description: wf.description,
        status: wf.status,
        defaultView: wf.defaultView,
        confidenceFloor: wf.confidenceFloor ?? null,
        itemSchema: wf.itemSchema,
        availableActions: wf.availableActions,
        stats: wf.stats,
        steps: wf.steps,
        sources: wf.sources,
      })
      .onConflictDoNothing()

    if (wf.items.length === 0) continue

    for (const item of wf.items) {
      await db
        .insert(workflowItems)
        .values({
          id: item.id,
          workflowId: wf.id,
          status: item.status,
          priority: item.priority,
          createdAt: new Date(item.createdAt),
          summary: item.summary,
          fields: item.fields,
          sourceContent: item.sourceContent ?? null,
          proposedOutput: item.proposedOutput ?? null,
          context: item.context,
          actions: item.actions ?? null,
        })
        .onConflictDoNothing()
    }

    console.log(`✅  ${wf.id}: ${wf.items.length} item(s)`)
  }

  console.log(`\nDone. Seeded ${ALL_WORKFLOWS.length} workflows.`)
}

seedWorkflows().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
