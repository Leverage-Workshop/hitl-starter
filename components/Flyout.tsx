'use client'

import { fmtTime } from '@/lib/format'
import { renderCell } from '@/lib/renderField'
import {
  intentToVariant,
  singleActions,
  type Item,
  type Workflow,
} from '@/lib/contract'
import { Button } from './ui/Button'
import { PrioCell } from './ui/PrioCell'
import { StatusCell } from './ui/StatusCell'

interface DetailFlyoutProps {
  workflow: Workflow | null
  item: Item | null
  onClose: () => void
  onAction: (id: string, actionId: string) => void
}

export function DetailFlyout({ workflow, item, onClose, onAction }: DetailFlyoutProps) {
  const open = !!item && !!workflow

  return (
    <>
      <div className={'flyout-scrim ' + (open ? 'open' : '')} onClick={onClose}></div>
      <aside className={'flyout ' + (open ? 'open' : '')} aria-hidden={!open}>
        {item && workflow && (
          <>
            {/* head */}
            <FlyoutHead workflow={workflow} item={item} onClose={onClose} />

            {/* body — two-pane: sourceContent vs proposedOutput + context notes */}
            <div className="flyout__body">
              <FlyoutTwoPane workflow={workflow} item={item} />
            </div>

            {/* action bar — driven by singleActions for this item */}
            <FlyoutActionBar workflow={workflow} item={item} onAction={onAction} />
          </>
        )}
      </aside>
    </>
  )
}

// -- flyout head ----------------------------------------------
function FlyoutHead({
  workflow,
  item,
  onClose,
}: {
  workflow: Workflow
  item: Item
  onClose: () => void
}) {
  const titleField = workflow.itemSchema.find((f) => f.type === 'text')
  const title = titleField
    ? String(item.fields[titleField.key] ?? item.summary)
    : item.summary
  const metaFields = workflow.itemSchema.filter(
    (f) => f.showInCard && f.key !== titleField?.key,
  ).slice(0, 3)

  return (
    <div className="flyout__head">
      <div>
        <div className="flyout__id">{item.id}</div>
        <div className="flyout__title">{title}</div>
        <div className="flyout__meta">
          <span>STATUS · <b><StatusCell s={item.status} /></b></span>
          <span>PRIORITY · <b><PrioCell p={item.priority} /></b></span>
          {metaFields.map((f) => (
            <span key={f.key}>
              {f.label.toUpperCase()} · <b>{renderCell(f, item.fields[f.key])}</b>
            </span>
          ))}
          <span>{fmtTime(item.createdAt)}</span>
        </div>
      </div>
      <button className="flyout__close" onClick={onClose}>
        Close <span className="kbd" style={{ marginLeft: 6 }}>ESC</span>
      </button>
    </div>
  )
}

// -- two-pane body --------------------------------------------
function FlyoutTwoPane({ workflow, item }: { workflow: Workflow; item: Item }) {
  const fromField = workflow.itemSchema.find((f) => f.type === 'email')
  const attachField = workflow.itemSchema.find((f) => f.key === 'attachments')
  const scoreField = workflow.itemSchema.find((f) => f.type === 'score')
  const scoreVal = scoreField ? Number(item.fields[scoreField.key] ?? 0) : 0
  const attachVal = attachField ? Number(item.fields[attachField.key] ?? 0) : 0

  return (
    <div className="flypanes">
      {/* LEFT: source — what came in */}
      <div className="flypane">
        <div className="flypane__label">
          <span>SOURCE · INBOUND</span>
          <span style={{ color: 'var(--fg-muted)' }}>
            {attachVal > 0 ? `${attachVal} ATCH` : 'NO ATCH'}
          </span>
        </div>
        {fromField && (
          <div className="flypane__field">
            <div className="flypane__field-label">FROM</div>
            <div className="flypane__field-value mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {String(item.fields[fromField.key] ?? '')}
            </div>
          </div>
        )}
        <div className="flypane__body flypane__body--mono">
          {item.sourceContent ?? <span style={{ color: 'var(--fg-muted)' }}>no source content.</span>}
        </div>
      </div>

      {/* MIDDLE: proposed output */}
      <div className="flypane">
        <div className="flypane__label">
          <span>DRAFT · PROPOSED</span>
          {scoreField && (
            <span style={{ color: scoreVal >= 80 ? 'var(--fg-accent)' : 'var(--fg-muted)' }}>
              CONF · {scoreVal || '—'}%
            </span>
          )}
        </div>
        <div className="flypane__field">
          <div className="flypane__field-label">ACTION</div>
          <div className="flypane__field-value">send-as-draft → CRM thread</div>
        </div>
        <div className="flypane__body">
          {item.proposedOutput ?? <span style={{ color: 'var(--fg-muted)' }}>no proposed output.</span>}
        </div>
      </div>

      {/* RIGHT: context notes + audit */}
      <div className="flypane" style={{ background: 'var(--bg)' }}>
        <div className="flypane__label">NOTES</div>
        <div className="notes">
          {item.context.map((n, i) => (
            <div key={n.ref ?? i} className="notes__item">
              <div>
                {n.ref && <span className="b">{n.ref}</span>}
                {n.createdAt && (
                  <span className="ts">
                    {new Date(n.createdAt).toTimeString().slice(0, 5)}
                  </span>
                )}
              </div>
              <div>{n.body}</div>
            </div>
          ))}
          {item.context.length === 0 && (
            <div style={{ color: 'var(--fg-muted)' }}>no notes attached.</div>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="flypane__label">AUDIT</div>
          <div className="notes">
            <div className="notes__item">
              <span className="ts">{fmtTime(item.createdAt)}</span> received
            </div>
            <div className="notes__item">
              <span className="ts">{fmtTime(item.createdAt)}</span> drafted by model · v2026.05
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

// -- action bar -----------------------------------------------
function FlyoutActionBar({
  workflow,
  item,
  onAction,
}: {
  workflow: Workflow
  item: Item
  onAction: (id: string, actionId: string) => void
}) {
  const actions = singleActions(workflow, item)

  return (
    <div className="flyout__actionbar">
      <div className="flyout__actionbar-help">
        {actions.map((a) => (
          <span key={a.id} style={{ marginRight: 14 }}>
            {a.hotkey && <kbd>{a.hotkey}</kbd>} {a.label.toLowerCase()}
          </span>
        ))}
        <span><kbd>ESC</kbd> close</span>
      </div>
      <div className="flyout__actionbar-buttons">
        {actions.map((a) => (
          <Button
            key={a.id}
            variant={intentToVariant[a.intent]}
            onClick={() => onAction(item.id, a.id)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
