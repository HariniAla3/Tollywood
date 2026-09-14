import { describe, it, expect } from 'vitest'
import { istDateString, puzzleNumber, addDays, EPOCH_DATE } from './puzzleDate'

describe('istDateString', () => {
  it('converts a UTC morning to the same IST day', () => {
    expect(istDateString(new Date('2026-09-13T06:00:00Z'))).toBe('2026-09-13')
  })

  it('rolls over to the next day at 18:30 UTC', () => {
    expect(istDateString(new Date('2026-09-13T18:29:00Z'))).toBe('2026-09-13')
    expect(istDateString(new Date('2026-09-13T18:30:00Z'))).toBe('2026-09-14')
  })

  it('treats late UTC evening as the following IST day', () => {
    expect(istDateString(new Date('2026-09-13T23:45:00Z'))).toBe('2026-09-14')
  })

  it('handles the turn of the year', () => {
    expect(istDateString(new Date('2025-12-31T19:00:00Z'))).toBe('2026-01-01')
  })

  it('handles a leap day', () => {
    expect(istDateString(new Date('2028-02-28T19:00:00Z'))).toBe('2028-02-29')
  })
})

describe('puzzleNumber', () => {
  it('numbers the epoch as puzzle 1', () => {
    expect(puzzleNumber(EPOCH_DATE)).toBe(1)
  })

  it('increments by one per day', () => {
    expect(puzzleNumber('2026-01-02')).toBe(2)
    expect(puzzleNumber('2026-01-31')).toBe(31)
  })

  it('counts across month boundaries', () => {
    expect(puzzleNumber('2026-02-01')).toBe(32)
  })
})

describe('addDays', () => {
  it('advances a date', () => {
    expect(addDays('2026-09-13', 1)).toBe('2026-09-14')
  })

  it('goes backwards with a negative count', () => {
    expect(addDays('2026-09-13', -1)).toBe('2026-09-12')
  })

  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })
})
