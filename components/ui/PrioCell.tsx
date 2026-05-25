import type { ItemPriority } from '@/lib/types'

export function PrioCell({ p }: { p: ItemPriority }) {
  return <span className={`prio prio--${p}`}>{p}</span>
}
