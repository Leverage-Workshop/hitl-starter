import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

/**
 * Catch-all route for Better Auth.
 * Smoke test: GET /api/auth/ok → { status: "ok" }
 */
export const { GET, POST } = toNextJsHandler(auth)
