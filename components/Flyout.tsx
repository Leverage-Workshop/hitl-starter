'use client'

import { ACTION_SET } from '@/lib/data'
import { fmtMoney, fmtTime } from '@/lib/format'
import type { WorkflowItem } from '@/lib/types'
import { Button } from './ui/Button'
import { PrioCell } from './ui/PrioCell'
import { StatusCell } from './ui/StatusCell'

interface DetailFlyoutProps {
  item: WorkflowItem | null
  onClose: () => void
  onAction: (id: string, key: string) => void
}

export function DetailFlyout({ item, onClose, onAction }: DetailFlyoutProps) {
  const open = !!item

  return (
    <>
      <div className={'flyout-scrim ' + (open ? 'open' : '')} onClick={onClose}></div>
      <aside className={'flyout ' + (open ? 'open' : '')} aria-hidden={!open}>
        {item && (
          <>
            {/* head */}
            <div className="flyout__head">
              <div>
                <div className="flyout__id">{item.id}</div>
                <div className="flyout__title">{item.subject}</div>
                <div className="flyout__meta">
                  <span>STATUS · <b><StatusCell s={item.status} /></b></span>
                  <span>PRIORITY · <b><PrioCell p={item.priority} /></b></span>
                  <span>VALUE · <b>{fmtMoney(item.value)}</b></span>
                  <span>CONF · <b>{item.score || '—'}</b></span>
                  <span>{fmtTime(item.submitted)}</span>
                </div>
              </div>
              <button className="flyout__close" onClick={onClose}>
                Close <span className="kbd" style={{ marginLeft: 6 }}>ESC</span>
              </button>
            </div>

            {/* body — CONFIGURABLE SLOT.
                Default: two-pane compare (source vs AI draft) + marginalia notes.
                For workflows without an AI draft, replace FlyoutTwoPane with a
                single-pane renderer (e.g. just the source + notes). */}
            <div className="flyout__body">
              <FlyoutTwoPane item={item} />
            </div>

            {/* action bar — CONFIGURABLE SLOT.
                Buttons come from ACTION_SET in lib/data.ts. Swap that array to
                change the decision set per workflow. */}
            <div className="flyout__actionbar">
              <div className="flyout__actionbar-help">
                {ACTION_SET.map((a) => (
                  <span key={a.key} style={{ marginRight: 14 }}>
                    <kbd>{a.hotkey}</kbd> {a.label.toLowerCase()}
                  </span>
                ))}
                <span><kbd>ESC</kbd> close</span>
              </div>
              <div className="flyout__actionbar-buttons">
                {ACTION_SET.map((a) => (
                  <Button
                    key={a.key}
                    variant={a.variant}
                    onClick={() => onAction(item.id, a.key)}
                  >{a.label}</Button>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

// -- default two-pane body ------------------------------------
function FlyoutTwoPane({ item }: { item: WorkflowItem }) {
  return (
    <div className="flypanes">
      {/* LEFT: source — what came in */}
      <div className="flypane">
        <div className="flypane__label">
          <span>SOURCE · INBOUND</span>
          <span style={{ color: 'var(--fg-muted)' }}>
            {item.attachments ? `${item.attachments} ATCH` : 'NO ATCH'}
          </span>
        </div>
        <div className="flypane__field">
          <div className="flypane__field-label">FROM</div>
          <div className="flypane__field-value mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {item.from}
          </div>
        </div>
        <div className="flypane__body flypane__body--mono">{item.source}</div>
      </div>

      {/* MIDDLE: proposed AI draft */}
      <div className="flypane">
        <div className="flypane__label">
          <span>DRAFT · PROPOSED</span>
          <span style={{ color: item.score >= 80 ? 'var(--fg-accent)' : 'var(--fg-muted)' }}>
            CONF · {item.score || '—'}%
          </span>
        </div>
        <div className="flypane__field">
          <div className="flypane__field-label">ACTION</div>
          <div className="flypane__field-value">send-as-draft → CRM thread</div>
        </div>
        <div className="flypane__body">{item.draft}</div>
      </div>

      {/* RIGHT: marginalia + audit notes */}
      <div className="flypane" style={{ background: 'var(--bg)' }}>
        <div className="flypane__label">NOTES</div>
        <div className="notes">
          {(item.notes || []).map((n) => (
            <div key={n.tag} className="notes__item">
              <div>
                <span className="b">[{n.tag}]</span>
                <span className="ts">{n.ts}</span>
              </div>
              <div>{n.body}</div>
            </div>
          ))}
          {(!item.notes || item.notes.length === 0) && (
            <div style={{ color: 'var(--fg-muted)' }}>no notes attached.</div>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="flypane__label">AUDIT</div>
          <div className="notes">
            <div className="notes__item">
              <span className="ts">{fmtTime(item.submitted)}</span> received
            </div>
            <div className="notes__item">
              <span className="ts">{fmtTime(item.submitted)}</span> drafted by model · v2026.05
            </div>
            <div className="notes__item">
              <span className="ts">—</span> awaiting human decision
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
