import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { tasks } from '@trigger.dev/sdk'

import { parsePubSubPush, type PubSubPushBody } from '@/trigger/lib/gmail'
import type { quoteDeskIntake } from '@/trigger/quote-desk-intake'

/**
 * Gmail → Pub/Sub push endpoint (feat-015).
 *
 * The Gmail `users.watch` channel publishes change notifications to a Pub/Sub
 * topic; its push subscription POSTs the wrapped message here. We verify the
 * subscription's shared token, decode the notification, and hand it to the
 * `quote-desk-intake` trigger.dev task. Configure the subscription's push URL as
 * `…/api/gmail/push?token=$PUBSUB_VERIFICATION_TOKEN` (see quote-desk-setup.md §4).
 */

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.PUBSUB_VERIFICATION_TOKEN
  if (!expected) return true // unset → verification disabled (dev only)
  const provided = req.nextUrl.searchParams.get('token') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ error: 'invalid verification token' }, { status: 401 })
  }

  let body: PubSubPushBody
  try {
    body = (await req.json()) as PubSubPushBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  let notification
  try {
    notification = parsePubSubPush(body)
  } catch (err) {
    // Ack malformed envelopes with 400 so Pub/Sub stops redelivering them.
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  await tasks.trigger<typeof quoteDeskIntake>('quote-desk-intake', notification)

  // 204 acks the push so Pub/Sub does not redeliver.
  return new NextResponse(null, { status: 204 })
}
