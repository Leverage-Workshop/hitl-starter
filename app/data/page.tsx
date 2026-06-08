import { getEntityRows } from '@/lib/data/queries'
import type { EntityKey } from '@/lib/data/queries'
import { DataClient } from './DataClient'

export const dynamic = 'force-dynamic'

const VALID_ENTITIES: EntityKey[] = ['shippers', 'carriers', 'lanes', 'loads', 'rateSnapshots']

function isEntityKey(value: string): value is EntityKey {
  return VALID_ENTITIES.includes(value as EntityKey)
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>
}) {
  const params = await searchParams
  const entity: EntityKey =
    params.entity && isEntityKey(params.entity) ? params.entity : 'shippers'
  const rows = await getEntityRows(entity)

  return <DataClient entityKey={entity} rows={rows} />
}
