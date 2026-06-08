'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLIENT } from '@/lib/data'
import { renderCell, tdClass } from '@/lib/renderField'
import { Button } from '@/components/ui/Button'
import { BracketMark } from '@/components/ui/BracketMark'
import { Topbar } from '@/components/ui/Topbar'
import { ENTITY_CONFIGS, ENTITY_BY_KEY } from '@/lib/data/entities'
import type { EntityConfig } from '@/lib/data/entities'
import type { EntityKey } from '@/lib/data/queries'
import type { FieldDef } from '@/lib/contract'

// -- Entity rail -----------------------------------------------
function EntityRail({
  entityKey,
  onNavigate,
}: {
  entityKey: EntityKey
  onNavigate: (key: EntityKey) => void
}) {
  return (
    <aside className="nav">
      <div className="nav__brand">
        <BracketMark size={22} />
        <div className="nav__brand-mark">
          <span>{CLIENT.name}</span>
          <span className="nav__brand-slash">/</span>
          <span>Console</span>
        </div>
      </div>

      <div style={{ overflowY: 'auto' }}>
        <div className="nav__section" style={{ paddingBottom: 4 }}>
          <div className="nav__section-label">Entities</div>
        </div>
        <ul className="nav__list">
          {ENTITY_CONFIGS.map((cfg) => (
            <li
              key={cfg.key}
              className={'nav__item ' + (cfg.key === entityKey ? 'nav__item--active' : '')}
              onClick={() => onNavigate(cfg.key)}
            >
              <span className="nav__item-name">{cfg.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

// -- Data table ------------------------------------------------
function DataTable({
  config,
  rows,
}: {
  config: EntityConfig
  rows: Record<string, unknown>[]
}) {
  const cols = config.columns.filter((f: FieldDef) => f.showInTable)

  return (
    <div className="qtable-wrap">
      <table className="qtable">
        <thead>
          <tr>
            {cols.map((f) => (
              <th key={f.key} className={tdClass(f)}>
                {f.label.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)}>
              {cols.map((f) => (
                <td key={f.key} className={tdClass(f)}>
                  {renderCell(f, row[f.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// -- Data cards ------------------------------------------------
function DataCards({
  config,
  rows,
}: {
  config: EntityConfig
  rows: Record<string, unknown>[]
}) {
  const titleField = config.columns.find((f: FieldDef) => f.key === config.titleKey)
  const cardFields = config.columns.filter(
    (f: FieldDef) => f.showInCard && f.key !== config.titleKey,
  )

  return (
    <div className="cards">
      {rows.map((row) => (
        <div key={String(row.id)} className="card-item">
          <div className="card-item__head">
            <div>
              <div className="card-item__title">
                {String(row[config.titleKey] ?? '')}
              </div>
            </div>
          </div>
          <div className="card-item__meta">
            {cardFields.map((f) => (
              <span key={f.key}>
                {f.label.toUpperCase()} · <b>{renderCell(f, row[f.key])}</b>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// -- DataClient root -------------------------------------------
interface DataClientProps {
  entityKey: EntityKey
  rows: Record<string, unknown>[]
  className?: string
}

export function DataClient({ entityKey, rows }: DataClientProps) {
  const router = useRouter()
  const config = ENTITY_BY_KEY[entityKey]

  const [view, setView] = useState<'table' | 'cards'>('table')
  const [query, setQuery] = useState('')

  useEffect(() => {
    setView('table')
    setQuery('')
  }, [entityKey, rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [rows, query])

  return (
    <div className="app">
      <EntityRail
        entityKey={entityKey}
        onNavigate={(key) => router.push('/data?entity=' + key)}
      />
      <main className="main">
        <Topbar
          crumbs={['data', config.label]}
          right={
            <>
              <Button onClick={() => router.push('/dashboard')}>Dashboard</Button>
              <Button onClick={() => router.push('/data')}>Data</Button>
              <Button>Edit</Button>
              <Button variant="brass">▶ Run now</Button>
            </>
          }
        />

        <div className="page">
          {/* header */}
          <div>
            <div className="page-header__eyebrow">DATA</div>
            <h1 className="page-header__title">{config.label}</h1>
            <p className="page-header__desc">{visible.length} records</p>
          </div>

          {/* toolbar */}
          <div>
            <div className="toolbar">
              <div className="toolbar__left">
                <span className="toolbar__title">{config.label.toUpperCase()} // ALL</span>
              </div>
              <div className="toolbar__right">
                <div className="search">
                  <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>⌕</span>
                  <input
                    type="text"
                    placeholder="filter…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <kbd>/</kbd>
                </div>
                <div className="seg">
                  <button
                    className={'seg__btn ' + (view === 'table' ? 'seg__btn--active' : '')}
                    onClick={() => setView('table')}
                  >
                    Table
                  </button>
                  <button
                    className={'seg__btn ' + (view === 'cards' ? 'seg__btn--active' : '')}
                    onClick={() => setView('cards')}
                  >
                    Cards
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* list */}
          <div style={{ marginTop: -8 }}>
            {visible.length === 0 ? (
              <div className="empty">no records.</div>
            ) : view === 'table' ? (
              <DataTable config={config} rows={visible} />
            ) : (
              <DataCards config={config} rows={visible} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
