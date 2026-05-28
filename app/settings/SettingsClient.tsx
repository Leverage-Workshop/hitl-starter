'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ACTIVE_WORKFLOW_ID } from '@/lib/data'
import { Button } from '@/components/ui/Button'
import { Nav } from '@/components/ui/Nav'
import { Topbar } from '@/components/ui/Topbar'
import type { NavWorkflow } from '@/lib/workflows/queries'

export function SettingsClient({ navWorkflows }: { navWorkflows: NavWorkflow[] }) {
  const router = useRouter()
  const [name, setName] = useState('Jules Grant')
  const [email, setEmail] = useState('j.grant@halberd-co.com')

  const signOut = () => {
    document.cookie = 'hitl_authed=; path=/; max-age=0'
    router.push('/')
  }

  return (
    <div className="app">
      <Nav workflowId={ACTIVE_WORKFLOW_ID} workflows={navWorkflows} />
      <main className="main">
        <Topbar
          crumbs={['settings', 'account']}
          right={<>
            <Button onClick={signOut} variant="danger">Sign out</Button>
            <Button variant="brass">Save changes</Button>
          </>}
        />

        <div className="page" data-screen-label="04 Settings">
          <div>
            <div className="page-header__eyebrow">SETTINGS // ACCOUNT</div>
            <div className="page-header__title-row">
              <h1 className="page-header__title">Account settings</h1>
            </div>
            <p className="page-header__desc">
              Your profile, how you get pinged, and the credentials this console uses to talk to other systems.
            </p>
          </div>

          <dl className="deflist">
            <div className="deflist-section">Profile</div>

            <dt>Name</dt>
            <dd><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></dd>

            <dt>Email</dt>
            <dd><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></dd>

            <dt>Role</dt>
            <dd><span className="mono">operator</span> — full read/write on owned workflows</dd>

            <div className="deflist-section">Notifications</div>

            <dt>New flagged item</dt>
            <dd>
              <select defaultValue="immediate">
                <option value="immediate">Immediate · Slack + email</option>
                <option value="email">Email only</option>
                <option value="digest">Roll into daily digest</option>
                <option value="off">Off</option>
              </select>
            </dd>

            <dt>SLA breach</dt>
            <dd>
              <select defaultValue="page">
                <option value="page">Page me</option>
                <option value="slack">Slack only</option>
                <option value="off">Off</option>
              </select>
            </dd>

            <dt>Weekly digest</dt>
            <dd>
              <select defaultValue="mon-08">
                <option value="off">Off</option>
                <option value="mon-08">Mon · 08:00</option>
                <option value="fri-17">Fri · 17:00</option>
              </select>
              <div className="desc" style={{ marginTop: 4 }}>One email per week with throughput and decision counts.</div>
            </dd>

            <div className="deflist-section">Appearance</div>

            <dt>Theme</dt>
            <dd>
              <select defaultValue="federal">
                <option value="federal">Federal (dark) — default</option>
                <option value="paper">Paper (light) — for deliverables only</option>
              </select>
            </dd>

            <dt>Density</dt>
            <dd>
              <select defaultValue="dense">
                <option value="dense">Dense — codex page rhythm</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </dd>

            <div className="deflist-section">API keys & tokens</div>

            <dt>Console API key</dt>
            <dd>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="mono" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--rule)', padding: '6px 10px', borderRadius: 2, fontSize: 12 }}>
                  lw_pk_••••••••••••e3a2
                </span>
                <Button>Copy</Button>
                <Button variant="danger">Rotate</Button>
              </div>
              <div className="desc" style={{ marginTop: 6 }}>Last used 4 minutes ago from 198.51.100.42.</div>
            </dd>

            <dt>Slack workspace</dt>
            <dd>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="mono">halberd-co.slack.com</span>
                <Button>Reconnect</Button>
              </div>
            </dd>

            <dt>CRM connection</dt>
            <dd>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="mono">salesforce · prod</span>
                <Button>Reconnect</Button>
                <Button variant="danger">Disconnect</Button>
              </div>
            </dd>

            <div className="deflist-section">Session</div>

            <dt>Sign out</dt>
            <dd>
              <div className="desc">Ends this session on this device. Other sessions persist.</div>
              <Button variant="danger" onClick={signOut}>Sign out</Button>
            </dd>
          </dl>
        </div>
      </main>
    </div>
  )
}
