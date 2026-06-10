import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fmtTime, fmtMoney, fmtRelative } from '@/lib/format'

// The npm test script pins TZ=UTC so fmtTime's local-time getters are deterministic.

describe('fmtTime', () => {
  it('formats an ISO datetime as YYYY-MM-DD HH:MM', () => {
    expect(fmtTime('2026-01-02T03:04:00Z')).toBe('2026-01-02 03:04')
  })

  it('converts offset inputs to local (UTC) time', () => {
    expect(fmtTime('2026-01-02T03:04:00+05:30')).toBe('2026-01-01 21:34')
  })

  it('zero-pads single-digit components', () => {
    expect(fmtTime('2026-09-05T07:08:00Z')).toBe('2026-09-05 07:08')
  })
})

describe('fmtMoney', () => {
  it('renders an em dash for zero or NaN', () => {
    expect(fmtMoney(0)).toBe('—')
    expect(fmtMoney(NaN)).toBe('—')
  })

  it('renders raw dollars below 1000', () => {
    expect(fmtMoney(1)).toBe('$1')
    expect(fmtMoney(999)).toBe('$999')
  })

  it('renders rounded $Xk at and above 1000', () => {
    expect(fmtMoney(1000)).toBe('$1k')
    expect(fmtMoney(1600)).toBe('$2k')
    expect(fmtMoney(184000)).toBe('$184k')
  })
})

describe('fmtRelative', () => {
  const NOW = new Date('2026-06-10T12:00:00Z')
  const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60000).toISOString()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders minutes below an hour', () => {
    expect(fmtRelative(minutesAgo(0))).toBe('0m')
    expect(fmtRelative(minutesAgo(45))).toBe('45m')
  })

  it('renders rounded hours between 1h and 24h', () => {
    expect(fmtRelative(minutesAgo(60))).toBe('1h')
    expect(fmtRelative(minutesAgo(90))).toBe('2h')
    expect(fmtRelative(minutesAgo(23 * 60))).toBe('23h')
  })

  it('renders rounded days at 24h and beyond', () => {
    expect(fmtRelative(minutesAgo(24 * 60))).toBe('1d')
    expect(fmtRelative(minutesAgo(72 * 60))).toBe('3d')
  })
})
