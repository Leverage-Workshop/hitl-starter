import type { ReactNode } from 'react'

interface TopbarProps {
  crumbs: string[]
  right?: ReactNode
}

export function Topbar({ crumbs, right }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__crumbs">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'now' : ''}>{c}</span>
          </span>
        ))}
      </div>
      <div className="topbar__actions">
        <span className="env-pill"><span className="dot"></span>ENV · PROD</span>
        {right}
      </div>
    </header>
  )
}
