import type { PersistedSession } from '../domain/session'

export type Stats = {
  played: number
  won: number
  currentStreak: number
  maxStreak: number
  lastStreakDate: string | null
  recordedDates: string[]
  distribution: Record<number, number>
}

export interface GameStorage {
  loadSession(date: string): PersistedSession | null
  saveSession(session: PersistedSession): void
  loadStats(): Stats
  saveStats(stats: Stats): void
}
