import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalStorage } from './localStorage'
import { emptyStats } from './stats'

describe('createLocalStorage', () => {
  beforeEach(() => localStorage.clear())

  it('returns null for a date never saved', () => {
    expect(createLocalStorage().loadSession('2026-09-13')).toBeNull()
  })

  it('round-trips a session', () => {
    const storage = createLocalStorage()
    const session = {
      puzzleDate: '2026-09-13', guessIds: ['f_1', 'f_2'],
      revealedCells: [{ kind: 'year' as const }], extraGuessesUnlocked: false,
    }
    storage.saveSession(session)
    expect(storage.loadSession('2026-09-13')).toEqual(session)
  })

  it('keeps sessions for different dates apart', () => {
    const storage = createLocalStorage()
    storage.saveSession({ puzzleDate: 'a', guessIds: ['f_1'], revealedCells: [], extraGuessesUnlocked: false })
    storage.saveSession({ puzzleDate: 'b', guessIds: ['f_2'], revealedCells: [], extraGuessesUnlocked: false })
    expect(storage.loadSession('a')?.guessIds).toEqual(['f_1'])
    expect(storage.loadSession('b')?.guessIds).toEqual(['f_2'])
  })

  it('returns empty stats when none are stored', () => {
    expect(createLocalStorage().loadStats()).toEqual(emptyStats())
  })

  it('round-trips stats', () => {
    const storage = createLocalStorage()
    const stats = { ...emptyStats(), played: 4, won: 3, currentStreak: 2 }
    storage.saveStats(stats)
    expect(storage.loadStats()).toEqual(stats)
  })

  it('falls back to empty stats when the stored value is corrupt', () => {
    localStorage.setItem('tollywood:stats', 'not json')
    expect(createLocalStorage().loadStats()).toEqual(emptyStats())
  })

  it('returns null when a stored session is corrupt', () => {
    localStorage.setItem('tollywood:session:2026-09-13', '{{{')
    expect(createLocalStorage().loadSession('2026-09-13')).toBeNull()
  })

  it('survives storage being unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    const storage = createLocalStorage(broken)
    expect(() => storage.saveStats(emptyStats())).not.toThrow()
    expect(storage.loadStats()).toEqual(emptyStats())
  })
})
