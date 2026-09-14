import { describe, it, expect } from 'vitest'
import { createBoard, applyReveals, revealCell, hiddenCells, revealAll, cellStates } from './board'
import { FIRST_YEAR, LAST_YEAR, type Film, type Person } from './types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Answer', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'], director: p(100), musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map(p), posterPath: null, popularity: 50, voteCount: 50,
  isMysteryEligible: true,
}

describe('createBoard', () => {
  it('starts every cell hidden', () => {
    const b = createBoard(answer)
    expect(cellStates(b).every((s) => s === 'hidden')).toBe(true)
  })

  it('starts the year bounds at the full window', () => {
    const b = createBoard(answer)
    expect(b.year.min).toBe(FIRST_YEAR)
    expect(b.year.max).toBe(LAST_YEAR)
  })

  it('creates one genre cell per answer genre', () => {
    expect(createBoard(answer).genres).toHaveLength(2)
  })

  it('creates six cast cells', () => {
    expect(createBoard(answer).cast).toHaveLength(6)
  })

  // Defensive only: the answer gates guarantee a composer. This pins the
  // degradation path so a bad override cannot crash the board.
  it('omits the music cell when the film has no composer', () => {
    const b = createBoard({ ...answer, musicDirector: null })
    expect(b.musicDirector).toBeNull()
    expect(cellStates(b)).toHaveLength(10)
  })

  it('includes the music cell when the film has a composer', () => {
    expect(cellStates(createBoard(answer))).toHaveLength(11)
  })
})

describe('applyReveals — year', () => {
  it('raises the floor above an older guess', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'later', guessYear: 2010 },
    ])
    expect(b.year.min).toBe(2011)
    expect(b.year.state).toBe('hidden')
  })

  it('lowers the ceiling below a newer guess', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'earlier', guessYear: 2022 },
    ])
    expect(b.year.max).toBe(2021)
  })

  it('solves the year on an exact match', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'exact', guessYear: 2018 },
    ])
    expect(b.year.state).toBe('matched')
    expect(b.year.min).toBe(2018)
    expect(b.year.max).toBe(2018)
  })

  it('never widens a bound already narrowed', () => {
    let b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'later', guessYear: 2015 },
    ])
    b = applyReveals(b, [{ kind: 'year', relation: 'later', guessYear: 2008 }])
    expect(b.year.min).toBe(2016)
  })
})

describe('applyReveals — cells', () => {
  it('opens a genre cell', () => {
    const b = applyReveals(createBoard(answer), [{ kind: 'genre', slot: 1, genre: 'Drama' }])
    expect(b.genres[1].state).toBe('matched')
    expect(b.genres[0].state).toBe('hidden')
  })

  it('opens a cast cell', () => {
    const b = applyReveals(createBoard(answer), [{ kind: 'cast', slot: 2, person: p(3) }])
    expect(b.cast[2].state).toBe('matched')
  })

  it('opens a crew cell', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'crew', role: 'musicDirector', person: p(200) },
    ])
    expect(b.musicDirector!.state).toBe('matched')
    expect(b.director.state).toBe('hidden')
  })

  it('does not mutate the board it was given', () => {
    const b = createBoard(answer)
    applyReveals(b, [{ kind: 'genre', slot: 0, genre: 'Action' }])
    expect(b.genres[0].state).toBe('hidden')
  })
})

describe('revealCell', () => {
  it('opens a hidden cell as a lifeline reveal', () => {
    const b = revealCell(createBoard(answer), { kind: 'cast', slot: 4 })
    expect(b.cast[4].state).toBe('lifeline')
  })

  it('solves the year when the year cell is chosen', () => {
    const b = revealCell(createBoard(answer), { kind: 'year' })
    expect(b.year.state).toBe('lifeline')
    expect(b.year.min).toBe(2018)
    expect(b.year.max).toBe(2018)
  })

  it('leaves a matched cell as matched', () => {
    let b = applyReveals(createBoard(answer), [{ kind: 'genre', slot: 0, genre: 'Action' }])
    b = revealCell(b, { kind: 'genre', slot: 0 })
    expect(b.genres[0].state).toBe('matched')
  })
})

describe('hiddenCells', () => {
  it('lists every cell on a fresh board', () => {
    expect(hiddenCells(createBoard(answer))).toHaveLength(11)
  })

  it('omits cells that have been opened', () => {
    const b = applyReveals(createBoard(answer), [{ kind: 'cast', slot: 0, person: p(1) }])
    expect(hiddenCells(b)).toHaveLength(10)
  })

  it('never offers a music cell that does not exist', () => {
    const b = createBoard({ ...answer, musicDirector: null })
    expect(hiddenCells(b)).toHaveLength(10)
    expect(hiddenCells(b)).not.toContainEqual({ kind: 'crew', role: 'musicDirector' })
  })
})

describe('revealAll', () => {
  it('opens every remaining cell', () => {
    const b = revealAll(createBoard(answer))
    expect(cellStates(b).some((s) => s === 'hidden')).toBe(false)
  })
})
