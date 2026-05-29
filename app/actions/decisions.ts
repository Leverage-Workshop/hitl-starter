'use server'

import { createHmac } from 'crypto'
import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { workflows, workflowItems } from '@/db/schema'
import type { Action, ItemStatus } from '@/lib/contract'

async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

/** Returns true only if the URL's hostname matches ALLOWED_WEBHOOK_DOMAINS. */
function isAllowedUrl(url: string): boolean {
  const allowed = process.env.ALLOWED_WEBHOOK_DOMAINS
  if (!allowed) return false
  const allowlist = allowed
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  try {
    const { hostname } = new URL(url)
    return allowlist.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain),
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Outbound dispatch
// ---------------------------------------------------------------------------

async function dispatchDecision(opts: {
  itemId: string
  decisionId: string
  workflowId: string
  action: Action
  secret: string | null
}): Promise<ItemStatus | null> {
  const { itemId, decisionId, workflowId, action, secret } = opts
  const handler = action.handler

  // String handlers are no-op keys — no outbound dispatch.
  if (typeof handler === 'string' || !('url' in handler)) return null

  const { url, method = 'POST' } = handler

  if (!isAllowedUrl(url)) {
    // Log without echoing the URL so it doesn't appear in response payloads.
    console.error('[dispatch] SSRF guard blocked outbound request')
    return null
  }

  const payload = JSON.stringify({ itemId, decisionId, workflowId, actionId: action.id })
  const requestHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'x-idempotency-key': `${itemId}-${decisionId}`,
  }

  if (secret) {
    const sig = createHmac('sha256', secret).update(payload).digest('hex')
    requestHeaders['x-signature-sha256'] = sig
  }

  try {
    const res = await fetch(url, { method, headers: requestHeaders, body: payload })
    if (res.ok) return action.resultingStatus ?? null
    console.error(`[dispatch] outbound failed: ${res.status}`)
    return null
  } catch {
    console.error('[dispatch] outbound network error')
    return null
  }
}

// ---------------------------------------------------------------------------
// Public server actions
// ---------------------------------------------------------------------------

export async function recordDecision(
  itemId: string,
  actionId: string,
  workflowId: string,
): Promise<void> {
  const userId = await currentUserId()
  const now = new Date()

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)

  const action = (workflow?.availableActions as Action[] | undefined)?.find(
    (a) => a.id === actionId,
  )
  if (!action?.resultingStatus) return

  const hasWebhook =
    action.handler !== null &&
    typeof action.handler === 'object' &&
    'url' in action.handler

  if (hasWebhook) {
    // Optimistic update: set dispatching so UI responds immediately.
    await db
      .update(workflowItems)
      .set({
        status: 'dispatching',
        decidedAt: now,
        decidedBy: userId,
        dispatchedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowItems.id, itemId))
    revalidatePath('/dashboard')

    const decisionId = `${itemId}-${Date.now()}`
    const finalStatus = await dispatchDecision({
      itemId,
      decisionId,
      workflowId,
      action,
      secret: workflow.webhookSecret ?? null,
    })

    if (finalStatus) {
      await db
        .update(workflowItems)
        .set({ status: finalStatus, updatedAt: new Date() })
        .where(eq(workflowItems.id, itemId))
      revalidatePath('/dashboard')
    }
    // On dispatch failure leave as `dispatching` — engine retries via inbound endpoint.
  } else {
    await db
      .update(workflowItems)
      .set({
        status: action.resultingStatus,
        decidedAt: now,
        decidedBy: userId,
        updatedAt: now,
      })
      .where(eq(workflowItems.id, itemId))
    revalidatePath('/dashboard')
  }
}

export async function recordDecisions(
  itemIds: string[],
  actionId: string,
  workflowId: string,
): Promise<void> {
  if (itemIds.length === 0) return
  const userId = await currentUserId()
  const now = new Date()

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)

  const action = (workflow?.availableActions as Action[] | undefined)?.find(
    (a) => a.id === actionId,
  )
  if (!action?.resultingStatus) return

  // Bulk actions apply the status directly — no per-item webhook dispatch.
  await db
    .update(workflowItems)
    .set({
      status: action.resultingStatus,
      decidedAt: now,
      decidedBy: userId,
      updatedAt: now,
    })
    .where(inArray(workflowItems.id, itemIds))
  revalidatePath('/dashboard')
}
