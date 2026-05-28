import { fmtMoney, fmtRelative } from '@/lib/format'
import { Score } from '@/components/ui/Score'
import type { FieldDef, FieldType } from '@/lib/contract'

export function renderCell(field: FieldDef, value: unknown): React.ReactNode {
  if (value === undefined || value === null || value === '') {
    return <span className="muted">—</span>
  }
  switch (field.type) {
    case 'money':
      return fmtMoney(Number(value))
    case 'score': {
      const n = Number(value)
      return n > 0 ? <Score v={n} /> : <span className="muted">—</span>
    }
    case 'email':
      return String(value)
    case 'count': {
      const n = Number(value)
      return n > 0 ? String(n) : <span className="muted">—</span>
    }
    case 'datetime':
      return fmtRelative(String(value))
    case 'badge':
      return <span className="badge">{String(value)}</span>
    case 'text':
    default:
      return String(value)
  }
}

export function isNumericField(type: FieldType): boolean {
  return type === 'money' || type === 'score' || type === 'count' || type === 'datetime'
}

export function tdClass(field: FieldDef): string {
  if (field.type === 'email') return 'mono muted'
  if (isNumericField(field.type)) return 'num'
  return ''
}
