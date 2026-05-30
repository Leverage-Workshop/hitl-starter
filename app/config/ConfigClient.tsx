'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { intentToVariant, type Workflow } from '@/lib/contract'
import { Button } from '@/components/ui/Button'
import { Nav } from '@/components/ui/Nav'
import { Topbar } from '@/components/ui/Topbar'
import type { NavWorkflow } from '@/lib/workflows/queries'

export function ConfigClient({
  navWorkflows,
  workflow,
}: {
  navWorkflows: NavWorkflow[]
  workflow: Workflow
}) {
  const router = useRouter()
  const [name, setName] = useState(workflow.name)
  const [schedule, setSchedule] = useState('on-receipt · max 5/min')
  const [confFloor, setConfFloor] = useState(
    workflow.confidenceFloor != null ? Math.round(workflow.confidenceFloor * 100) : 80,
  )

  const dashUrl = `/dashboard?workflow=${workflow.id}`

  return (
    <div className="app">
      <Nav workflowId={workflow.id} workflows={navWorkflows} />
      <main className="main">
        <Topbar
          crumbs={['workflows', workflow.name, 'config']}
          right={<>
            <Button onClick={() => router.push(dashUrl)}>Cancel</Button>
            <Button variant="brass">Save changes</Button>
          </>}
        />

        <div className="page" data-screen-label="03 Config">
          <div>
            <div className="page-header__eyebrow">CONFIG // 01</div>
            <div className="page-header__title-row">
              <h1 className="page-header__title">Workflow configuration</h1>
            </div>
            <p className="page-header__desc">
              How <span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{workflow.name}</span> runs:
              what triggers it, what it decides on its own, what it routes to a human, and what the human sees
              on the flyout. Changes apply on next run.
            </p>
          </div>

          <dl className="deflist">
            <div className="deflist-section">Workflow</div>

            <dt>Name</dt>
            <dd>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </dd>

            <dt>Description</dt>
            <dd>
              <div className="desc">Shown on the dashboard header. One sentence; what the workflow does, in plain English.</div>
              <textarea defaultValue={workflow.description} />
            </dd>

            <dt>Owner</dt>
            <dd><span className="mono">j.grant</span> — operator</dd>

            <div className="deflist-section">Trigger</div>

            <dt>Source</dt>
            <dd>
              <select defaultValue="email">
                <option value="email">Inbound email</option>
                <option value="webhook">HTTP webhook</option>
                <option value="cron">Schedule (cron)</option>
                <option value="manual">Manual run only</option>
              </select>
              {workflow.sources[0] && (
                <div className="desc" style={{ marginTop: 8 }}>Routed via: <span className="mono">{workflow.sources[0].kind} · {workflow.sources[0].label}</span></div>
              )}
            </dd>

            <dt>Cadence</dt>
            <dd>
              <input type="text" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
              <div className="desc" style={{ marginTop: 4 }}>Status: <span className="mono">{workflow.status}</span></div>
            </dd>

            <div className="deflist-section">Decision criteria</div>

            <dt>Confidence floor</dt>
            <dd>
              <div className="desc">Below this confidence, items are routed to a human. Above it, items can auto-send if &ldquo;auto-decide&rdquo; is on.</div>
              <input
                type="text"
                value={confFloor}
                onChange={(e) => setConfFloor(Number(e.target.value))}
                style={{ width: 80 }}
              />
              <span style={{ marginLeft: 8, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>%</span>
            </dd>

            <dt>Auto-decide</dt>
            <dd>
              <select defaultValue="off">
                <option value="off">Off — every item routed to human</option>
                <option value="auto-approve">Auto-approve above floor</option>
                <option value="auto-route">Auto-route to category queues</option>
              </select>
            </dd>

            <dt>Flag rules</dt>
            <dd>
              <div className="desc">Items matching any of these rules are flagged for review regardless of confidence.</div>
              <textarea defaultValue={`expansion_ratio  >= 1.75\nhipaa_in_subject == true\nattachment_fetch_failed == true\nsender_domain in [internal_domains]`} />
            </dd>

            <div className="deflist-section">Notifications</div>

            <dt>On flag</dt>
            <dd>
              <select defaultValue="slack-ops">
                <option value="email-owner">Email owner</option>
                <option value="slack-ops">Slack · #ops</option>
                <option value="none">None</option>
              </select>
            </dd>

            <dt>Daily digest</dt>
            <dd>
              <select defaultValue="09:00">
                <option value="off">Off</option>
                <option value="09:00">09:00 local</option>
                <option value="17:00">17:00 local</option>
              </select>
            </dd>

            <dt>SLA breach</dt>
            <dd>
              <div className="desc">When an item sits in the queue longer than the SLA, page the owner.</div>
              <input type="text" defaultValue="4 hours" style={{ width: 160 }} />
            </dd>

            <div className="deflist-section">Action configuration</div>

            <dt>Decision actions</dt>
            <dd>
              <div className="desc">These are the buttons shown in the detail flyout for this workflow. Reorder, rename, or remove to fit the decision set this queue needs.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 }}>
                {workflow.availableActions.map((a, i) => {
                  const variant = intentToVariant[a.intent]
                  return (
                    <div key={a.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 100px 30px',
                      gap: 8,
                      alignItems: 'center',
                      padding: '8px 10px',
                      border: '1px solid var(--rule)',
                      borderRadius: 2,
                      background: 'var(--bg-elevated)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}>
                      <span style={{ color: 'var(--fg-muted)' }}>{i + 1}</span>
                      <span>{a.label}</span>
                      <span style={{
                        color: variant === 'brass' ? 'var(--fg-accent)' : variant === 'danger' ? 'var(--c-oxide)' : 'var(--fg-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: 'var(--ls-wide)',
                        fontSize: 10.5,
                      }}>{variant}</span>
                      <span style={{ color: 'var(--fg-muted)' }}>[{a.hotkey ?? '—'}]</span>
                    </div>
                  )
                })}
                <Button style={{ alignSelf: 'flex-start', marginTop: 4 }}>+ Add action</Button>
              </div>
            </dd>

            <dt>Default view</dt>
            <dd>
              <select defaultValue={workflow.defaultView}>
                <option value="table">Table — batch / bulk-action workflows</option>
                <option value="cards">Cards — per-item judgment workflows</option>
              </select>
              <div className="desc" style={{ marginTop: 4 }}>The dashboard opens in this view by default. Operators can toggle.</div>
            </dd>
          </dl>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
            <Button onClick={() => router.push(dashUrl)}>Cancel</Button>
            <Button variant="brass">Save changes</Button>
          </div>
        </div>
      </main>
    </div>
  )
}
