import { describe, it, expect } from 'vitest'

import {
  EQUIPMENT_CODES,
  RfqSchema,
  buildExtractionPrompt,
  formatLane,
  normalizeEquipment,
  parseWeight,
  reconcileEquipment,
  toRfqPayload,
  type Rfq,
} from './rfq'

describe('normalizeEquipment', () => {
  it('maps common dry-van wording to V', () => {
    expect(normalizeEquipment('dry van')).toBe('V')
    expect(normalizeEquipment("53' van")).toBe('V')
    expect(normalizeEquipment('DV')).toBe('V')
  })

  it('maps refrigerated wording to R, even when "van" is present', () => {
    expect(normalizeEquipment('reefer')).toBe('R')
    expect(normalizeEquipment('refrigerated van')).toBe('R')
    expect(normalizeEquipment('temp control')).toBe('R')
  })

  it('maps flatbed and tarped wording to F', () => {
    expect(normalizeEquipment('flatbed')).toBe('F')
    expect(normalizeEquipment('flat bed, tarped')).toBe('F')
    expect(normalizeEquipment('conestoga')).toBe('F')
  })

  it('distinguishes step deck (SD) from double drop (DD)', () => {
    expect(normalizeEquipment('step deck')).toBe('SD')
    expect(normalizeEquipment('drop deck')).toBe('SD')
    expect(normalizeEquipment('double drop')).toBe('DD')
    expect(normalizeEquipment('RGN lowboy')).toBe('DD')
  })

  it('is case-insensitive', () => {
    expect(normalizeEquipment('REEFER')).toBe('R')
  })

  it('returns null for empty or unrecognized input', () => {
    expect(normalizeEquipment(null)).toBeNull()
    expect(normalizeEquipment('')).toBeNull()
    expect(normalizeEquipment('teleporter')).toBeNull()
  })

  it('only emits codes in the lane equipment taxonomy', () => {
    for (const code of EQUIPMENT_CODES) {
      expect(['V', 'R', 'F', 'SD', 'DD']).toContain(code)
    }
  })
})

describe('parseWeight', () => {
  it('expands a k suffix to thousands of pounds', () => {
    expect(parseWeight('42k')).toBe(42000)
    expect(parseWeight('~46k lbs')).toBe(46000)
    expect(parseWeight('42.5k')).toBe(42500)
  })

  it('parses explicit pound figures with separators', () => {
    expect(parseWeight('42,000 lbs')).toBe(42000)
    expect(parseWeight('28000')).toBe(28000)
  })

  it('returns null when no number is present', () => {
    expect(parseWeight(null)).toBeNull()
    expect(parseWeight('a full truckload')).toBeNull()
  })
})

describe('formatLane', () => {
  it('renders City, ST → City, ST and upper-cases the state', () => {
    expect(
      formatLane(
        { city: 'Fresno', state: 'ca', zip: null },
        { city: 'Dallas', state: 'TX', zip: null },
      ),
    ).toBe('Fresno, CA → Dallas, TX')
  })
})

function sampleRfq(overrides: Partial<Rfq> = {}): Rfq {
  return RfqSchema.parse({
    origin: { city: 'Fresno', state: 'CA', zip: null },
    destination: { city: 'Dallas', state: 'TX', zip: null },
    equipmentCode: 'V',
    equipmentText: 'reefer',
    pickupDate: '2026-06-04',
    weightLbs: 42000,
    commodity: 'produce',
    accessorials: [],
    notes: null,
    ...overrides,
  })
}

describe('RfqSchema', () => {
  it('accepts a well-formed RFQ', () => {
    expect(() => sampleRfq()).not.toThrow()
  })

  it('rejects an unknown equipment code', () => {
    expect(() =>
      RfqSchema.parse({ ...sampleRfq(), equipmentCode: 'XL' as unknown as Rfq['equipmentCode'] }),
    ).toThrow()
  })

  it('rejects a non-positive weight', () => {
    expect(() => RfqSchema.parse({ ...sampleRfq(), weightLbs: 0 })).toThrow()
  })
})

describe('reconcileEquipment', () => {
  it('overrides the model code when the free text maps cleanly', () => {
    const rfq = sampleRfq({ equipmentCode: 'V', equipmentText: 'reefer' })
    expect(reconcileEquipment(rfq).equipmentCode).toBe('R')
  })

  it('keeps the model code when the free text does not map', () => {
    const rfq = sampleRfq({ equipmentCode: 'SD', equipmentText: null })
    expect(reconcileEquipment(rfq).equipmentCode).toBe('SD')
  })
})

describe('toRfqPayload', () => {
  it('assembles provenance + reconciled lane/equipment', () => {
    const payload = toRfqPayload(
      {
        messageId: 'm1',
        threadId: 't1',
        from: 'logistics@valleypack.com',
        subject: 'Need a reefer Thu',
        date: '2026-06-01T12:00:00.000Z',
      },
      sampleRfq({ equipmentCode: 'V', equipmentText: 'reefer' }),
    )
    expect(payload.lane).toBe('Fresno, CA → Dallas, TX')
    expect(payload.rfq.equipmentCode).toBe('R')
    expect(payload.messageId).toBe('m1')
    expect(payload.receivedAt).toBe('2026-06-01T12:00:00.000Z')
  })
})

describe('buildExtractionPrompt', () => {
  it('embeds sender, subject, and body', () => {
    const prompt = buildExtractionPrompt({
      from: 'a@b.com',
      subject: 'Reefer Fresno to Dallas',
      body: 'Need a reefer, ~42k produce.',
    })
    expect(prompt).toContain('a@b.com')
    expect(prompt).toContain('Reefer Fresno to Dallas')
    expect(prompt).toContain('~42k produce')
    expect(prompt).toContain('never invent')
  })
})
