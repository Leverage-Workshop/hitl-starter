import { asc, desc } from 'drizzle-orm'
import { db } from '@/db'
import { shippers, carriers, lanes, loads, rateSnapshots } from '@/db/domain'

function fmtPercent(value: string | null): string | null {
  if (value === null || value === undefined) return null
  return `${value}%`
}

function fmtDate(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

export async function getShippers(): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select()
    .from(shippers)
    .orderBy(asc(shippers.companyName))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    doingBusinessAs: r.doingBusinessAs,
    city: r.city,
    stateCode: r.stateCode,
    status: r.status,
    creditTermsDays: r.creditTermsDays,
    lifetimeLoadCount: r.lifetimeLoadCount,
    lastLoadDate: r.lastLoadDate,
  }))
}

export async function getCarriers(): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select()
    .from(carriers)
    .orderBy(asc(carriers.companyName))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    dotNumber: r.dotNumber,
    city: r.city,
    stateCode: r.stateCode,
    authorityStatus: r.authorityStatus,
    safetyRating: r.safetyRating,
    tier: r.tier,
    onTimeRate: fmtPercent(r.onTimeRate),
    loadsCompleted: r.loadsCompleted,
  }))
}

export async function getLanes(): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select()
    .from(lanes)
    .orderBy(desc(lanes.loadCount))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    origin: `${r.originCity}, ${r.originStateCode}`,
    destination: `${r.destinationCity}, ${r.destinationStateCode}`,
    equipmentCode: r.equipmentCode,
    estimatedMiles: r.estimatedMiles,
    avgCarrierRatePerMile: r.avgCarrierRatePerMile,
    avgShipperRatePerMile: r.avgShipperRatePerMile,
    avgMarginPercent: fmtPercent(r.avgMarginPercent),
    loadCount: r.loadCount,
  }))
}

export async function getLoads(): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select()
    .from(loads)
    .orderBy(desc(loads.createdAt))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    loadNumber: r.loadNumber,
    origin: `${r.originCity}, ${r.originStateCode}`,
    destination: `${r.destinationCity}, ${r.destinationStateCode}`,
    equipmentCode: r.equipmentCode,
    status: r.status,
    shipperRate: r.shipperRate,
    carrierRate: r.carrierRate,
    grossMargin: r.grossMargin,
    pickupDate: r.pickupDate,
  }))
}

export async function getRateSnapshots(): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select()
    .from(rateSnapshots)
    .orderBy(desc(rateSnapshots.capturedAt))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    corridor: `${r.originCity}, ${r.originStateCode} → ${r.destinationCity}, ${r.destinationStateCode}`,
    equipmentCode: r.equipmentCode,
    rateSource: r.rateSource,
    rateType: r.rateType,
    avgRatePerMile: r.avgRatePerMile,
    highRatePerMile: r.highRatePerMile,
    lowRatePerMile: r.lowRatePerMile,
    capturedAt: fmtDate(r.capturedAt),
  }))
}

export type EntityKey = 'shippers' | 'carriers' | 'lanes' | 'loads' | 'rateSnapshots'

export async function getEntityRows(entity: EntityKey): Promise<Record<string, unknown>[]> {
  switch (entity) {
    case 'shippers':
      return getShippers()
    case 'carriers':
      return getCarriers()
    case 'lanes':
      return getLanes()
    case 'loads':
      return getLoads()
    case 'rateSnapshots':
      return getRateSnapshots()
    default:
      return getShippers()
  }
}
