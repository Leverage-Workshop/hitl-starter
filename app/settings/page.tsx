import { getWorkflowList } from '@/lib/workflows/queries'
import { SettingsClient } from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const navWorkflows = await getWorkflowList()
  return <SettingsClient navWorkflows={navWorkflows} />
}
