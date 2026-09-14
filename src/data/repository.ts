import type { Film } from '../domain/types'
import { EPOCH_DATE, addDays } from '../domain/puzzleDate'
import filmsJson from './films.json'
import scheduleJson from './schedule.json'

const films = filmsJson as Film[]
const schedule = scheduleJson as Record<string, string>

const byId = new Map(films.map((f) => [f.id, f]))

export function getFilm(id: string): Film | undefined {
  return byId.get(id)
}

export function guessableFilms(): Film[] {
  return films
}

export function answerIdForDate(date: string): string | null {
  return schedule[date] ?? null
}

/** Every scheduled date from the epoch through today, newest first. */
export function playableDates(today: string): string[] {
  const out: string[] = []
  for (let d = today; d >= EPOCH_DATE; d = addDays(d, -1)) {
    if (schedule[d]) out.push(d)
  }
  return out
}
