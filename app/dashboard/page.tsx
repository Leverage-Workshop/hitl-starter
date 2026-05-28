import { getWorkflow, getWorkflowList } from '@/lib/workflows/queries'
import { ACTIVE_WORKFLOW_ID } from '@/lib/data'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workflow?: string }>
}) {
  const params = await searchParams
  const navWorkflows = await getWorkflowList()
  const id = params.workflow ?? navWorkflows[0]?.id ?? ACTIVE_WORKFLOW_ID
  const workflow = await getWorkflow(id)

  if (!workflow) {
    return <div className="empty">workflow not found.</div>
  }

  return <DashboardClient navWorkflows={navWorkflows} workflow={workflow} />
}
