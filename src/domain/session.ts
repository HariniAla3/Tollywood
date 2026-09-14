import { compareFilms, type GuessOutcome } from './compare'
import {
  applyReveals, createBoard, revealAll, revealCell,
  type Board, type CellRef,
} from './board'
import { mergeRuledOut } from './ruledOut'
import {
  canUnlockExtraGuesses, emptyLifelines, guessLimit, revealsAvailable,
  type LifelineState,
} from './lifelines'
import type { Film, Person } from './types'

export type SessionStatus = 'playing' | 'won' | 'lost'

export type Session = {
  puzzleDate: string
  answer: Film
  board: Board
  outcomes: GuessOutcome[]
  ruledOut: Person[]
  revealedCells: CellRef[]
  lifelines: LifelineState
  status: SessionStatus
}

/** The only thing written to storage. Everything else is replayed from it. */
export type PersistedSession = {
  puzzleDate: string
  guessIds: string[]
  revealedCells: CellRef[]
  extraGuessesUnlocked: boolean
}

export function startSession(puzzleDate: string, answer: Film): Session {
  return {
    puzzleDate,
    answer,
    board: createBoard(answer),
    outcomes: [],
    ruledOut: [],
    revealedCells: [],
    lifelines: emptyLifelines(),
    status: 'playing',
  }
}

export function submitGuess(s: Session, guess: Film): Session {
  if (s.status !== 'playing') return s
  if (s.outcomes.some((o) => o.guessId === guess.id)) return s
  if (s.outcomes.length >= guessLimit(s.lifelines)) return s

  const outcome = compareFilms(guess, s.answer)
  const outcomes = [...s.outcomes, outcome]

  let status: SessionStatus = 'playing'
  if (outcome.correct) status = 'won'
  else if (outcomes.length >= guessLimit(s.lifelines)) status = 'lost'

  let board = applyReveals(s.board, outcome.reveals)
  if (status !== 'playing') board = revealAll(board)

  return {
    ...s,
    board,
    outcomes,
    ruledOut: mergeRuledOut(s.ruledOut, outcome.eliminated),
    status,
  }
}

export function useReveal(s: Session, ref: CellRef): Session {
  if (s.status !== 'playing') return s
  if (revealsAvailable(s.lifelines, s.outcomes.length) <= 0) return s

  return {
    ...s,
    board: revealCell(s.board, ref),
    revealedCells: [...s.revealedCells, ref],
    lifelines: { ...s.lifelines, revealsUsed: s.lifelines.revealsUsed + 1 },
  }
}

export function unlockExtraGuesses(s: Session): Session {
  if (s.status === 'won') return s
  if (!canUnlockExtraGuesses(s.lifelines, s.outcomes.length)) return s

  return {
    ...s,
    // The board was opened when the game was lost; rebuild it by replay.
    board: replayBoard(s.answer, s.outcomes, s.revealedCells),
    lifelines: { ...s.lifelines, extraGuessesUnlocked: true },
    status: 'playing',
  }
}

function replayBoard(answer: Film, outcomes: GuessOutcome[], cells: CellRef[]): Board {
  let board = createBoard(answer)
  for (const o of outcomes) board = applyReveals(board, o.reveals)
  for (const ref of cells) board = revealCell(board, ref)
  return board
}

export function toPersisted(s: Session): PersistedSession {
  return {
    puzzleDate: s.puzzleDate,
    guessIds: s.outcomes.map((o) => o.guessId),
    revealedCells: s.revealedCells,
    extraGuessesUnlocked: s.lifelines.extraGuessesUnlocked,
  }
}

export function replaySession(
  p: PersistedSession,
  answer: Film,
  lookup: (id: string) => Film | undefined,
): Session {
  let s = startSession(p.puzzleDate, answer)
  if (p.extraGuessesUnlocked) {
    s = { ...s, lifelines: { ...s.lifelines, extraGuessesUnlocked: true } }
  }

  for (const id of p.guessIds) {
    const film = lookup(id)
    if (film) s = submitGuess(s, film)
  }
  for (const ref of p.revealedCells) {
    s = {
      ...s,
      board: revealCell(s.board, ref),
      revealedCells: [...s.revealedCells, ref],
      lifelines: { ...s.lifelines, revealsUsed: s.lifelines.revealsUsed + 1 },
    }
  }

  return s
}
