import { describe, it, expect } from 'vitest'
import { buildSchedule } from './build-schedule'

const ids = ['f_1', 'f_2', 'f_3', 'f_4']

describe('buildSchedule', () => {
  it('assigns one film to every date in the range', () => {
    const s = buildSchedule({
      answerIds: ids, existing: {}, today: '2026-01-01',
      from: '2026-01-01', days: 4, seed: 1,
    })
    expect(Object.keys(s)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
  })

  it('never repeats a film within one cycle', () => {
    const s = buildSchedule({
      answerIds: ids, existing: {}, today: '2026-01-01',
      from: '2026-01-01', days: 4, seed: 1,
    })
    expect(new Set(Object.values(s)).size).toBe(4)
  })

  it('cycles with a fresh shuffle once the pool is exhausted', () => {
    const s = buildSchedule({
      answerIds: ids, existing: {}, today: '2026-01-01',
      from: '2026-01-01', days: 8, seed: 1,
    })
    expect(Object.keys(s)).toHaveLength(8)
    expect(new Set(Object.values(s)).size).toBe(4)
  })

  it('is deterministic for a given seed', () => {
    const opts = { answerIds: ids, existing: {}, today: '2026-01-01', from: '2026-01-01', days: 6, seed: 5 }
    expect(buildSchedule(opts)).toEqual(buildSchedule(opts))
  })

  it('freezes dates on or before today', () => {
    const existing = { '2026-01-01': 'f_9', '2026-01-02': 'f_8' }
    const s = buildSchedule({
      answerIds: ids, existing, today: '2026-01-02',
      from: '2026-01-01', days: 4, seed: 3,
    })
    expect(s['2026-01-01']).toBe('f_9')
    expect(s['2026-01-02']).toBe('f_8')
  })

  it('rewrites future dates even when they already exist', () => {
    const existing = { '2026-01-03': 'f_9' }
    const s = buildSchedule({
      answerIds: ids, existing, today: '2026-01-02',
      from: '2026-01-01', days: 4, seed: 3,
    })
    expect(s['2026-01-03']).not.toBe('f_9')
  })

  it('does not reuse a frozen film later in the same cycle', () => {
    const existing = { '2026-01-01': 'f_3' }
    const s = buildSchedule({
      answerIds: ids, existing, today: '2026-01-01',
      from: '2026-01-01', days: 4, seed: 3,
    })
    const future = ['2026-01-02', '2026-01-03', '2026-01-04'].map((d) => s[d])
    expect(future).not.toContain('f_3')
  })

  it('throws when the answer pool is empty', () => {
    expect(() =>
      buildSchedule({ answerIds: [], existing: {}, today: '2026-01-01', from: '2026-01-01', days: 1, seed: 1 }),
    ).toThrow(/empty/i)
  })
})

describe('buildSchedule — cycle boundaries', () => {
  it('does not repeat a film within the no-repeat window', () => {
    const pool = Array.from({ length: 120 }, (_, i) => `f_${i}`)
    const s = buildSchedule({
      answerIds: pool, existing: {}, today: '2026-01-01',
      from: '2026-01-01', days: 400, seed: 7,
    })
    const ids = Object.keys(s).sort().map((d) => s[d])
    for (let i = 0; i < ids.length; i++) {
      const w = ids.slice(i, i + 90)
      expect(new Set(w).size).toBe(w.length)
    }
  })
})
