import type { Priority } from '@/lib/contract'

export function PrioCell({ p }: { p: Priority }) {
  return <span className={`prio prio--${p}`}>{p}</span>
}
