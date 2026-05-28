import type { ItemStatus } from '@/lib/contract'

export function StatusCell({ s }: { s: ItemStatus }) {
  return (
    <span className={`statcell statcell--${s}`}>
      <span className="d"></span>{s}
    </span>
  )
}
