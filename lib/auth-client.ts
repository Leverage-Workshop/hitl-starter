'use client'

import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

/**
 * Better Auth React client.
 * Import this in any Client Component that needs sign-in, sign-out,
 * or useSession().
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
})
