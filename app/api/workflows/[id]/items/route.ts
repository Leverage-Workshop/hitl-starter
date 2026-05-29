import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { workflows, workflowItems } from '@/db/schema'

// ---------------------------------------------------------------------------
// Rate limiter — sliding window, in-memory per function instance.
// Replace with Upstash Redis for multi-instance deployments.
// ---------------------------------------------------------------------------
const rateMap = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT = 100
const WINDOW_MS = 60_000

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(key) ?? { count: 0, windowStart: now }
  if (now - entry.windowStart > WINDOW_MS) {
    rateMap.set(key, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  rateMap.set(key, entry)
  return entry.count > RATE_LIMIT
}

// ---------------------------------------------------------------------------
// Payload schema
// ---------------------------------------------------------------------------
const InboundItemSchema = z.object({
  id: z.string().min(1),
  priority: z.enum(['high', 'normal', 'flagged']).optional(),
  summary: z.string().min(1),
  fields: z.record(z.string(), z.unknown()).optional(),
  sourceContent: z.string().optional(),
  proposedOutput: z.string().optional(),
  context: z
    .array(
      z.object({
        ref: z.string().optional(),
        label: z.string().optional(),
        body: z.string(),
        createdAt: z.string().optional(),
      }),
    )
    .optional(),
})

// ---------------------------------------------------------------------------
// POST /api/workflows/[id]/items
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workflowId } = await params

  if (isRateLimited(workflowId)) {
    return NextResponse.json(
      { error: 'rate limit exceeded' },
      {
        status: 429,
        headers: {
          'x-ratelimit-limit': String(RATE_LIMIT),
          'retry-after': '60',
        },
      },
    )
  }

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)

  if (!workflow) {
    // Return 401 rather than 404 to avoid confirming workflow existence to unauthenticated callers.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const provided = req.headers.get('x-webhook-secret') ?? ''
  const expected = workflow.webhookSecret ?? ''

  if (!expected || !constantTimeEqual(expected, provided)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 422 })
  }

  const parsed = InboundItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation error', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const data = parsed.data
  const now = new Date()

  await db
    .insert(workflowItems)
    .values({
      id: data.id,
      workflowId,
      status: 'pending',
      priority: data.priority ?? 'normal',
      createdAt: now,
      summary: data.summary,
      fields: data.fields ?? {},
      sourceContent: data.sourceContent ?? null,
      proposedOutput: data.proposedOutput ?? null,
      context: data.context ?? [],
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: workflowItems.id,
      set: {
        summary: data.summary,
        fields: data.fields ?? {},
        sourceContent: data.sourceContent ?? null,
        proposedOutput: data.proposedOutput ?? null,
        context: data.context ?? [],
        updatedAt: now,
      },
    })

  return NextResponse.json({ id: data.id, workflowId }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Constant-time string comparison — prevents timing attacks on secrets. */
function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      // Still run timingSafeEqual on same-length buffers to avoid short-circuit
      timingSafeEqual(bufA, bufA)
      return false
    }
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
