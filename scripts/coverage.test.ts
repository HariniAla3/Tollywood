import { describe, it, expect } from 'vitest'
import { applyOverrides, buildCoverage } from './coverage'
import type { FilmCandidate, Person } from '../src/domain/types'

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
  cast: [1, 2, 3, 4, 5, 6].map(person),
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  ...over,
})

describe('applyOverrides', () => {
  it('returns the candidate unchanged when no override exists', () => {
    const c = candidate()
    expect(applyOverrides(c, {})).toEqual(c)
  })

  it('patches a missing music director', () => {
    const c = candidate({ musicDirector: null })
    const patched = applyOverrides(c, {
      f_1: { musicDirector: { id: 77, name: 'Thaman S' } },
    })
    expect(patched.musicDirector).toEqual({ id: 77, name: 'Thaman S' })
  })

  it('patches aliases used for search', () => {
    const patched = applyOverrides(candidate(), { f_1: { aliases: ['RGV'] } })
    expect(patched.aliases).toEqual(['RGV'])
  })

  it('leaves unpatched fields alone', () => {
    const patched = applyOverrides(candidate(), { f_1: { aliases: ['X'] } })
    expect(patched.title).toBe('Test Film')
    expect(patched.director).toEqual(person(100))
  })
})

describe('buildCoverage', () => {
  it('counts total, guessable, and answer-eligible films', () => {
    const cov = buildCoverage(
      [candidate({ id: 'a' }), candidate({ id: 'b', voteCount: 1 }), candidate({ id: 'c', director: null })],
      10,
    )
    expect(cov.total).toBe(3)
    expect(cov.guessable).toBe(2)
    expect(cov.mysteryEligible).toBe(1)
  })

  it('excludes a composerless film from the answer pool', () => {
    const cov = buildCoverage([candidate({ musicDirector: null })], 10)
    expect(cov.mysteryEligible).toBe(0)
  })

  it('reports how many answers were lost to a missing composer', () => {
    const cov = buildCoverage([candidate({ musicDirector: null }), candidate({ id: 'b' })], 10)
    expect(cov.lostToMissingComposer).toBe(1)
    expect(cov.mysteryEligible).toBe(1)
  })

  it('breaks down guess-gate rejections by reason', () => {
    const cov = buildCoverage(
      [
        candidate({ director: null }),
        candidate({ cast: [person(1)] }),
        candidate({ genres: [] }),
        candidate({ year: 1999 }),
      ],
      10,
    )
    expect(cov.rejected.noDirector).toBe(1)
    expect(cov.rejected.tooFewCast).toBe(1)
    expect(cov.rejected.noGenres).toBe(1)
    expect(cov.rejected.outOfWindow).toBe(1)
  })

  it('flags when thresholds are not met', () => {
    expect(buildCoverage([candidate()], 10).meetsThresholds).toBe(false)
  })
})
