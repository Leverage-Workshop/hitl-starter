import { pgTable, uuid, text, char, integer, numeric, date, timestamp } from 'drizzle-orm/pg-core'

export const shippers = pgTable('shippers', {
  id: uuid('id').primaryKey(),
  companyName: text('company_name'),
  doingBusinessAs: text('doing_business_as'),
  city: text('city'),
  stateCode: char('state_code', { length: 2 }),
  status: text('status'),
  creditTermsDays: integer('credit_terms_days'),
  lifetimeLoadCount: integer('lifetime_load_count'),
  lastLoadDate: date('last_load_date'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const carriers = pgTable('carriers', {
  id: uuid('id').primaryKey(),
  companyName: text('company_name'),
  dotNumber: text('dot_number'),
  city: text('city'),
  stateCode: char('state_code', { length: 2 }),
  authorityStatus: text('authority_status'),
  safetyRating: text('safety_rating'),
  tier: text('tier'),
  onTimeRate: numeric('on_time_rate'),
  loadsCompleted: integer('loads_completed'),
  addedDate: timestamp('added_date', { withTimezone: true }),
})

export const lanes = pgTable('lanes', {
  id: uuid('id').primaryKey(),
  originCity: text('origin_city'),
  originStateCode: char('origin_state_code', { length: 2 }),
  destinationCity: text('destination_city'),
  destinationStateCode: char('destination_state_code', { length: 2 }),
  equipmentCode: text('equipment_code'),
  estimatedMiles: integer('estimated_miles'),
  avgCarrierRatePerMile: numeric('avg_carrier_rate_per_mile'),
  avgShipperRatePerMile: numeric('avg_shipper_rate_per_mile'),
  avgMarginPercent: numeric('avg_margin_percent'),
  loadCount: integer('load_count'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const loads = pgTable('loads', {
  id: uuid('id').primaryKey(),
  loadNumber: text('load_number'),
  originCity: text('origin_city'),
  originStateCode: char('origin_state_code', { length: 2 }),
  destinationCity: text('destination_city'),
  destinationStateCode: char('destination_state_code', { length: 2 }),
  equipmentCode: text('equipment_code'),
  status: text('status'),
  shipperRate: numeric('shipper_rate'),
  carrierRate: numeric('carrier_rate'),
  grossMargin: numeric('gross_margin'),
  pickupDate: date('pickup_date'),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

export const rateSnapshots = pgTable('rate_snapshots', {
  id: uuid('id').primaryKey(),
  originCity: text('origin_city'),
  originStateCode: char('origin_state_code', { length: 2 }),
  destinationCity: text('destination_city'),
  destinationStateCode: char('destination_state_code', { length: 2 }),
  equipmentCode: text('equipment_code'),
  rateSource: text('rate_source'),
  rateType: text('rate_type'),
  avgRatePerMile: numeric('avg_rate_per_mile'),
  highRatePerMile: numeric('high_rate_per_mile'),
  lowRatePerMile: numeric('low_rate_per_mile'),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
})
