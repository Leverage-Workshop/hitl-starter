export type ItemStatus   = 'pending' | 'approved' | 'rejected' | 'escalated'
export type ItemPriority = 'high' | 'normal' | 'flagged'

export interface Note {
  tag: string
  ts: string
  body: string
}

export interface WorkflowItem {
  id: string
  status: ItemStatus
  priority: ItemPriority
  submitted: string        // ISO timestamp
  subject: string
  from: string
  value: number
  score: number            // 0–100 confidence
  attachments: number
  summary: string
  source: string
  draft: string
  notes: Note[]
}

export interface Workflow {
  id: string
  name: string
  pending: number
  status: 'running' | 'idle' | 'off'
  cadence: string
}

export interface ActionItem {
  key: string
  label: string
  variant: 'brass' | 'ghost' | 'danger'
  hotkey?: string
}

export interface Stat {
  label: string
  value: string
  sub: string
}

export interface ClientIdentity {
  name: string
  slug: string
}
