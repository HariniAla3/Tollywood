import { cellStates, type CellState } from './board'
import { guessLimit } from './lifelines'
import { puzzleNumber } from './puzzleDate'
import type { Session } from './session'

const SQUARE: Record<CellState, string> = {
  matched: '🟩',
  lifeline: '🟨',
  hidden: '⬜',
}

export function buildShareCard(session: Session, streak: number): string {
  const squares = cellStates(session.board).map((s) => SQUARE[s])

  // Board order: year(1), genres(n), cast(6 as two rows of three), crew(1 or 2).
  // cellStates() already omits an absent Music cell, so the crew row is
  // whatever remains after the cast.
  const genreCount = session.board.genres.length
  const castStart = 1 + genreCount
  const crewStart = castStart + session.board.cast.length

  const rows = [
    squares.slice(0, 1),
    squares.slice(1, castStart),
    squares.slice(castStart, castStart + 3),
    squares.slice(castStart + 3, crewStart),
    squares.slice(crewStart),
  ].filter((r) => r.length > 0)

  const limit = guessLimit(session.lifelines)
  const score = session.status === 'won' ? `${session.outcomes.length}/${limit}` : `X/${limit}`

  const lines = [
    `🎬 Tollywood #${puzzleNumber(session.puzzleDate)}   ${score}`,
    '',
    ...rows.map((r) => r.join('')),
  ]

  if (streak > 0) lines.push('', `🔥 streak ${streak}`)

  return lines.join('\n')
}
