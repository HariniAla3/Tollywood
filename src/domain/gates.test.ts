import { describe, it, expect } from 'vitest'
import { isGuessable, isMysteryEligible } from './gates'
import type { FilmCandidate, Person } from './types'

const person = (id: number): Person => ({ id, name: `Person ${id}` })

const candidate = (over: Partial<FilmCandidate> = {}): FilmCandidate => ({
  id: 'f_1',
  tmdbId: 1,
  title: 'Test Film',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: person(100),
  musicDirector: person(200),
  cast: [person(1), person(2), person(3), person(4), person(5), person(6)],
  posterPath: '/p.jpg',
  popularity: 50,
  voteCount: 50,
  ...over,
})

describe('isGuessable', () => {
  it('accepts a complete film', () => {
    expect(isGuessable(candidate())).toBe(true)
  })

  it('rejects a film with no director', () => {
    expect(isGuessable(candidate({ director: null }))).toBe(false)
  })

  it('rejects a film with fewer than 3 credited cast', () => {
    expect(isGuessable(candidate({ cast: [person(1), person(2)] }))).toBe(false)
  })

  it('rejects a film with no genres', () => {
    expect(isGuessable(candidate({ genres: [] }))).toBe(false)
  })

  it('accepts a film with a single genre', () => {
    expect(isGuessable(candidate({ genres: ['Action'] }))).toBe(true)
  })

  it('rejects a film outside the year window', () => {
    expect(isGuessable(candidate({ year: 2004 }))).toBe(false)
    expect(isGuessable(candidate({ year: 2026 }))).toBe(false)
  })

  it('does not require a music director', () => {
    expect(isGuessable(candidate({ musicDirector: null }))).toBe(true)
  })
})

describe('isMysteryEligible', () => {
  it('accepts a complete, well-known film', () => {
    expect(isMysteryEligible(candidate(), 10)).toBe(true)
  })

  it('requires a music director', () => {
    expect(isMysteryEligible(candidate({ musicDirector: null }), 10)).toBe(false)
  })

  it('requires at least 6 credited cast', () => {
    const five = [1, 2, 3, 4, 5].map(person)
    expect(isMysteryEligible(candidate({ cast: five }), 10)).toBe(false)
  })

  // Requiring two genres was measured to exclude Magadheera and Happy Days.
  it('accepts a film with a single genre', () => {
    expect(isMysteryEligible(candidate({ genres: ['Action'] }), 10)).toBe(true)
  })

  it('rejects films below the vote floor', () => {
    expect(isMysteryEligible(candidate({ voteCount: 9 }), 10)).toBe(false)
  })

  it('accepts films exactly at the vote floor', () => {
    expect(isMysteryEligible(candidate({ voteCount: 10 }), 10)).toBe(true)
  })

  it('ignores popularity entirely', () => {
    expect(isMysteryEligible(candidate({ popularity: 0 }), 10)).toBe(true)
  })

  it('rejects anything that is not guessable', () => {
    expect(isMysteryEligible(candidate({ director: null }), 10)).toBe(false)
  })
})
