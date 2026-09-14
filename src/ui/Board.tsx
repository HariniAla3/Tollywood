import type { Board, CellRef, CellState } from '../domain/board'
import { Cell } from './Cell'

type Props = {
  board: Board
  selecting: boolean
  onPick: (ref: CellRef) => void
}

export function BoardView({ board, selecting, onPick }: Props) {
  const pick = (state: CellState) => selecting && state === 'hidden'

  // The range is deduced from the player's guesses, so it stays visible while
  // the cell is hidden; once solved the cell shows the exact year.
  const yearRange = `${board.year.min} – ${board.year.max}`

  return (
    <div className="board">
      <section className="board__row" aria-label="Year of release">
        <h2 className="board__heading">Year</h2>
        <div className="board__cells">
          <Cell
            value={String(board.year.min)}
            hiddenText={yearRange}
            state={board.year.state}
            pickable={pick(board.year.state)}
            onPick={() => onPick({ kind: 'year' })}
          />
        </div>
      </section>

      <section className="board__row" aria-label="Genres">
        <h2 className="board__heading">Genre</h2>
        <div className="board__cells">
          {board.genres.map((cell, slot) => (
            <Cell
              key={slot}
              value={cell.value}
              state={cell.state}
              pickable={pick(cell.state)}
              onPick={() => onPick({ kind: 'genre', slot })}
            />
          ))}
        </div>
      </section>

      <section className="board__row" aria-label="Cast">
        <h2 className="board__heading">Cast</h2>
        <div className="board__cells board__cells--grid">
          {board.cast.map((cell, slot) => (
            <Cell
              key={slot}
              label={String(slot + 1)}
              value={cell.value.name}
              state={cell.state}
              pickable={pick(cell.state)}
              onPick={() => onPick({ kind: 'cast', slot })}
            />
          ))}
        </div>
      </section>

      <section className="board__row" aria-label="Crew">
        <h2 className="board__heading">Crew</h2>
        <div className="board__cells">
          <Cell
            label="Director"
            value={board.director.value.name}
            state={board.director.state}
            pickable={pick(board.director.state)}
            onPick={() => onPick({ kind: 'crew', role: 'director' })}
          />
          {board.musicDirector && (
            <Cell
              label="Music"
              value={board.musicDirector.value.name}
              state={board.musicDirector.state}
              pickable={pick(board.musicDirector.state)}
              onPick={() => onPick({ kind: 'crew', role: 'musicDirector' })}
            />
          )}
        </div>
      </section>
    </div>
  )
}
