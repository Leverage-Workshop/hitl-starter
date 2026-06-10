import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import type { PGlite } from '@electric-sql/pglite'
import * as schema from '@/db/schema'
import { POST } from '@/app/api/workflows/[id]/items/route'
import { createTestDb, makeWorkflow, type TestDb } from './helpers'

// The route module keeps an in-memory rate limiter keyed by workflowId that
// lives for the whole suite. INVARIANT: every test uses its own unique
// workflowId so each test starts with an untouched 100-request budget.

const dbHolder = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('@/db', () => ({
  db: new Proxy(
    {},
    { get: (_target, prop) => Reflect.get(dbHolder.current as object, prop) },
  ),
  getDb: () => dbHolder.current,
}))

let client: PGlite
let db: TestDb

beforeAll(async () => {
  ;({ client, db } = await createTestDb())
  dbHolder.current = db
})

afterAll(async () => {
  await client.close()
})

const SECRET = 's3cret'

function post(
  workflowId: string,
  opts: { secret?: string; body?: unknown; rawBody?: string } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.secret !== undefined) headers['x-webhook-secret'] = opts.secret
  const req = new NextRequest(`http://localhost/api/workflows/${workflowId}/items`, {
    method: 'POST',
    headers,
    body: opts.rawBody ?? JSON.stringify(opts.body ?? {}),
  })
  return POST(req, { params: Promise.resolve({ id: workflowId }) })
}

async function seedWorkflow(id: string, webhookSecret: string | null = SECRET) {
  await db.insert(schema.workflows).values(makeWorkflow({ id, webhookSecret }))
}

async function itemsById(id: string) {
  return db.select().from(schema.workflowItems).where(eq(schema.workflowItems.id, id))
}

describe('POST /api/workflows/[id]/items', () => {
  it('returns 401 for an unknown workflow (no existence leak)', async () => {
    const res = await post('wf-unknown', {
      secret: SECRET,
      body: { id: 'i1', summary: 'hello' },
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })

  it('returns 401 for a wrong or missing secret', async () => {
    await seedWorkflow('wf-bad-secret')
    const wrong = await post('wf-bad-secret', {
      secret: 'wrong',
      body: { id: 'i1', summary: 'hello' },
    })
    expect(wrong.status).toBe(401)

    const missing = await post('wf-bad-secret', { body: { id: 'i1', summary: 'hello' } })
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: 'unauthorized' })
  })

  it('returns 401 when the workflow has no webhookSecret configured', async () => {
    await seedWorkflow('wf-no-secret', null)
    // Even a matching empty header must be rejected (the `!expected` branch).
    const empty = await post('wf-no-secret', {
      secret: '',
      body: { id: 'i1', summary: 'hello' },
    })
    expect(empty.status).toBe(401)

    const any = await post('wf-no-secret', {
      secret: 'anything',
      body: { id: 'i1', summary: 'hello' },
    })
    expect(any.status).toBe(401)
  })

  it('returns 422 for a non-JSON body', async () => {
    await seedWorkflow('wf-bad-json')
    const res = await post('wf-bad-json', { secret: SECRET, rawBody: '{not json' })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'invalid json' })
  })

  it('returns 422 with zod issues for an invalid payload', async () => {
    await seedWorkflow('wf-invalid')
    const missingSummary = await post('wf-invalid', {
      secret: SECRET,
      body: { id: 'i1' },
    })
    expect(missingSummary.status).toBe(422)
    const body = await missingSummary.json()
    expect(body.error).toBe('validation error')
    expect(body.issues.length).toBeGreaterThan(0)
    expect(JSON.stringify(body.issues)).toContain('summary')

    const emptyId = await post('wf-invalid', {
      secret: SECRET,
      body: { id: '', summary: 'hello' },
    })
    expect(emptyId.status).toBe(422)
  })

  it('creates an item with defaults from a minimal payload', async () => {
    await seedWorkflow('wf-minimal')
    const res = await post('wf-minimal', {
      secret: SECRET,
      body: { id: 'item-min', summary: 'minimal item' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'item-min', workflowId: 'wf-minimal' })

    const [row] = await itemsById('item-min')
    expect(row).toMatchObject({
      workflowId: 'wf-minimal',
      status: 'pending',
      priority: 'normal',
      summary: 'minimal item',
      fields: {},
      context: [],
      sourceContent: null,
      proposedOutput: null,
    })
    expect(row.createdAt).toBeInstanceOf(Date)
    expect(row.updatedAt).toBeInstanceOf(Date)
  })

  it('persists a full payload verbatim', async () => {
    await seedWorkflow('wf-full')
    const note = { ref: 'r-1', label: 'origin', body: 'a note', createdAt: '2026-06-01' }
    const res = await post('wf-full', {
      secret: SECRET,
      body: {
        id: 'item-full',
        summary: 'full item',
        priority: 'high',
        fields: { amount: 42, lane: 'CHI-DAL' },
        sourceContent: 'source text',
        proposedOutput: 'proposed text',
        context: [note],
      },
    })
    expect(res.status).toBe(200)

    const [row] = await itemsById('item-full')
    expect(row).toMatchObject({
      priority: 'high',
      fields: { amount: 42, lane: 'CHI-DAL' },
      sourceContent: 'source text',
      proposedOutput: 'proposed text',
      context: [note],
    })
  })

  it('upserts idempotently on item.id without touching status/priority/createdAt', async () => {
    await seedWorkflow('wf-upsert')
    await post('wf-upsert', {
      secret: SECRET,
      body: { id: 'item-up', summary: 'v1', priority: 'high', fields: { v: 1 } },
    })

    // Simulate the reviewer settling the item before the engine re-posts.
    await db
      .update(schema.workflowItems)
      .set({ status: 'approved' })
      .where(eq(schema.workflowItems.id, 'item-up'))
    const [before] = await itemsById('item-up')

    const res = await post('wf-upsert', {
      secret: SECRET,
      body: {
        id: 'item-up',
        summary: 'v2',
        priority: 'flagged',
        fields: { v: 2 },
        sourceContent: 'new source',
        proposedOutput: 'new output',
        context: [{ body: 'retry note' }],
      },
    })
    expect(res.status).toBe(200)

    const rows = await itemsById('item-up')
    expect(rows).toHaveLength(1)
    const [after] = rows
    // Updated by the upsert:
    expect(after.summary).toBe('v2')
    expect(after.fields).toEqual({ v: 2 })
    expect(after.sourceContent).toBe('new source')
    expect(after.proposedOutput).toBe('new output')
    expect(after.context).toEqual([{ body: 'retry note' }])
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime())
    // Preserved across the upsert:
    expect(after.status).toBe('approved')
    expect(after.priority).toBe('high')
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime())
  })

  it('rate limits per workflowId after 100 requests, before DB/auth', async () => {
    // Unknown workflow: requests 1-100 are 401s, proving the limiter still
    // counts them (rate check precedes the workflow lookup).
    for (let i = 0; i < 100; i++) {
      const res = await post('wf-rate-limited', { secret: SECRET, rawBody: '{}' })
      expect(res.status).toBe(401)
    }

    const limited = await post('wf-rate-limited', { secret: SECRET, rawBody: '{}' })
    expect(limited.status).toBe(429)
    expect(await limited.json()).toEqual({ error: 'rate limit exceeded' })
    expect(limited.headers.get('x-ratelimit-limit')).toBe('100')
    expect(limited.headers.get('retry-after')).toBe('60')

    // The exhausted budget must not leak to other workflows.
    await seedWorkflow('wf-rate-other')
    const other = await post('wf-rate-other', {
      secret: SECRET,
      body: { id: 'item-rate-other', summary: 'still fine' },
    })
    expect(other.status).toBe(200)
  })
})
