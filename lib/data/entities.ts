import type { FieldDef } from '@/lib/contract'
import type { EntityKey } from '@/lib/data/queries'

export interface EntityConfig {
  key: EntityKey
  label: string
  titleKey: string
  columns: FieldDef[]
}

export const ENTITY_CONFIGS: EntityConfig[] = [
  {
    key: 'shippers',
    label: 'Shippers',
    titleKey: 'companyName',
    columns: [
      { key: 'companyName', label: 'Company', type: 'text', showInTable: true, showInCard: false },
      { key: 'doingBusinessAs', label: 'DBA', type: 'text', showInTable: true, showInCard: false },
      { key: 'city', label: 'City', type: 'text', showInTable: true, showInCard: true },
      { key: 'stateCode', label: 'State', type: 'text', showInTable: true, showInCard: false },
      { key: 'status', label: 'Status', type: 'badge', showInTable: true, showInCard: true },
      { key: 'creditTermsDays', label: 'Credit Terms', type: 'count', showInTable: true, showInCard: false },
      { key: 'lifetimeLoadCount', label: 'Lifetime Loads', type: 'count', showInTable: true, showInCard: true },
      { key: 'lastLoadDate', label: 'Last Load', type: 'datetime', showInTable: true, showInCard: false },
    ],
  },
  {
    key: 'carriers',
    label: 'Carriers',
    titleKey: 'companyName',
    columns: [
      { key: 'companyName', label: 'Company', type: 'text', showInTable: true, showInCard: false },
      { key: 'dotNumber', label: 'DOT #', type: 'text', showInTable: true, showInCard: false },
      { key: 'city', label: 'City', type: 'text', showInTable: true, showInCard: true },
      { key: 'stateCode', label: 'State', type: 'text', showInTable: true, showInCard: false },
      { key: 'authorityStatus', label: 'Authority', type: 'badge', showInTable: true, showInCard: true },
      { key: 'safetyRating', label: 'Safety', type: 'badge', showInTable: true, showInCard: false },
      { key: 'tier', label: 'Tier', type: 'badge', showInTable: true, showInCard: true },
      { key: 'onTimeRate', label: 'On-Time', type: 'text', showInTable: true, showInCard: false },
      { key: 'loadsCompleted', label: 'Loads', type: 'count', showInTable: true, showInCard: true },
    ],
  },
  {
    key: 'lanes',
    label: 'Lanes',
    titleKey: 'origin',
    columns: [
      { key: 'origin', label: 'Origin', type: 'text', showInTable: true, showInCard: false },
      { key: 'destination', label: 'Destination', type: 'text', showInTable: true, showInCard: true },
      { key: 'equipmentCode', label: 'Equip', type: 'badge', showInTable: true, showInCard: true },
      { key: 'estimatedMiles', label: 'Miles', type: 'count', showInTable: true, showInCard: false },
      { key: 'avgCarrierRatePerMile', label: 'Carrier $/mi', type: 'money', showInTable: true, showInCard: false },
      { key: 'avgShipperRatePerMile', label: 'Shipper $/mi', type: 'money', showInTable: true, showInCard: false },
      { key: 'avgMarginPercent', label: 'Margin', type: 'text', showInTable: true, showInCard: true },
      { key: 'loadCount', label: 'Loads', type: 'count', showInTable: true, showInCard: true },
    ],
  },
  {
    key: 'loads',
    label: 'Loads',
    titleKey: 'loadNumber',
    columns: [
      { key: 'loadNumber', label: 'Load #', type: 'text', showInTable: true, showInCard: false },
      { key: 'origin', label: 'Origin', type: 'text', showInTable: true, showInCard: true },
      { key: 'destination', label: 'Destination', type: 'text', showInTable: true, showInCard: true },
      { key: 'equipmentCode', label: 'Equip', type: 'badge', showInTable: true, showInCard: false },
      { key: 'status', label: 'Status', type: 'badge', showInTable: true, showInCard: true },
      { key: 'shipperRate', label: 'Shipper $', type: 'money', showInTable: true, showInCard: false },
      { key: 'carrierRate', label: 'Carrier $', type: 'money', showInTable: true, showInCard: false },
      { key: 'grossMargin', label: 'Margin $', type: 'money', showInTable: true, showInCard: true },
      { key: 'pickupDate', label: 'Pickup', type: 'datetime', showInTable: true, showInCard: false },
    ],
  },
  {
    key: 'rateSnapshots',
    label: 'RateSnapshots',
    titleKey: 'corridor',
    columns: [
      { key: 'corridor', label: 'Corridor', type: 'text', showInTable: true, showInCard: false },
      { key: 'equipmentCode', label: 'Equip', type: 'badge', showInTable: true, showInCard: true },
      { key: 'rateSource', label: 'Source', type: 'badge', showInTable: true, showInCard: true },
      { key: 'rateType', label: 'Type', type: 'badge', showInTable: true, showInCard: false },
      { key: 'avgRatePerMile', label: 'Avg $/mi', type: 'money', showInTable: true, showInCard: true },
      { key: 'highRatePerMile', label: 'High $/mi', type: 'money', showInTable: true, showInCard: false },
      { key: 'lowRatePerMile', label: 'Low $/mi', type: 'money', showInTable: true, showInCard: false },
      { key: 'capturedAt', label: 'Captured', type: 'datetime', showInTable: true, showInCard: true },
    ],
  },
]

export const ENTITY_BY_KEY: Record<EntityKey, EntityConfig> = Object.fromEntries(
  ENTITY_CONFIGS.map((cfg) => [cfg.key, cfg]),
) as Record<EntityKey, EntityConfig>
