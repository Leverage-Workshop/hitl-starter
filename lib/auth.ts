import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { db } from '@/db'
import * as schema from '@/db/schema'

/**
 * Better Auth server instance.
 *
 * BETTER_AUTH_SECRET and BETTER_AUTH_URL are read automatically from env —
 * do not hard-code them here.
 *
 * Admin plugin adds role-based authorization (admin / user roles) and
 * impersonation support via the `session.impersonatedBy` field.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: { enabled: true },
  plugins: [admin()],
})
