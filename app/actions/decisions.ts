'use server'

import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { workflowItems } from '@/db/schema'
import type { ItemStatus } from '@/lib/contract'

async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

export async function recordDecision(itemId: string, status: ItemStatus): Promise<void> {
  const userId = await currentUserId()
  await db
    .update(workflowItems)
    .set({ status, decidedAt: new Date(), decidedBy: userId, updatedAt: new Date() })
    .where(eq(workflowItems.id, itemId))
  revalidatePath('/dashboard')
}

export async function recordDecisions(itemIds: string[], status: ItemStatus): Promise<void> {
  if (itemIds.length === 0) return
  const userId = await currentUserId()
  await db
    .update(workflowItems)
    .set({ status, decidedAt: new Date(), decidedBy: userId, updatedAt: new Date() })
    .where(inArray(workflowItems.id, itemIds))
  revalidatePath('/dashboard')
}
