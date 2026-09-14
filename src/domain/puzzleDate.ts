/** Puzzle #1. Everything is numbered from here. */
export const EPOCH_DATE = '2026-01-01'

/** IST is a fixed UTC+5:30 — no daylight saving, so a constant offset is correct. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** The calendar date in Asia/Kolkata at the given instant, as YYYY-MM-DD. */
export function istDateString(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

function toUtcMidnight(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`)
}

export function puzzleNumber(date: string): number {
  return Math.round((toUtcMidnight(date) - toUtcMidnight(EPOCH_DATE)) / DAY_MS) + 1
}

export function addDays(isoDate: string, n: number): string {
  return new Date(toUtcMidnight(isoDate) + n * DAY_MS).toISOString().slice(0, 10)
}
