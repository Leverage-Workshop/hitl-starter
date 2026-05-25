import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type Schema = typeof schema

// Lazy singleton — defer connection until first use so Next.js can compile
// and pre-render pages without DATABASE_URL present at build time.
let _db: NeonHttpDatabase<Schema> | null = null

export function getDb(): NeonHttpDatabase<Schema> {
  if (_db) return _db

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  _db = drizzle(neon(url), { schema })
  return _db
}

// Convenience export for the common case where the caller is in a runtime
// context (API route, server action, seed script) and DATABASE_URL is set.
export const db: NeonHttpDatabase<Schema> = new Proxy({} as NeonHttpDatabase<Schema>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop)
  },
})
