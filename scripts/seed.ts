/**
 * Unified seed script — seeds the entire database in dependency order.
 *
 * Consolidates what used to be three separate seed steps into one command:
 *   1. Better Auth admin user          (idempotent — skipped if it exists)
 *   2. Domain tables (api/db/seed.sql)  shippers, carriers, lanes, loads,
 *      rate_snapshots — run BEFORE workflows so workflow_items can reference
 *      domain entity IDs. The .sql file remains the source of truth for the
 *      domain data; this script just executes it.
 *   3. Workflows + workflow_items       from the contract (idempotent and
 *      convergent — preserves reviewer decisions already made on items).
 *
 * Prerequisites:
 *   - DATABASE_URL set in .env (Neon connection string)
 *   - SEED_ADMIN_PASSWORD set in .env
 *   - Next.js schema pushed:        npx drizzle-kit push
 *   - FastAPI domain schema applied: (cd api && alembic upgrade head)
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 */

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { eq, notInArray } from 'drizzle-orm'
import { auth } from '../lib/auth'
import { db } from '../db'
import { user, workflowItems, workflows } from '../db/schema'
import { ALL_WORKFLOWS } from '../lib/contract/seed'

// Node 18+ exposes a global WebSocket. The domain seed is a multi-statement,
// transactional .sql file, which the Neon HTTP driver can't run — so we execute
// it over the WebSocket-based Pool instead, which speaks the full pg protocol.
neonConfig.webSocketConstructor =
  globalThis.WebSocket as unknown as typeof neonConfig.webSocketConstructor

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DOMAIN_SEED_SQL = resolve(SCRIPT_DIR, '../api/db/seed.sql')

// ---------------------------------------------------------------------------
// 1. Better Auth admin user
// ---------------------------------------------------------------------------
async function seedAdminUser(): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD is not set in .env')
  }

  const ADMIN_EMAIL = 'caleb@leverageworkshop.com'
  const ADMIN_NAME = 'Caleb'

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL))
    .limit(1)

  if (existing.length > 0) {
    console.log('ℹ️   admin user already exists — skipped.')
    return
  }

  // Sign up via Better Auth (handles password hashing, account creation, etc.)
  const result = await auth.api.signUpEmail({
    body: { name: ADMIN_NAME, email: ADMIN_EMAIL, password },
  })

  // Promote to admin directly — admin API methods require an authenticated
  // admin session, which can't exist during initial seeding.
  await db.update(user).set({ role: 'admin' }).where(eq(user.id, result.user.id))

  console.log(`✅  seeded admin user: ${ADMIN_EMAIL} (role: admin)`)
}

// ---------------------------------------------------------------------------
// 2. Domain tables (executes api/db/seed.sql)
// ---------------------------------------------------------------------------
async function seedDomainTables(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set in .env')
  }

  const sqlText = readFileSync(DOMAIN_SEED_SQL, 'utf8')
  const pool = new Pool({ connectionString: url })
  try {
    // The file is itself wrapped in BEGIN/COMMIT and is idempotent (it truncates
    // the domain tables before re-seeding). One round trip runs the whole thing.
    await pool.query(sqlText)
  } finally {
    await pool.end()
  }

  console.log('✅  domain tables seeded from api/db/seed.sql')
}

// ---------------------------------------------------------------------------
// 3. Workflows + workflow_items (converges Postgres to the contract)
// ---------------------------------------------------------------------------
async function seedWorkflows(): Promise<void> {
  const keepIds = ALL_WORKFLOWS.map((wf) => wf.id)

  // Remove workflows no longer in the contract. workflow_items has
  // onDelete: 'cascade' on workflowId, so their items go with them.
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
    // Upsert workflow config so the contract definition stays authoritative.
    // webhookSecret and createdAt are intentionally left untouched.
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

    // Insert items without clobbering existing rows (preserves decisions).
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

  console.log(`🔁  converged to ${ALL_WORKFLOWS.length} workflows.`)
}

// ---------------------------------------------------------------------------
// Orchestration — order matters: domain before workflows.
// ---------------------------------------------------------------------------
async function seed(): Promise<void> {
  await seedAdminUser()
  await seedDomainTables()
  await seedWorkflows()
  console.log('\nDone. Database fully seeded.')
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
