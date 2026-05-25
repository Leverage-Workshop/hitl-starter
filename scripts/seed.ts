/**
 * Seed script — creates the initial `caleb` admin user idempotently.
 *
 * Prerequisites:
 *   1. DATABASE_URL set in .env (Neon connection string)
 *   2. SEED_ADMIN_PASSWORD set in .env
 *   3. Schema pushed: `npx drizzle-kit push`
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 */

import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { auth } from '../lib/auth'
import { db } from '../db'
import { user } from '../db/schema'

async function seed() {
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD is not set in .env')
  }

  const ADMIN_EMAIL = 'caleb@hitl.local'
  const ADMIN_NAME = 'Caleb'

  // Check if user already exists in the database
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL))
    .limit(1)

  if (existing.length > 0) {
    console.log(`ℹ️   Admin user already exists — skipped.`)
    return
  }

  // Sign up via Better Auth (handles password hashing, account creation, etc.)
  const result = await auth.api.signUpEmail({
    body: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password,
    },
  })

  // Promote to admin role directly in the DB — admin API methods require an
  // authenticated admin session, which can't exist during initial seeding.
  await db
    .update(user)
    .set({ role: 'admin' })
    .where(eq(user.id, result.user.id))

  console.log(`✅  Seeded admin user: ${ADMIN_EMAIL} (role: admin)`)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
