'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CLIENT, WORKFLOWS } from '@/lib/data'
import { BracketMark } from './BracketMark'

interface NavProps {
  workflowId: string
}

export function Nav({ workflowId }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const page = pathname == null ? ''
    : pathname === '/' ? 'login'
    : pathname.startsWith('/dashboard') ? 'dashboard'
    : pathname.startsWith('/config') ? 'config'
    : pathname.startsWith('/settings') ? 'settings'
    : ''

  const pickWorkflow = (id: string) => {
    router.push(`/dashboard?workflow=${id}`)
  }

  return (
    <aside className="nav">
      {/* brand row */}
      <div className="nav__brand">
        <BracketMark size={22} />
        <div className="nav__brand-mark">
          <span>{CLIENT.name}</span>
          <span className="nav__brand-slash">/</span>
          <span>Console</span>
        </div>
      </div>

      {/* workflows */}
      <div style={{ overflowY: 'auto' }}>
        <div className="nav__section" style={{ paddingBottom: 4 }}>
          <div className="nav__section-label">Workflows</div>
        </div>
        <ul className="nav__list">
          {WORKFLOWS.map((wf) => (
            <li
              key={wf.id}
              className={
                'nav__item ' +
                (page === 'dashboard' && wf.id === workflowId ? 'nav__item--active' : '')
              }
              onClick={() => pickWorkflow(wf.id)}
            >
              <span className="nav__item-name">
                <span className={
                  'nav__item-dot ' +
                  (wf.status === 'idle' ? 'nav__item-dot--idle' : '') +
                  (wf.status === 'off'  ? 'nav__item-dot--off'  : '')
                } />
                {wf.name}
              </span>
              <span className="nav__item-count">
                {wf.pending > 0
                  ? `${wf.pending}`
                  : wf.cadence === '—' ? '—' : ''}
              </span>
            </li>
          ))}
        </ul>

        <div className="nav__divider"></div>

        <div className="nav__section" style={{ paddingTop: 0 }}>
          <ul className="nav__list" style={{ padding: 0 }}>
            <li className={'nav__item ' + (page === 'config' ? 'nav__item--active' : '')}>
              <Link href="/config" style={{ all: 'unset', width: '100%', cursor: 'pointer' }}>
                <span className="nav__item-name">› config</span>
              </Link>
            </li>
            <li className={'nav__item ' + (page === 'settings' ? 'nav__item--active' : '')}>
              <Link href="/settings" style={{ all: 'unset', width: '100%', cursor: 'pointer' }}>
                <span className="nav__item-name">› settings</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* user identity */}
      <Link href="/settings" style={{ all: 'unset' }}>
        <div className="nav__user" style={{ cursor: 'pointer' }}>
          <div>
            <div className="nav__user-name">j.grant</div>
            <div className="nav__user-role">operator</div>
          </div>
          <div className="nav__user-ver">v 0.4.2</div>
        </div>
      </Link>
    </aside>
  )
}
