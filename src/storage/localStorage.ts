import type { PersistedSession } from '../domain/session'
import { emptyStats } from './stats'
import type { GameStorage, Stats } from './types'

const SESSION_PREFIX = 'tollywood:session:'
const STATS_KEY = 'tollywood:stats'

/**
 * Private browsing and blocked site data make localStorage throw rather than
 * return null, so every access is guarded. A player with storage disabled
 * still gets a fully playable game -- it simply forgets between visits.
 */
export function createLocalStorage(ls: Storage = localStorage): GameStorage {
  function read<T>(key: string, fallback: T): T {
    try {
      const raw = ls.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  }

  function write(key: string, value: unknown): void {
    try {
      ls.setItem(key, JSON.stringify(value))
    } catch {
      // Nothing useful to do -- the game continues in memory.
    }
  }

  return {
    loadSession: (date) => read<PersistedSession | null>(SESSION_PREFIX + date, null),
    saveSession: (session) => write(SESSION_PREFIX + session.puzzleDate, session),
    loadStats: () => read<Stats>(STATS_KEY, emptyStats()),
    saveStats: (stats) => write(STATS_KEY, stats),
  }
}
