import { describe, it, expect } from 'vitest'
import filmsJson from './films.json'
import scheduleJson from './schedule.json'
import { isMysteryEligible } from '../domain/gates'
import { FIRST_YEAR, LAST_YEAR, type Film } from '../domain/types'
import { MIN_GUESSABLE, MIN_MYSTERY, VOTE_FLOOR } from '../../scripts/coverage'

const films = filmsJson as Film[]
const schedule = scheduleJson as Record<string, string>
const byId = new Map(films.map((f) => [f.id, f]))
const answers = films.filter((f) => f.isMysteryEligible)

describe('films.json', () => {
  it('meets the guessable threshold', () => {
    expect(films.length).toBeGreaterThanOrEqual(MIN_GUESSABLE)
  })

  it('meets the answer threshold', () => {
    expect(answers.length).toBeGreaterThanOrEqual(MIN_MYSTERY)
  })

  it('has unique ids', () => {
    expect(new Set(films.map((f) => f.id)).size).toBe(films.length)
  })

  it('keeps every film inside the year window', () => {
    for (const f of films) {
      expect(f.year).toBeGreaterThanOrEqual(FIRST_YEAR)
      expect(f.year).toBeLessThanOrEqual(LAST_YEAR)
    }
  })

  it('gives every film a director and at least 3 cast', () => {
    for (const f of films) {
      expect(f.director).toBeTruthy()
      expect(f.cast.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('never stores more than 10 cast', () => {
    for (const f of films) expect(f.cast.length).toBeLessThanOrEqual(10)
  })

  it('keeps every answer-eligible film above the vote floor', () => {
    for (const f of answers) expect(isMysteryEligible(f, VOTE_FLOOR)).toBe(true)
  })

  it('gives every answer at least 6 cast and 1 genre', () => {
    for (const f of answers) {
      expect(f.cast.length).toBeGreaterThanOrEqual(6)
      expect(f.genres.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('gives every answer a music director', () => {
    for (const f of answers) expect(f.musicDirector).not.toBeNull()
  })

  it('has a composer for most guessable films too', () => {
    // Measured at 77% on 2026-09-13. A sharp drop means the composer job
    // list in scripts/tmdb.ts stopped matching TMDB's spellings.
    const withComposer = films.filter((f) => f.musicDirector !== null).length
    expect(withComposer / films.length).toBeGreaterThan(0.6)
  })

  it('has no duplicate people within one film’s cast', () => {
    for (const f of films) {
      expect(new Set(f.cast.map((c) => c.id)).size).toBe(f.cast.length)
    }
  })
})

describe('schedule.json', () => {
  it('covers at least a year ahead', () => {
    expect(Object.keys(schedule).length).toBeGreaterThanOrEqual(365)
  })

  it('uses well-formed dates', () => {
    for (const date of Object.keys(schedule)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('references only films that exist', () => {
    for (const id of Object.values(schedule)) expect(byId.has(id)).toBe(true)
  })

  it('references only answer-eligible films', () => {
    for (const id of Object.values(schedule)) {
      expect(byId.get(id)?.isMysteryEligible).toBe(true)
    }
  })

  it('does not repeat a film within any 90-day window', () => {
    const ids = Object.keys(schedule).sort().map((d) => schedule[d])
    for (let i = 0; i < ids.length; i++) {
      const window = ids.slice(i, i + 90)
      expect(new Set(window).size).toBe(window.length)
    }
  })
})
