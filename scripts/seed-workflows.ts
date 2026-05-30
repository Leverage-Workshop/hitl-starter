/**
 * Seed script — converges Postgres to exactly the contract workflows.
 *
 * Idempotent and convergent:
 *   - Workflows absent from ALL_WORKFLOWS are deleted (their items cascade).
 *   - Workflows in ALL_WORKFLOWS are upserted, so edits to the contract
 *     (description, stats, actions, …) propagate on re-seed.
 *   - Items are inserted but never overwritten — re-seeding preserves any
 *     reviewer decisions already made on an item.
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
import { notInArray } from 'drizzle-orm'
import { db } from '../db'
import { workflows, workflowItems } from '../db/schema'
import { ALL_WORKFLOWS } from '../lib/contract/seed'

async function seedWorkflows() {
  const keepIds = ALL_WORKFLOWS.map((wf) => wf.id)

  // 1. Cleanup — remove workflows no longer in the contract. workflow_items
  //    has onDelete: 'cascade' on workflowId, so their items go with them.
  const removed = await db
    .delete(workflows)
    .where(notInArray(workflows.id, keepIds))
    .returning({ id: workflows.id })

  if (removed.length > 0) {
    console.log(
      `🧹  removed ${removed.length} stale workflow(s): ${removed
        .map((r) => r.id)
        .join(', ')}`,
    )
  }

  for (const wf of ALL_WORKFLOWS) {
    // 2. Upsert workflow config so the contract definition is authoritative.
    //    webhookSecret and createdAt are intentionally left untouched.
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
      .onConflictDoUpdate({
        target: workflows.id,
        set: {
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
          updatedAt: new Date(),
        },
      })

    if (wf.items.length === 0) {
      console.log(`✅  ${wf.id}: config (no seed items)`)
      continue
    }

    // 3. Insert items without clobbering existing rows (preserves decisions).
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

    console.log(`✅  ${wf.id}: config + ${wf.items.length} item(s)`)
  }

  console.log(`\nDone. Converged to ${ALL_WORKFLOWS.length} workflows.`)
}

seedWorkflows().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
