import { describe, it, expect } from 'vitest'
import {
  ActionIntent,
  ActionSchema,
  FieldDefSchema,
  ItemSchema,
  WorkflowSchema,
  intentToVariant,
  resolveItemActions,
  bulkActions,
  singleActions,
  type Action,
} from '@/lib/contract'

const action = (overrides: Record<string, unknown> = {}): Action =>
  ActionSchema.parse({ id: 'approve', label: 'Approve', handler: 'approve', ...overrides })

const item = (overrides: Record<string, unknown> = {}) =>
  ItemSchema.parse({
    id: 'item-1',
    createdAt: '2026-06-01T12:00:00Z',
    summary: 'An item',
    ...overrides,
  })

const workflow = (overrides: Record<string, unknown> = {}) =>
  WorkflowSchema.parse({
    id: 'wf-1',
    name: 'Workflow',
    description: 'A workflow',
    ...overrides,
  })

describe('intentToVariant', () => {
  it('maps each intent to its button variant', () => {
    expect(intentToVariant.primary).toBe('brass')
    expect(intentToVariant.neutral).toBe('ghost')
    expect(intentToVariant.destructive).toBe('danger')
  })

  it('covers every ActionIntent exhaustively', () => {
    for (const intent of ActionIntent.options) {
      expect(intentToVariant[intent]).toBeTruthy()
    }
  })
})

describe('ActionSchema', () => {
  it('applies defaults for intent, appliesTo and confirm', () => {
    const a = action()
    expect(a.intent).toBe('neutral')
    expect(a.appliesTo).toBe('single')
    expect(a.confirm).toBe(false)
    expect(a.resultingStatus).toBeUndefined()
  })

  it('rejects hotkeys longer than one character', () => {
    expect(() => action({ hotkey: 'AB' })).toThrow()
    expect(action({ hotkey: 'A' }).hotkey).toBe('A')
  })

  it('accepts a string handler or a { url } webhook handler', () => {
    expect(action({ handler: 'noop' }).handler).toBe('noop')
    const webhook = action({ handler: { url: 'https://engine.example.com/hook' } })
    expect(webhook.handler).toEqual({ url: 'https://engine.example.com/hook' })
  })

  it('rejects a webhook handler with an invalid url', () => {
    expect(() => action({ handler: { url: 'not-a-url' } })).toThrow()
  })

  it('rejects a resultingStatus outside ItemStatus', () => {
    expect(() => action({ resultingStatus: 'archived' })).toThrow()
  })
})

describe('ItemSchema', () => {
  it('applies defaults for status, priority, fields and context', () => {
    const i = item()
    expect(i.status).toBe('pending')
    expect(i.priority).toBe('normal')
    expect(i.fields).toEqual({})
    expect(i.context).toEqual([])
    expect(i.actions).toBeUndefined()
  })

  it('requires createdAt to be an ISO 8601 datetime with offset or Z', () => {
    expect(item({ createdAt: '2026-06-01T12:00:00+05:30' }).createdAt).toBe(
      '2026-06-01T12:00:00+05:30',
    )
    expect(() => item({ createdAt: '2026-06-01 12:00:00' })).toThrow()
    expect(() => item({ createdAt: 'yesterday' })).toThrow()
  })

  it('rejects a status outside ItemStatus', () => {
    expect(() => item({ status: 'flagged' })).toThrow()
  })
})

describe('WorkflowSchema', () => {
  it('applies defaults for status, defaultView and collections', () => {
    const wf = workflow()
    expect(wf.status).toBe('idle')
    expect(wf.defaultView).toBe('table')
    expect(wf.steps).toEqual([])
    expect(wf.stats).toEqual([])
    expect(wf.items).toEqual([])
    expect(wf.itemSchema).toEqual([])
    expect(wf.availableActions).toEqual([])
    expect(wf.sources).toEqual([])
  })

  it('bounds confidenceFloor to [0, 1]', () => {
    expect(workflow({ confidenceFloor: 0 }).confidenceFloor).toBe(0)
    expect(workflow({ confidenceFloor: 1 }).confidenceFloor).toBe(1)
    expect(() => workflow({ confidenceFloor: 1.5 })).toThrow()
    expect(() => workflow({ confidenceFloor: -0.1 })).toThrow()
  })
})

describe('FieldDefSchema', () => {
  it('defaults showInTable and showInCard to true', () => {
    const f = FieldDefSchema.parse({ key: 'amount', label: 'Amount', type: 'money' })
    expect(f.showInTable).toBe(true)
    expect(f.showInCard).toBe(true)
  })

  it('rejects an unknown field type', () => {
    expect(() => FieldDefSchema.parse({ key: 'k', label: 'K', type: 'rating' })).toThrow()
  })
})

describe('resolveItemActions', () => {
  const approve = action({ id: 'approve' })
  const reject = action({ id: 'reject' })

  it('falls back to the workflow actions when the item has none', () => {
    const wf = workflow({ availableActions: [approve, reject] })
    expect(resolveItemActions(wf, item())).toEqual([approve, reject])
  })

  it('returns the item-level set when present', () => {
    const wf = workflow({ availableActions: [approve, reject] })
    const narrowed = item({ actions: [reject] })
    expect(resolveItemActions(wf, narrowed)).toEqual([reject])
  })

  it('treats an explicit empty item set as a narrowing, not a fallback', () => {
    const wf = workflow({ availableActions: [approve] })
    expect(resolveItemActions(wf, item({ actions: [] }))).toEqual([])
  })
})

describe('bulkActions', () => {
  it('keeps bulk and both scopes, drops single, preserving order', () => {
    const wf = workflow({
      availableActions: [
        action({ id: 'approve', appliesTo: 'both' }),
        action({ id: 'edit', appliesTo: 'single' }),
        action({ id: 'skip', appliesTo: 'bulk' }),
      ],
    })
    expect(bulkActions(wf).map((a) => a.id)).toEqual(['approve', 'skip'])
  })

  it('returns empty when no actions are bulk-capable', () => {
    const wf = workflow({ availableActions: [action({ appliesTo: 'single' })] })
    expect(bulkActions(wf)).toEqual([])
  })
})

describe('singleActions', () => {
  const approve = action({ id: 'approve', appliesTo: 'both' })
  const skip = action({ id: 'skip', appliesTo: 'bulk' })
  const edit = action({ id: 'edit', appliesTo: 'single' })

  it('keeps single and both scopes from the workflow set', () => {
    const wf = workflow({ availableActions: [approve, skip, edit] })
    expect(singleActions(wf, item()).map((a) => a.id)).toEqual(['approve', 'edit'])
  })

  it('filters the item-level set when the item narrows its actions', () => {
    const wf = workflow({ availableActions: [approve, skip, edit] })
    const narrowed = item({ actions: [edit, skip] })
    expect(singleActions(wf, narrowed).map((a) => a.id)).toEqual(['edit'])
  })
})
