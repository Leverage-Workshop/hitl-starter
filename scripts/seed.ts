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
import { auth } from '../lib/auth'

async function seed() {
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD is not set in .env')
  }

  const ADMIN_EMAIL = 'caleb@hitl.local'
  const ADMIN_NAME = 'Caleb'

  // Sign up — will throw if the user already exists; catch and skip
  const result = await auth.api
    .signUpEmail({
      body: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password,
      },
    })
    .catch((e: Error) => {
      if (e.message.toLowerCase().includes('already')) {
        return null
      }
      throw e
    })

  if (result) {
    await auth.api.setRole({
      body: { userId: result.user.id, role: 'admin' },
    })
    console.log(`✅  Seeded admin user: ${ADMIN_EMAIL}`)
  } else {
    console.log(`ℹ️   Admin user already exists — skipped.`)
  }
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
