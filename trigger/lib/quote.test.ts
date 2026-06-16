import { describe, it, expect } from 'vitest'

import type { RateInsightsEstimate, WorkflowItemOut } from './data-api'
import { RfqSchema, type RfqPayload } from './rfq'
import {
  CONFIDENCE_FLOOR,
  buildDraftPrompt,
  decideQuote,
  estimateTransitDays,
  isPickupSoon,
  parseFromAddress,
  quoteItemId,
  quoteReplyFromItem,
  rfqToRateRequest,
  roundRate,
  toQuoteItem,
} from './quote'

/* ------------------------------------------------------------------ */
/* Fixtures                                                             */
/* ------------------------------------------------------------------ */

function samplePayload(overrides: Partial<RfqPayload> = {}): RfqPayload {
  return {
    messageId: 'm-100',
    threadId: 't-100',
    from: 'logistics@valleypack.com',
    subject: 'Need a reefer Thu — Fresno to Dallas',
    receivedAt: '2026-06-01T12:00:00.000Z',
    lane: 'Fresno, CA → Dallas, TX',
    rfq: RfqSchema.parse({
      origin: { city: 'Fresno', state: 'ca', zip: '93706' },
      destination: { city: 'Dallas', state: 'TX', zip: null },
      equipmentCode: 'R',
      equipmentText: 'reefer',
      pickupDate: '2026-06-04',
      weightLbs: 42000,
      commodity: 'produce',
      accessorials: [],
      notes: null,
    }),
    ...overrides,
  }
}

function sampleEstimate(overrides: Partial<RateInsightsEstimate> = {}): RateInsightsEstimate {
  return {
    origin_city: 'Fresno',
    origin_state_code: 'CA',
    destination_city: 'Dallas',
    destination_state_code: 'TX',
    equipment_code: 'R',
    pickup_date: '2026-06-04',
    mileage: 1550,
    low_rate_per_mile: 1.6,
    avg_rate_per_mile: 1.8,
    high_rate_per_mile: 2.0,
    fuel_surcharge_per_mile: 0.32,
    total_low: 2728,
    total_avg: 2852,
    total_high: 3038,
    rate_source: 'truckstop',
    match_tier: 'lane_snapshots',
    comparable_count: 5,
    confidence_score: 0.85,
    confidence_level: 'high',
    as_of: '2026-05-29T16:02:00+00:00',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/* rfqToRateRequest                                                    */
/* ------------------------------------------------------------------ */

describe('rfqToRateRequest', () => {
  it('maps the RFQ lane + equipment and upper-cases states', () => {
    expect(rfqToRateRequest(samplePayload())).toEqual({
      origin_city: 'Fresno',
      origin_state_code: 'CA',
      destination_city: 'Dallas',
      destination_state_code: 'TX',
      equipment_code: 'R',
      origin_zip_code: '93706',
      destination_zip_code: null,
      pickup_date: '2026-06-04',
    })
  })
})

/* ------------------------------------------------------------------ */
/* Pricing helpers                                                     */
/* ------------------------------------------------------------------ */

describe('roundRate', () => {
  it('rounds to the nearest $25', () => {
    expect(roundRate(2852)).toBe(2850)
    expect(roundRate(2863)).toBe(2875)
  })
})

describe('estimateTransitDays', () => {
  it('derives days from mileage at ~500/day, floor 1', () => {
    expect(estimateTransitDays(1550)).toBe(4)
    expect(estimateTransitDays(200)).toBe(1)
  })
  it('returns null for unknown/zero mileage', () => {
    expect(estimateTransitDays(null)).toBeNull()
    expect(estimateTransitDays(0)).toBeNull()
  })
})

describe('isPickupSoon', () => {
  const now = new Date('2026-06-02T12:00:00Z')
  it('flags pickups within two days', () => {
    expect(isPickupSoon('2026-06-03', now)).toBe(true)
    expect(isPickupSoon('2026-06-04', now)).toBe(true)
  })
  it('does not flag distant or missing pickups', () => {
    expect(isPickupSoon('2026-06-10', now)).toBe(false)
    expect(isPickupSoon(null, now)).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* decideQuote                                                         */
/* ------------------------------------------------------------------ */

describe('decideQuote', () => {
  it('auto-passes a high-confidence lane with a number', () => {
    const d = decideQuote(sampleEstimate(), { pickupSoon: true })
    expect(d.score).toBe(85)
    expect(d.autoPassEligible).toBe(true)
    expect(d.suppressRate).toBe(false)
    expect(d.targetRate).toBe(2850)
    expect(d.transitDays).toBe(4)
    expect(d.priority).toBe('high')
    expect(d.holdReason).toBeNull()
  })

  it('holds (number shown) when a lane rate is below the floor', () => {
    const d = decideQuote(
      sampleEstimate({ match_tier: 'lane_aggregate', confidence_score: 0.62 }),
    )
    expect(d.autoPassEligible).toBe(false)
    expect(d.suppressRate).toBe(false)
    expect(d.targetRate).toBe(2850)
    expect(d.holdReason).toMatch(/below confidence floor/i)
  })

  it('suppresses the number for a thin/odd (loose) lane', () => {
    const d = decideQuote(
      sampleEstimate({ match_tier: 'loose_snapshots', confidence_score: 0.4 }),
    )
    expect(d.suppressRate).toBe(true)
    expect(d.targetRate).toBeNull()
    expect(d.autoPassEligible).toBe(false)
    expect(d.holdReason).toMatch(/no lane-specific/i)
  })

  it('suppresses the number when nothing matched', () => {
    const d = decideQuote(
      sampleEstimate({
        match_tier: 'none',
        comparable_count: 0,
        confidence_score: 0,
        total_avg: null,
      }),
    )
    expect(d.suppressRate).toBe(true)
    expect(d.targetRate).toBeNull()
  })

  it('uses the contract confidence floor', () => {
    expect(CONFIDENCE_FLOOR).toBe(0.75)
    const atFloor = decideQuote(sampleEstimate({ confidence_score: 0.75 }))
    expect(atFloor.autoPassEligible).toBe(true)
    const below = decideQuote(sampleEstimate({ confidence_score: 0.74 }))
    expect(below.autoPassEligible).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* buildDraftPrompt                                                    */
/* ------------------------------------------------------------------ */

describe('buildDraftPrompt', () => {
  it('embeds lane facts and quotes the target rate when present', () => {
    const estimate = sampleEstimate()
    const prompt = buildDraftPrompt(samplePayload(), estimate, decideQuote(estimate))
    expect(prompt).toContain('Fresno, CA → Dallas, TX')
    expect(prompt).toContain('Reefer')
    expect(prompt).toContain('$2,850')
    expect(prompt).toContain('book it')
  })

  it('instructs the model NOT to state a price when suppressed', () => {
    const estimate = sampleEstimate({ match_tier: 'none', total_avg: null, confidence_score: 0 })
    const prompt = buildDraftPrompt(samplePayload(), estimate, decideQuote(estimate))
    expect(prompt).toMatch(/do NOT state a price/i)
    expect(prompt).not.toContain('$2,850')
  })
})

/* ------------------------------------------------------------------ */
/* toQuoteItem                                                         */
/* ------------------------------------------------------------------ */

describe('toQuoteItem', () => {
  const draft = { subject: 'Re: Need a reefer Thu — Fresno to Dallas', body: 'Hi T. — all-in $2,850…' }

  it('maps a confident quote onto a workflow_item create payload', () => {
    const payload = samplePayload()
    const estimate = sampleEstimate()
    const decision = decideQuote(estimate, { pickupSoon: true })
    const item = toQuoteItem({ payload, estimate, decision, draft })

    expect(item.id).toBe('qd-m-100')
    expect(item.workflow_id).toBe('quote-desk')
    expect(item.priority).toBe('high')
    expect(item.status).toBe('pending')
    expect(item.proposed_output).toBe(draft.body)
    expect(item.fields).toMatchObject({
      lane: 'Fresno, CA → Dallas, TX',
      equipment: 'Reefer',
      pickup: '2026-06-04',
      rate: 2850,
      score: 85,
      // provenance for the send task
      rfqMessageId: 'm-100',
      rfqThreadId: 't-100',
      shipperEmail: 'logistics@valleypack.com',
      draftSubject: draft.subject,
    })
    expect(item.source_content).toContain('Comparable-lane evidence')
    expect(item.context?.[0]).toMatchObject({ ref: '[a]' })
    expect(item.created_at).toBe('2026-06-01T12:00:00.000Z')
  })

  it('nulls the rate and adds a hold note when suppressed', () => {
    const payload = samplePayload()
    const estimate = sampleEstimate({ match_tier: 'none', total_avg: null, confidence_score: 0, comparable_count: 0 })
    const decision = decideQuote(estimate)
    const item = toQuoteItem({ payload, estimate, decision, draft })

    expect(item.fields?.rate).toBeNull()
    expect(item.summary).toMatch(/broker to price/i)
    expect(item.context?.some((c) => c.ref === '[b]')).toBe(true)
  })

  it('is idempotent on the source message id', () => {
    const a = quoteItemId('abc')
    expect(a).toBe('qd-abc')
  })
})

/* ------------------------------------------------------------------ */
/* Send-on-approval reply                                              */
/* ------------------------------------------------------------------ */

describe('parseFromAddress', () => {
  it('extracts the address from a "Name <addr>" header', () => {
    expect(parseFromAddress('T. Okafor <logistics@valleypack.com>')).toBe('logistics@valleypack.com')
  })
  it('passes a bare address through', () => {
    expect(parseFromAddress('logistics@valleypack.com')).toBe('logistics@valleypack.com')
  })
})

describe('quoteReplyFromItem', () => {
  function itemOut(fields: Record<string, unknown>, proposed: string | null): WorkflowItemOut {
    return {
      id: 'qd-m-100',
      workflow_id: 'quote-desk',
      status: 'approved',
      priority: 'high',
      summary: 's',
      fields,
      source_content: null,
      proposed_output: proposed,
      context: [],
      actions: null,
      decided_at: null,
      decided_by: null,
      created_at: '2026-06-01T12:00:00.000Z',
      updated_at: '2026-06-01T12:00:00.000Z',
    }
  }

  it('rebuilds the threaded reply from item provenance + draft body', () => {
    const reply = quoteReplyFromItem(
      itemOut(
        {
          shipperEmail: 'T. Okafor <logistics@valleypack.com>',
          rfqThreadId: 't-100',
          rfqSubject: 'Need a reefer Thu',
          draftSubject: 'Re: Need a reefer Thu',
        },
        'all-in $2,850',
      ),
      { from: 'quotes@halberd-co.com' },
    )
    expect(reply.to).toBe('logistics@valleypack.com')
    expect(reply.from).toBe('quotes@halberd-co.com')
    expect(reply.subject).toBe('Re: Need a reefer Thu')
    expect(reply.threadId).toBe('t-100')
    expect(reply.body).toBe('all-in $2,850')
  })

  it('falls back to a generic subject and default sender', () => {
    const reply = quoteReplyFromItem(itemOut({ shipperEmail: 'a@b.com' }, 'body'))
    expect(reply.subject).toBe('Re: your freight quote request')
    expect(reply.from).toBe('quotes@halberd-co.com')
    expect(reply.threadId).toBeNull()
  })
})
