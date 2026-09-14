import { isGuessable, isMysteryEligible } from '../src/domain/gates'
import { FIRST_YEAR, LAST_YEAR, type FilmCandidate } from '../src/domain/types'

export const MIN_GUESSABLE = 1500
export const MIN_MYSTERY = 300

/**
 * Measured 2026-09-13 against live TMDB: a floor of 10 votes gives 395
 * answers (over a year of puzzles) and ranks the way a fan would.
 */
export const VOTE_FLOOR = 10

export type OverrideMap = Record<string, Partial<FilmCandidate>>

export function applyOverrides(c: FilmCandidate, overrides: OverrideMap): FilmCandidate {
  const patch = overrides[c.id]
  return patch ? { ...c, ...patch } : c
}

export type Coverage = {
  total: number
  guessable: number
  mysteryEligible: number
  /** Would be answers, but no composer credit exists under any job name. */
  lostToMissingComposer: number
  rejected: {
    outOfWindow: number
    noDirector: number
    tooFewCast: number
    noGenres: number
  }
  meetsThresholds: boolean
}

export function buildCoverage(candidates: FilmCandidate[], voteFloor: number): Coverage {
  const rejected = { outOfWindow: 0, noDirector: 0, tooFewCast: 0, noGenres: 0 }
  let guessable = 0
  let mysteryEligible = 0
  let lostToMissingComposer = 0

  for (const c of candidates) {
    if (isGuessable(c)) {
      guessable++
      if (isMysteryEligible(c, voteFloor)) {
        mysteryEligible++
      } else if (c.musicDirector === null && c.cast.length >= 6 && c.voteCount >= voteFloor) {
        lostToMissingComposer++
      }
    } else {
      if (c.year < FIRST_YEAR || c.year > LAST_YEAR) rejected.outOfWindow++
      else if (c.director === null) rejected.noDirector++
      else if (c.cast.length < 3) rejected.tooFewCast++
      else if (c.genres.length < 1) rejected.noGenres++
    }
  }

  return {
    total: candidates.length,
    guessable,
    mysteryEligible,
    lostToMissingComposer,
    rejected,
    meetsThresholds: guessable >= MIN_GUESSABLE && mysteryEligible >= MIN_MYSTERY,
  }
}

export function formatCoverage(c: Coverage): string {
  return [
    '',
    '  TMDB COVERAGE REPORT',
    '  ─────────────────────────────────────────',
    `  Films returned            ${c.total}`,
    `  Guessable                 ${c.guessable}   (need ${MIN_GUESSABLE})`,
    `  Answer-eligible           ${c.mysteryEligible}   (need ${MIN_MYSTERY})`,
    '',
    `  Lost to a missing composer  ${c.lostToMissingComposer}   (measured: 10)`,
    '    ^ recoverable by adding them to src/data/overrides.json',
    '',
    '  Guess-gate rejections',
    `    outside 2005-2025       ${c.rejected.outOfWindow}`,
    `    no director             ${c.rejected.noDirector}`,
    `    fewer than 3 cast       ${c.rejected.tooFewCast}`,
    `    no genres               ${c.rejected.noGenres}`,
    '',
    c.meetsThresholds
      ? '  ✅ Thresholds met — proceed.'
      : '  ❌ Thresholds NOT met — stop and escalate per spec §4.1.',
    '',
  ].join('\n')
}
