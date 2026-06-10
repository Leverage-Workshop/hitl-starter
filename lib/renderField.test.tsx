import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
import { renderCell, isNumericField, tdClass } from '@/lib/renderField'
import { FieldDefSchema, FieldType, type FieldDef } from '@/lib/contract'
import { Score } from '@/components/ui/Score'

const field = (type: FieldType): FieldDef =>
  FieldDefSchema.parse({ key: 'k', label: 'K', type })

type SpanProps = { className?: string; children?: React.ReactNode; v?: number }

const asElement = (node: React.ReactNode): ReactElement<SpanProps> => {
  expect(isValidElement(node)).toBe(true)
  return node as ReactElement<SpanProps>
}

const expectMutedDash = (node: React.ReactNode) => {
  const el = asElement(node)
  expect(el.type).toBe('span')
  expect(el.props.className).toBe('muted')
  expect(el.props.children).toBe('—')
}

describe('renderCell', () => {
  it('renders a muted em dash for undefined, null and empty values', () => {
    for (const type of FieldType.options) {
      expectMutedDash(renderCell(field(type), undefined))
      expectMutedDash(renderCell(field(type), null))
      expectMutedDash(renderCell(field(type), ''))
    }
  })

  it('renders money via fmtMoney', () => {
    expect(renderCell(field('money'), 5000)).toBe('$5k')
  })

  it('renders money zero as a bare string em dash (fmtMoney falsy guard)', () => {
    expect(renderCell(field('money'), 0)).toBe('—')
  })

  it('renders positive scores with the Score component', () => {
    const el = asElement(renderCell(field('score'), 87))
    expect(el.type).toBe(Score)
    expect(el.props.v).toBe(87)
  })

  it('renders a zero score as a muted em dash', () => {
    expectMutedDash(renderCell(field('score'), 0))
  })

  it('renders email as a plain string', () => {
    expect(renderCell(field('email'), 'ops@example.com')).toBe('ops@example.com')
  })

  it('renders positive counts as strings and zero as a muted em dash', () => {
    expect(renderCell(field('count'), 6)).toBe('6')
    expectMutedDash(renderCell(field('count'), 0))
  })

  describe('datetime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-10T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders datetime via fmtRelative', () => {
      expect(renderCell(field('datetime'), '2026-06-10T10:30:00Z')).toBe('2h')
    })
  })

  it('renders badge values inside a badge span', () => {
    const el = asElement(renderCell(field('badge'), 'flagged'))
    expect(el.type).toBe('span')
    expect(el.props.className).toBe('badge')
    expect(el.props.children).toBe('flagged')
  })

  it('renders text by stringifying the value', () => {
    expect(renderCell(field('text'), 'hello')).toBe('hello')
    expect(renderCell(field('text'), 42)).toBe('42')
  })
})

describe('isNumericField', () => {
  it('is true only for money, score, count and datetime', () => {
    const numeric = new Set(['money', 'score', 'count', 'datetime'])
    for (const type of FieldType.options) {
      expect(isNumericField(type)).toBe(numeric.has(type))
    }
  })
})

describe('tdClass', () => {
  it('styles email as mono muted', () => {
    expect(tdClass(field('email'))).toBe('mono muted')
  })

  it('styles numeric fields as num', () => {
    for (const type of ['money', 'score', 'count', 'datetime'] as const) {
      expect(tdClass(field(type))).toBe('num')
    }
  })

  it('leaves text and badge unstyled', () => {
    expect(tdClass(field('text'))).toBe('')
    expect(tdClass(field('badge'))).toBe('')
  })
})
