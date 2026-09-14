import { addDays } from '../domain/puzzleDate'
import type { Stats } from './types'

export type RecordOptions = {
  date: string
  won: boolean
  guesses: number
  isToday: boolean
}

export function emptyStats(): Stats {
  return {
    played: 0, won: 0, currentStreak: 0, maxStreak: 0,
    lastStreakDate: null, recordedDates: [], distribution: {},
  }
}

export function recordResult(stats: Stats, opts: RecordOptions): Stats {
  if (stats.recordedDates.includes(opts.date)) return stats

  const next: Stats = {
    ...stats,
    played: stats.played + 1,
    won: stats.won + (opts.won ? 1 : 0),
    recordedDates: [...stats.recordedDates, opts.date],
    distribution: { ...stats.distribution },
  }

  if (opts.won) {
    next.distribution[opts.guesses] = (next.distribution[opts.guesses] ?? 0) + 1
  }

  // Archive plays never move the streak.
  if (!opts.isToday) return next

  if (!opts.won) {
    next.currentStreak = 0
    next.lastStreakDate = opts.date
    return next
  }

  const continues = stats.lastStreakDate === addDays(opts.date, -1)
  next.currentStreak = continues ? stats.currentStreak + 1 : 1
  next.maxStreak = Math.max(stats.maxStreak, next.currentStreak)
  next.lastStreakDate = opts.date
  return next
}
