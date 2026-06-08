'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  bulkActions,
  intentToVariant,
  resolveItemActions,
  singleActions,
  type Item,
  type Workflow,
} from '@/lib/contract'
import { fmtRelative } from '@/lib/format'
import { renderCell, tdClass } from '@/lib/renderField'
import { DetailFlyout } from '@/components/Flyout'
import { Button } from '@/components/ui/Button'
import { Nav } from '@/components/ui/Nav'
import { PrioCell } from '@/components/ui/PrioCell'
import { StatusCell } from '@/components/ui/StatusCell'
import { Topbar } from '@/components/ui/Topbar'
import { recordDecision, recordDecisions } from '@/app/actions/decisions'
import type { NavWorkflow } from '@/lib/workflows/queries'
import type { ItemStatus } from '@/lib/contract'

// -- Stat tile ------------------------------------------------
function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      <div className="stat__sub">{sub}</div>
    </div>
  )
}

// -- Queue table ----------------------------------------------
function QueueTable({
  workflow,
  items,
  selected,
  onToggleOne,
  onToggleAll,
  onOpen,
  activeId,
}: {
  workflow: Workflow
  items: Item[]
  selected: Set<string>
  onToggleOne: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onOpen: (id: string) => void
  activeId: string | null
}) {
  const allChecked = items.length > 0 && items.every((i) => selected.has(i.id))
  const someChecked = items.some((i) => selected.has(i.id))
  const headRef = useRef<HTMLInputElement>(null)
  const tableCols = workflow.itemSchema.filter((f) => f.showInTable)

  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someChecked && !allChecked
  }, [someChecked, allChecked])

  return (
    <div className="qtable-wrap">
      <table className="qtable">
        <thead>
          <tr>
            <th className="check">
              <input
                ref={headRef}
                className="cb"
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th>ID</th>
            <th>STATUS</th>
            <th>PRIORITY</th>
            {tableCols.map((f) => (
              <th key={f.key} className={tdClass(f)}>
                {f.label.toUpperCase()}
              </th>
            ))}
            <th className="num">SUBMITTED</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const isSel = selected.has(it.id)
            const isAct = it.id === activeId
            return (
              <tr
                key={it.id}
                className={(isSel ? 'selected ' : '') + (isAct ? 'active' : '')}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (target.classList?.contains('cb')) return
                  onOpen(it.id)
                }}
              >
                <td className="check" onClick={(e) => e.stopPropagation()}>
                  <input
                    className="cb"
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggleOne(it.id)}
                  />
                </td>
                <td className="mono accent">{it.id}</td>
                <td><StatusCell s={it.status} /></td>
                <td><PrioCell p={it.priority} /></td>
                {tableCols.map((f) => (
                  <td key={f.key} className={tdClass(f)}>
                    {renderCell(f, it.fields[f.key])}
                  </td>
                ))}
                <td className="num muted">{fmtRelative(it.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// -- Queue cards ----------------------------------------------
function QueueCards({
  workflow,
  items,
  onOpen,
  activeId,
  onQuickAction,
}: {
  workflow: Workflow
  items: Item[]
  onOpen: (id: string) => void
  activeId: string | null
  onQuickAction: (id: string, actionId: string) => void
}) {
  const titleField = workflow.itemSchema.find((f) => f.type === 'text')
  const cardFields = workflow.itemSchema.filter(
    (f) => f.showInCard && f.key !== titleField?.key,
  )

  return (
    <div className="cards">
      {items.map((it) => {
        const cardTitle = titleField
          ? String(it.fields[titleField.key] ?? it.summary)
          : it.summary
        const singles = singleActions(workflow, it)
        const primary = singles.find((a) => a.intent === 'primary')
        const destructive = singles.find((a) => a.intent === 'destructive')

        return (
          <div
            key={it.id}
            className={'card-item card-item--' + it.priority + (it.id === activeId ? ' active' : '')}
            onClick={() => onOpen(it.id)}
          >
            <div className="card-item__head">
              <div>
                <div className="card-item__id">{it.id}</div>
                <div className="card-item__title">{cardTitle}</div>
              </div>
              <PrioCell p={it.priority} />
            </div>
            <div className="card-item__summary">{it.summary}</div>
            <div className="card-item__meta">
              {cardFields.map((f) => (
                <span key={f.key}>
                  {f.label.toUpperCase()} · <b>{renderCell(f, it.fields[f.key])}</b>
                </span>
              ))}
              <span>{fmtRelative(it.createdAt)} AGO</span>
            </div>
            <div className="card-item__actions" onClick={(e) => e.stopPropagation()}>
              {primary && (
                <Button variant="brass" onClick={() => onQuickAction(it.id, primary.id)}>
                  {primary.label}
                </Button>
              )}
              <Button onClick={() => onOpen(it.id)}>Review</Button>
              {destructive && (
                <Button variant="danger" onClick={() => onQuickAction(it.id, destructive.id)}>
                  {destructive.label}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// -- Dashboard client root ------------------------------------
export function DashboardClient({
  navWorkflows,
  workflow: initialWorkflow,
}: {
  navWorkflows: NavWorkflow[]
  workflow: Workflow
}) {
  const router = useRouter()
  const workflow = initialWorkflow
  const workflowIndex = navWorkflows.findIndex((w) => w.id === workflow.id) + 1

  const [items, setItems] = useState<Item[]>(workflow.items)
  const [view, setView] = useState<'table' | 'cards'>(workflow.defaultView)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Sync items when workflow prop changes (navigation between workflows)
  useEffect(() => {
    setItems(initialWorkflow.items)
    setView(initialWorkflow.defaultView)
    setSelected(new Set())
    setOpenId(null)
    setQuery('')
  }, [initialWorkflow])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (!q) return true
      if (i.id.toLowerCase().includes(q)) return true
      if (i.summary.toLowerCase().includes(q)) return true
      return Object.values(i.fields).some((v) =>
        String(v ?? '').toLowerCase().includes(q),
      )
    })
  }, [items, query])

  const openItem = items.find((i) => i.id === openId) ?? null

  const toggleOne = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!checked) return setSelected(new Set())
      setSelected(new Set(visible.map((i) => i.id)))
    },
    [visible],
  )

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const applyToOne = useCallback(
    (id: string, actionId: string) => {
      const item = items.find((i) => i.id === id)
      if (!item) return
      const action = resolveItemActions(workflow, item).find((a) => a.id === actionId)
      if (action?.resultingStatus) {
        const status = action.resultingStatus as ItemStatus
        setItems((arr) => arr.map((i) => (i.id === id ? { ...i, status } : i)))
        recordDecision(id, actionId, workflow.id).then(() => router.refresh())
      }
    },
    [items, workflow, router],
  )

  const applyToSelected = useCallback(
    (actionId: string) => {
      const action = workflow.availableActions.find((a) => a.id === actionId)
      if (action?.resultingStatus) {
        const status = action.resultingStatus as ItemStatus
        const ids = Array.from(selected)
        setItems((arr) =>
          arr.map((i) => (selected.has(i.id) ? { ...i, status } : i)),
        )
        recordDecisions(ids, actionId, workflow.id).then(() => router.refresh())
      }
      clearSelection()
    },
    [selected, workflow, clearSelection, router],
  )

  const handleAction = useCallback(
    (id: string, actionId: string) => {
      applyToOne(id, actionId)
      setOpenId(null)
    },
    [applyToOne],
  )

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') { setOpenId(null); return }
      if (openId) {
        const item = items.find((i) => i.id === openId)
        if (!item) return
        for (const a of singleActions(workflow, item)) {
          if (a.hotkey && e.key.toUpperCase() === a.hotkey) {
            e.preventDefault()
            handleAction(openId, a.id)
            return
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, items, workflow, handleAction])

  const liveStats = useMemo(() => {
    const pendingCount = items.filter((i) => i.status === 'pending').length
    return workflow.stats.map((s) => ({
      label: s.label,
      value: s.emphasized ? String(pendingCount) : String(s.value),
      sub: s.trend ?? s.unit ?? '',
    }))
  }, [items, workflow.stats])

  const bulk = bulkActions(workflow)

  return (
    <div className="app">
      <Nav workflowId={workflow.id} workflows={navWorkflows} />
      <main className="main">
        <Topbar
          crumbs={['workflows', workflow.name]}
          right={<>
            <Button onClick={() => router.push('/dashboard')}>Dashboard</Button>
            <Button onClick={() => router.push('/data')}>Data</Button>
            <Button onClick={() => router.push(`/config?workflow=${workflow.id}`)}>Edit</Button>
            <Button variant="brass">▶ Run now</Button>
          </>}
        />

        <div className="page">
          {/* header */}
          <div>
            <div className="page-header__eyebrow">
              WORKFLOW // {String(workflowIndex).padStart(2, '0')}
            </div>
            <div className="page-header__title-row">
              <h1 className="page-header__title">{workflow.name}</h1>
              <span className="status">
                {workflow.status === 'running' && <span className="dot"></span>}
                {workflow.status.toUpperCase()}
              </span>
            </div>
            <p className="page-header__desc">{workflow.description}</p>
          </div>

          {/* stats */}
          <div className="stats">
            {liveStats.map((s) => <StatTile key={s.label} {...s} />)}
          </div>

          {/* toolbar */}
          <div>
            <div className="toolbar">
              <div className="toolbar__left">
                <span className="toolbar__title">REVIEW QUEUE // LAST 7D</span>
              </div>
              <div className="toolbar__right">
                <div className="search">
                  <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>⌕</span>
                  <input
                    type="text"
                    placeholder="filter id, subject, sender…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <kbd>/</kbd>
                </div>
                <div className="seg">
                  <button
                    className={'seg__btn ' + (view === 'table' ? 'seg__btn--active' : '')}
                    onClick={() => setView('table')}
                  >Table</button>
                  <button
                    className={'seg__btn ' + (view === 'cards' ? 'seg__btn--active' : '')}
                    onClick={() => { setView('cards'); clearSelection() }}
                  >Cards</button>
                </div>
              </div>
            </div>

            {view === 'table' && selected.size > 0 && (
              <div className="bulkbar" style={{ marginTop: 12 }}>
                <div className="bulkbar__count">
                  <span className="num">{selected.size}</span> selected
                  <span style={{ color: 'var(--fg-muted)', marginLeft: 12 }}>· bulk actions apply to all</span>
                </div>
                <div className="bulkbar__actions">
                  <Button onClick={clearSelection}>Clear</Button>
                  {bulk.map((a) => (
                    <Button
                      key={a.id}
                      variant={intentToVariant[a.intent]}
                      onClick={() => applyToSelected(a.id)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* list */}
          <div style={{ marginTop: -8 }}>
            {view === 'table' ? (
              <QueueTable
                workflow={workflow}
                items={visible}
                selected={selected}
                onToggleOne={toggleOne}
                onToggleAll={toggleAll}
                onOpen={setOpenId}
                activeId={openId}
              />
            ) : (
              <QueueCards
                workflow={workflow}
                items={visible}
                onOpen={setOpenId}
                activeId={openId}
                onQuickAction={applyToOne}
              />
            )}
            {visible.length === 0 && (
              <div className="empty">no items match the current filter.</div>
            )}
          </div>
        </div>

        {/* flyout */}
        <DetailFlyout
          workflow={workflow}
          item={openItem}
          onClose={() => setOpenId(null)}
          onAction={handleAction}
        />
      </main>
    </div>
  )
}
