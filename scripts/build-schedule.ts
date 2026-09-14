import { readFileSync, writeFileSync } from 'node:fs'
import { makeRng, shuffled } from '../src/domain/rng'
import type { Film } from '../src/domain/types'

export type Schedule = Record<string, string>

/** No film may recur inside this many days. */
export const NO_REPEAT_WINDOW = 90

export type ScheduleOptions = {
  answerIds: string[]
  existing: Schedule
  today: string
  from: string
  days: number
  seed: number
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function buildSchedule(opts: ScheduleOptions): Schedule {
  const { answerIds, existing, today, from, days, seed } = opts
  if (answerIds.length === 0) throw new Error('Answer pool is empty')

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
  const out: Schedule = {}

  // Frozen dates keep their film and consume it from the current cycle.
  const frozen = new Set<string>()
  for (const date of dates) {
    if (date <= today && existing[date]) {
      out[date] = existing[date]
      frozen.add(existing[date])
    }
  }

  const rng = makeRng(seed)
  let pool = shuffled(answerIds, rng).filter((id) => !frozen.has(id))
  let cursor = 0
  const assigned: string[] = []

  for (const date of dates) {
    if (out[date]) continue
    if (cursor >= pool.length) {
      // A plain reshuffle can put a film straight back into play across the
      // cycle boundary. Films used recently go last in the new cycle, ordered
      // oldest-first -- so the most recently seen film is also the furthest
      // away next time. Every repeat gap then equals the pool size, which
      // satisfies NO_REPEAT_WINDOW for any pool at least that large.
      const window = assigned.slice(-NO_REPEAT_WINDOW)
      const lastUsed = new Map(window.map((id, i) => [id, i]))
      const fresh = shuffled(answerIds, rng)
      pool = [
        ...fresh.filter((id) => !lastUsed.has(id)),
        ...fresh
          .filter((id) => lastUsed.has(id))
          .sort((a, b) => lastUsed.get(a)! - lastUsed.get(b)!),
      ]
      cursor = 0
    }
    const id = pool[cursor++]
    out[date] = id
    assigned.push(id)
  }

  return out
}

function main() {
  const films = JSON.parse(readFileSync('src/data/films.json', 'utf8')) as Film[]
  const answerIds = films.filter((f) => f.isMysteryEligible).map((f) => f.id)

  let existing: Schedule = {}
  try {
    existing = JSON.parse(readFileSync('src/data/schedule.json', 'utf8')) as Schedule
  } catch {
    // First run — no schedule yet.
  }

  const today = new Date().toISOString().slice(0, 10)
  const schedule = buildSchedule({
    answerIds,
    existing,
    today,
    from: '2026-01-01',
    days: 365 * 3,
    seed: 20260913,
  })

  writeFileSync('src/data/schedule.json', JSON.stringify(schedule, null, 0))
  process.stdout.write(
    `  Wrote src/data/schedule.json — ${Object.keys(schedule).length} dates from a pool of ${answerIds.length}\n`,
  )
}

// Only run when invoked directly, so tests can import buildSchedule.
if (process.argv[1]?.endsWith('build-schedule.ts')) main()
