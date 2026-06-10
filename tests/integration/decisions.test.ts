import { createHmac } from 'crypto'
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { PGlite } from '@electric-sql/pglite'
import { auth } from '@/lib/auth'
import * as schema from '@/db/schema'
import type { Action } from '@/lib/contract'
import { recordDecision, recordDecisions } from '@/app/actions/decisions'
import { createTestDb, makeAction, makeItem, makeWorkflow, seedUser, type TestDb } from './helpers'

const dbHolder = vi.hoisted(() => ({ current: null as unknown }))
const sessionHolder = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  reject: false,
}))

vi.mock('@/db', () => ({
  db: new Proxy(
    {},
    { get: (_target, prop) => Reflect.get(dbHolder.current as object, prop) },
  ),
  getDb: () => dbHolder.current,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => {
        if (sessionHolder.reject) throw new Error('no session store')
        return sessionHolder.session
      }),
    },
  },
}))

let client: PGlite
let db: TestDb
let fetchMock: ReturnType<typeof vi.fn>

const SECRET = 'whsec'
const ALLOWED_URL = 'https://hooks.example.com/decisions'

const webhookApprove = (overrides: Partial<Action> = {}): Action =>
  makeAction({
    resultingStatus: 'approved',
    handler: { url: ALLOWED_URL },
    ...overrides,
  })

beforeAll(async () => {
  ;({ client, db } = await createTestDb())
  dbHolder.current = db
  await seedUser(db, 'user-1')
  // Failure paths intentionally console.error — keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(async () => {
  await client.close()
})

beforeEach(async () => {
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('ALLOWED_WEBHOOK_DOMAINS', 'example.com')
  sessionHolder.session = { user: { id: 'user-1' } }
  sessionHolder.reject = false
  // Cascades workflow_items; the user row survives for the decidedBy FK.
  await db.delete(schema.workflows)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

async function seed(actions: Action[], webhookSecret: string | null = SECRET) {
  await db
    .insert(schema.workflows)
    .values(makeWorkflow({ id: 'wf-1', availableActions: actions, webhookSecret }))
  await db.insert(schema.workflowItems).values(makeItem({ id: 'item-1' }))
}

async function getItem(id = 'item-1') {
  const [row] = await db
    .select()
    .from(schema.workflowItems)
    .where(eq(schema.workflowItems.id, id))
  return row
}

describe('recordDecision', () => {
  it('is a no-op for an unknown workflow', async () => {
    await recordDecision('item-1', 'approve', 'wf-missing')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('is a no-op when the action has no resultingStatus', async () => {
    await seed([makeAction({ id: 'ping', resultingStatus: undefined })])
    await recordDecision('item-1', 'ping', 'wf-1')
    expect((await getItem()).status).toBe('pending')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('applies a string-handler action directly without dispatching', async () => {
    await seed([makeAction({ id: 'approve', resultingStatus: 'approved' })])
    await recordDecision('item-1', 'approve', 'wf-1')

    const item = await getItem()
    expect(item.status).toBe('approved')
    expect(item.decidedAt).toBeInstanceOf(Date)
    expect(item.decidedBy).toBe('user-1')
    expect(item.dispatchedAt).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/dashboard')
  })

  it('records decidedBy as null when there is no session', async () => {
    sessionHolder.session = null
    await seed([makeAction({ id: 'approve', resultingStatus: 'approved' })])
    await recordDecision('item-1', 'approve', 'wf-1')
    expect(await getItem()).toMatchObject({ status: 'approved', decidedBy: null })
  })

  it('records decidedBy as null when the session lookup throws', async () => {
    sessionHolder.reject = true
    await seed([makeAction({ id: 'approve', resultingStatus: 'approved' })])
    await recordDecision('item-1', 'approve', 'wf-1')
    expect(await getItem()).toMatchObject({ status: 'approved', decidedBy: null })
  })

  it('dispatches a webhook action and settles to resultingStatus on success', async () => {
    await seed([webhookApprove()])
    await recordDecision('item-1', 'approve', 'wf-1')

    const item = await getItem()
    expect(item.status).toBe('approved')
    expect(item.decidedAt).toBeInstanceOf(Date)
    expect(item.decidedBy).toBe('user-1')
    expect(item.dispatchedAt).toBeInstanceOf(Date)
    // dispatching → final status = two revalidations.
    expect(revalidatePath).toHaveBeenCalledTimes(2)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(ALLOWED_URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    )
  })

  it('signs the outbound payload with HMAC-SHA256 and an idempotency key', async () => {
    await seed([webhookApprove()])
    await recordDecision('item-1', 'approve', 'wf-1')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const rawBody = init.body as string
    const headers = init.headers as Record<string, string>

    const payload = JSON.parse(rawBody)
    expect(payload).toEqual({
      itemId: 'item-1',
      decisionId: expect.stringMatching(/^item-1-\d+$/),
      workflowId: 'wf-1',
      actionId: 'approve',
    })
    expect(headers['x-idempotency-key']).toBe(`item-1-${payload.decisionId}`)
    expect(headers['x-signature-sha256']).toBe(
      createHmac('sha256', SECRET).update(rawBody).digest('hex'),
    )
  })

  it('omits the signature header when the workflow has no secret', async () => {
    await seed([webhookApprove()], null)
    await recordDecision('item-1', 'approve', 'wf-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['x-signature-sha256']).toBeUndefined()
    expect(headers['x-idempotency-key']).toBeDefined()
  })

  it('honors a custom handler method', async () => {
    await seed([webhookApprove({ handler: { url: ALLOWED_URL, method: 'PUT' } })])
    await recordDecision('item-1', 'approve', 'wf-1')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PUT')
  })

  it('leaves the item dispatching when the receiver responds non-ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await seed([webhookApprove()])
    await recordDecision('item-1', 'approve', 'wf-1')

    const item = await getItem()
    expect(item.status).toBe('dispatching')
    expect(item.dispatchedAt).toBeInstanceOf(Date)
    expect(revalidatePath).toHaveBeenCalledTimes(1)
  })

  it('leaves the item dispatching on a network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    await seed([webhookApprove()])
    await recordDecision('item-1', 'approve', 'wf-1')
    expect((await getItem()).status).toBe('dispatching')
  })

  it('blocks dispatch entirely when no allowlist is configured', async () => {
    vi.stubEnv('ALLOWED_WEBHOOK_DOMAINS', undefined)
    await seed([webhookApprove()])
    await recordDecision('item-1', 'approve', 'wf-1')
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await getItem()).status).toBe('dispatching')
  })

  it('blocks suffix-spoofed hostnames but allows real subdomains', async () => {
    await seed([
      webhookApprove({
        handler: { url: 'https://evil.example.com.attacker.com/decisions' },
      }),
    ])
    await recordDecision('item-1', 'approve', 'wf-1')
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await getItem()).status).toBe('dispatching')

    // Same allowlist, genuine subdomain: dispatch goes through.
    await db.delete(schema.workflows)
    await seed([webhookApprove()])
    await recordDecision('item-1', 'approve', 'wf-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((await getItem()).status).toBe('approved')
  })
})

describe('recordDecisions', () => {
  it('bulk-applies the status without dispatching webhooks', async () => {
    await seed([webhookApprove()])
    await db.insert(schema.workflowItems).values([
      makeItem({ id: 'item-2' }),
      makeItem({ id: 'item-3' }),
      makeItem({ id: 'item-4' }),
    ])

    await recordDecisions(['item-1', 'item-2', 'item-3'], 'approve', 'wf-1')

    for (const id of ['item-1', 'item-2', 'item-3']) {
      const item = await getItem(id)
      expect(item.status).toBe('approved')
      expect(item.decidedAt).toBeInstanceOf(Date)
      expect(item.decidedBy).toBe('user-1')
    }
    expect((await getItem('item-4')).status).toBe('pending')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/dashboard')
  })

  it('returns early for an empty itemIds list', async () => {
    await seed([makeAction({ id: 'approve', resultingStatus: 'approved' })])
    await recordDecisions([], 'approve', 'wf-1')
    expect(vi.mocked(auth.api.getSession)).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('is a no-op when the action has no resultingStatus', async () => {
    await seed([makeAction({ id: 'ping', resultingStatus: undefined })])
    await recordDecisions(['item-1'], 'ping', 'wf-1')
    expect((await getItem()).status).toBe('pending')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
