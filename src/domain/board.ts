import type { Reveal } from './compare'
import { CAST_CELLS, FIRST_YEAR, LAST_YEAR, type Film, type Person } from './types'

export type CellState = 'hidden' | 'matched' | 'lifeline'

export type CellRef =
  | { kind: 'year' }
  | { kind: 'genre'; slot: number }
  | { kind: 'cast'; slot: number }
  | { kind: 'crew'; role: 'director' | 'musicDirector' }

type ValueCell<T> = { value: T; state: CellState }

export type Board = {
  answerYear: number
  year: { min: number; max: number; state: CellState }
  genres: ValueCell<string>[]
  cast: ValueCell<Person>[]
  director: ValueCell<Person>
  /**
   * The answer gates guarantee a composer, so this is non-null for every real
   * puzzle. The null path is defensive -- it keeps a bad hand-written override
   * from crashing the board, degrading to an 11-cell layout instead.
   */
  musicDirector: ValueCell<Person> | null
}

export function createBoard(answer: Film): Board {
  return {
    answerYear: answer.year,
    year: { min: FIRST_YEAR, max: LAST_YEAR, state: 'hidden' },
    genres: answer.genres.map((value) => ({ value, state: 'hidden' as CellState })),
    cast: answer.cast
      .slice(0, CAST_CELLS)
      .map((value) => ({ value, state: 'hidden' as CellState })),
    director: { value: answer.director, state: 'hidden' },
    musicDirector: answer.musicDirector
      ? { value: answer.musicDirector, state: 'hidden' }
      : null,
  }
}

function clone(b: Board): Board {
  return {
    answerYear: b.answerYear,
    year: { ...b.year },
    genres: b.genres.map((c) => ({ ...c })),
    cast: b.cast.map((c) => ({ ...c })),
    director: { ...b.director },
    musicDirector: b.musicDirector ? { ...b.musicDirector } : null,
  }
}

export function applyReveals(board: Board, reveals: Reveal[]): Board {
  const b = clone(board)

  for (const r of reveals) {
    switch (r.kind) {
      case 'year':
        if (r.relation === 'exact') {
          b.year.min = r.guessYear
          b.year.max = r.guessYear
          if (b.year.state === 'hidden') b.year.state = 'matched'
        } else if (r.relation === 'later') {
          b.year.min = Math.max(b.year.min, r.guessYear + 1)
        } else {
          b.year.max = Math.min(b.year.max, r.guessYear - 1)
        }
        break
      case 'genre':
        if (b.genres[r.slot].state === 'hidden') b.genres[r.slot].state = 'matched'
        break
      case 'cast':
        if (b.cast[r.slot].state === 'hidden') b.cast[r.slot].state = 'matched'
        break
      case 'crew': {
        const cell = b[r.role]
        if (cell && cell.state === 'hidden') cell.state = 'matched'
        break
      }
    }
  }

  return b
}

export function revealCell(board: Board, ref: CellRef): Board {
  const b = clone(board)

  switch (ref.kind) {
    case 'year':
      if (b.year.state === 'hidden') {
        b.year.state = 'lifeline'
        b.year.min = b.answerYear
        b.year.max = b.answerYear
      }
      break
    case 'genre':
      if (b.genres[ref.slot].state === 'hidden') b.genres[ref.slot].state = 'lifeline'
      break
    case 'cast':
      if (b.cast[ref.slot].state === 'hidden') b.cast[ref.slot].state = 'lifeline'
      break
    case 'crew': {
      const cell = b[ref.role]
      if (cell && cell.state === 'hidden') cell.state = 'lifeline'
      break
    }
  }

  return b
}

export function hiddenCells(board: Board): CellRef[] {
  const out: CellRef[] = []
  if (board.year.state === 'hidden') out.push({ kind: 'year' })
  board.genres.forEach((c, slot) => {
    if (c.state === 'hidden') out.push({ kind: 'genre', slot })
  })
  board.cast.forEach((c, slot) => {
    if (c.state === 'hidden') out.push({ kind: 'cast', slot })
  })
  if (board.director.state === 'hidden') out.push({ kind: 'crew', role: 'director' })
  if (board.musicDirector?.state === 'hidden') out.push({ kind: 'crew', role: 'musicDirector' })
  return out
}

export function revealAll(board: Board): Board {
  return hiddenCells(board).reduce(revealCell, board)
}

/** Board order, used by the share card and by tests. */
export function cellStates(board: Board): CellState[] {
  return [
    board.year.state,
    ...board.genres.map((c) => c.state),
    ...board.cast.map((c) => c.state),
    board.director.state,
    ...(board.musicDirector ? [board.musicDirector.state] : []),
  ]
}
