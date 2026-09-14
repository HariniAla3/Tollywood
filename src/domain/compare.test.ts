import { describe, it, expect } from 'vitest'
import { compareFilms } from './compare'
import type { Film, Person } from './types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const film = (over: Partial<Film> = {}): Film => ({
  id: 'f_x',
  tmdbId: 1,
  title: 'Film',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: p(100, 'Director A'),
  musicDirector: p(200, 'Composer A'),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)),
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  isMysteryEligible: true,
  ...over,
})

describe('compareFilms — correctness', () => {
  it('marks an identical film as correct', () => {
    const answer = film()
    expect(compareFilms(answer, answer).correct).toBe(true)
  })

  it('marks a different film as incorrect', () => {
    expect(compareFilms(film({ id: 'f_y' }), film()).correct).toBe(false)
  })
})

describe('compareFilms — year', () => {
  it('reports "later" when the guess is older', () => {
    const out = compareFilms(film({ id: 'g', year: 2010 }), film({ year: 2018 }))
    expect(out.reveals).toContainEqual({ kind: 'year', relation: 'later', guessYear: 2010 })
  })

  it('reports "earlier" when the guess is newer', () => {
    const out = compareFilms(film({ id: 'g', year: 2022 }), film({ year: 2018 }))
    expect(out.reveals).toContainEqual({ kind: 'year', relation: 'earlier', guessYear: 2022 })
  })

  it('reports "exact" when the years match', () => {
    const out = compareFilms(film({ id: 'g', year: 2018 }), film({ year: 2018 }))
    expect(out.reveals).toContainEqual({ kind: 'year', relation: 'exact', guessYear: 2018 })
  })

  it('always emits exactly one year reveal', () => {
    const out = compareFilms(film({ id: 'g', year: 2010 }), film({ year: 2018 }))
    expect(out.reveals.filter((r) => r.kind === 'year')).toHaveLength(1)
  })
})

describe('compareFilms — genres', () => {
  it('reveals a shared genre at its answer slot', () => {
    const out = compareFilms(
      film({ id: 'g', genres: ['Comedy', 'Drama'] }),
      film({ genres: ['Action', 'Drama'] }),
    )
    expect(out.reveals).toContainEqual({ kind: 'genre', slot: 1, genre: 'Drama' })
  })

  it('reveals every shared genre', () => {
    const out = compareFilms(
      film({ id: 'g', genres: ['Drama', 'Action'] }),
      film({ genres: ['Action', 'Drama'] }),
    )
    expect(out.reveals.filter((r) => r.kind === 'genre')).toHaveLength(2)
  })

  it('reveals nothing when no genre is shared', () => {
    const out = compareFilms(
      film({ id: 'g', genres: ['Horror'] }),
      film({ genres: ['Action', 'Drama'] }),
    )
    expect(out.reveals.filter((r) => r.kind === 'genre')).toHaveLength(0)
  })
})

describe('compareFilms — cast', () => {
  it('reveals a shared actor at their answer billing slot', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(9), p(3)] }),
      film({ cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)) }),
    )
    expect(out.reveals).toContainEqual({ kind: 'cast', slot: 2, person: p(3) })
  })

  it('reveals multiple shared actors at their own slots', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(1), p(3)] }),
      film({ cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)) }),
    )
    const slots = out.reveals.filter((r) => r.kind === 'cast').map((r: any) => r.slot)
    expect(slots.sort()).toEqual([0, 2])
  })

  it('ignores an actor billed below the cell cutoff in the answer', () => {
    const answer = film({ cast: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => p(n)) })
    const out = compareFilms(film({ id: 'g', cast: [p(8)] }), answer)
    expect(out.reveals.filter((r) => r.kind === 'cast')).toHaveLength(0)
  })

  it('does not rule out an actor who is in the answer but below the cutoff', () => {
    const answer = film({ cast: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => p(n)) })
    const out = compareFilms(film({ id: 'g', cast: [p(8)] }), answer)
    expect(out.eliminated.map((e) => e.id)).not.toContain(8)
  })
})

describe('compareFilms — crew', () => {
  it('reveals a shared director', () => {
    const out = compareFilms(film({ id: 'g' }), film())
    expect(out.reveals).toContainEqual({
      kind: 'crew', role: 'director', person: p(100, 'Director A'),
    })
  })

  it('reveals a shared music director', () => {
    const out = compareFilms(film({ id: 'g' }), film())
    expect(out.reveals).toContainEqual({
      kind: 'crew', role: 'musicDirector', person: p(200, 'Composer A'),
    })
  })

  it('reveals nothing for crew when neither matches', () => {
    const out = compareFilms(
      film({ id: 'g', director: p(999), musicDirector: p(998) }),
      film(),
    )
    expect(out.reveals.filter((r) => r.kind === 'crew')).toHaveLength(0)
  })

  it('opens both a crew cell and a cast cell for a director who also acts', () => {
    const answer = film({ director: p(1), cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)) })
    const guess = film({ id: 'g', director: p(1), cast: [p(1)] })
    const out = compareFilms(guess, answer)
    expect(out.reveals).toContainEqual({ kind: 'crew', role: 'director', person: p(1) })
    expect(out.reveals).toContainEqual({ kind: 'cast', slot: 0, person: p(1) })
  })

  it('handles a guess with no music director', () => {
    const out = compareFilms(film({ id: 'g', musicDirector: null }), film())
    expect(out.reveals.filter((r: any) => r.role === 'musicDirector')).toHaveLength(0)
  })
})

describe('compareFilms — eliminations', () => {
  it('rules out every person in the guess who is absent from the answer', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(50), p(51)], director: p(52), musicDirector: p(53) }),
      film(),
    )
    expect(out.eliminated.map((e) => e.id).sort((a, b) => a - b)).toEqual([50, 51, 52, 53])
  })

  it('does not rule out people who matched', () => {
    const out = compareFilms(film({ id: 'g', cast: [p(1), p(50)] }), film())
    expect(out.eliminated.map((e) => e.id)).toEqual([50])
  })

  it('does not rule out the answer director when the guess shares them', () => {
    const out = compareFilms(film({ id: 'g', cast: [] as Person[] }), film())
    expect(out.eliminated.map((e) => e.id)).not.toContain(100)
  })

  it('lists each eliminated person only once', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(50), p(50)], director: p(50), musicDirector: p(50) }),
      film(),
    )
    expect(out.eliminated).toHaveLength(1)
  })
})
