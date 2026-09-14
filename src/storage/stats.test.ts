import { describe, it, expect } from 'vitest'
import { emptyStats, recordResult } from './stats'

describe('recordResult', () => {
  it('counts a win', () => {
    const s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    expect(s.played).toBe(1)
    expect(s.won).toBe(1)
    expect(s.distribution[3]).toBe(1)
  })

  it('counts a loss without touching the distribution', () => {
    const s = recordResult(emptyStats(), { date: '2026-09-13', won: false, guesses: 7, isToday: true })
    expect(s.played).toBe(1)
    expect(s.won).toBe(0)
    expect(s.distribution[7]).toBeUndefined()
  })

  it('starts a streak at one', () => {
    const s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    expect(s.currentStreak).toBe(1)
    expect(s.maxStreak).toBe(1)
  })

  it('extends a streak on consecutive days', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-14', won: true, guesses: 4, isToday: true })
    expect(s.currentStreak).toBe(2)
  })

  it('resets a streak after a skipped day', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-15', won: true, guesses: 4, isToday: true })
    expect(s.currentStreak).toBe(1)
  })

  it('breaks a streak on a loss', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-14', won: false, guesses: 7, isToday: true })
    expect(s.currentStreak).toBe(0)
  })

  it('remembers the best streak after it breaks', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-14', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-15', won: false, guesses: 7, isToday: true })
    expect(s.maxStreak).toBe(2)
    expect(s.currentStreak).toBe(0)
  })

  it('does not move the streak for an archive play', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-05-01', won: true, guesses: 2, isToday: false })
    expect(s.currentStreak).toBe(1)
    expect(s.played).toBe(2)
    expect(s.distribution[2]).toBe(1)
  })

  it('ignores a date that was already recorded', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    expect(s.played).toBe(1)
  })
})
