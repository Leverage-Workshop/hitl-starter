import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { tasks } from '@trigger.dev/sdk'

import type { quoteDeskSend } from '@/trigger/quote-desk-send'

/**
 * Quote-desk send-on-approval handler (feat-017).
 *
 * The outbound decision dispatch (feat-006) POSTs an HMAC-signed
 * `{ itemId, decisionId, workflowId, actionId }` here when a broker fires the
 * "Approve & send" / "Adjust rate & send" action — point those actions' handler
 * `{ url }` at this route and add its host to `ALLOWED_WEBHOOK_DOMAINS`. We
 * verify the signature, then trigger the `quote-desk-send` task which emails the
 * quote to the shipper (threaded onto the RFQ) and settles the item.
 */

interface DecisionPayload {
  itemId?: string
  decisionId?: string
  workflowId?: string
  actionId?: string
}

/** Only the send-bearing actions fire a reply. */
const SEND_ACTIONS = new Set(['approve', 'adjust'])

/** Verify the `x-signature-sha256` HMAC over the raw body, if a secret is set. */
function signatureOk(rawBody: string, provided: string | null): boolean {
  const secret = process.env.QUOTE_SEND_WEBHOOK_SECRET
  if (!secret) return true // unset → verification disabled (dev only)
  if (!provided) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!signatureOk(rawBody, req.headers.get('x-signature-sha256'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: DecisionPayload
  try {
    payload = JSON.parse(rawBody) as DecisionPayload
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!payload.itemId) {
    return NextResponse.json({ error: 'missing itemId' }, { status: 400 })
  }

  // Ack non-send actions (e.g. decline/reassign) without sending an email.
  if (payload.actionId && !SEND_ACTIONS.has(payload.actionId)) {
    return NextResponse.json({ ok: true, skipped: payload.actionId }, { status: 200 })
  }

  await tasks.trigger<typeof quoteDeskSend>('quote-desk-send', { itemId: payload.itemId })

  return NextResponse.json({ ok: true, itemId: payload.itemId }, { status: 202 })
}
