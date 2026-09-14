import { useCallback, useMemo, useState } from 'react'
import { getFilm, guessableFilms, playableDates } from '../data/repository'
import type { CellRef } from '../domain/board'
import { istDateString, puzzleNumber } from '../domain/puzzleDate'
import { ArchiveList } from './ArchiveList'
import { BoardView } from './Board'
import { Footer } from './Footer'
import { GuessHistory } from './GuessHistory'
import { GuessInput } from './GuessInput'
import { LifelineBar } from './LifelineBar'
import { ResultModal } from './ResultModal'
import { RuledOutPanel } from './RuledOutPanel'
import { useGame } from './useGame'

function dateFromUrl(fallback: string): string {
  const d = new URLSearchParams(window.location.search).get('d')
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallback
}

export function App() {
  const today = useMemo(() => istDateString(new Date()), [])
  const [puzzleDate, setPuzzleDate] = useState(() => dateFromUrl(today))
  const [showArchive, setShowArchive] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const game = useGame(puzzleDate, today)
  const films = useMemo(() => guessableFilms(), [])
  const dates = useMemo(() => playableDates(today), [today])

  const goToDate = useCallback(
    (date: string) => {
      setPuzzleDate(date)
      setShowArchive(false)
      setSelecting(false)
      setDismissed(false)
      window.history.pushState({}, '', date === today ? '/' : `/?d=${date}`)
    },
    [today],
  )

  const pickCell = useCallback(
    (ref: CellRef) => {
      if (!selecting) return
      game.reveal(ref)
      setSelecting(false)
    },
    [game, selecting],
  )

  if (!game.session) {
    return (
      <div className="app">
        <h1 className="title">Tollywood</h1>
        <p>No puzzle is scheduled for {puzzleDate}.</p>
        <button type="button" className="lifelines__btn" onClick={() => goToDate(today)}>
          Go to today
        </button>
        <Footer />
      </div>
    )
  }

  const { session } = game
  const over = session.status !== 'playing'

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Tollywood</h1>
        <span className="header__num">#{puzzleNumber(puzzleDate)}</span>
        <button type="button" className="header__link" onClick={() => setShowArchive((v) => !v)}>
          Past days
        </button>
      </header>

      {showArchive && <ArchiveList dates={dates} current={puzzleDate} onPick={goToDate} />}

      <p className="attempts">
        Guess {Math.min(session.outcomes.length + 1, 10)} — {session.outcomes.length} used
      </p>

      <BoardView board={session.board} selecting={selecting} onPick={pickCell} />

      <LifelineBar
        revealsAvailable={game.revealsAvailable}
        canUnlockExtra={game.canUnlockExtra}
        selecting={selecting}
        onStartSelect={() => setSelecting(true)}
        onCancelSelect={() => setSelecting(false)}
        onUnlockExtra={() => {
          game.unlockExtra()
          setDismissed(true)
        }}
      />

      <GuessInput
        films={films}
        guessedIds={session.outcomes.map((o) => o.guessId)}
        disabled={over || selecting}
        onGuess={game.guess}
      />

      <GuessHistory outcomes={session.outcomes} lookup={getFilm} />
      <RuledOutPanel people={session.ruledOut} />

      {!dismissed && (
        <ResultModal session={session} stats={game.stats} onClose={() => setDismissed(true)} />
      )}

      <Footer />
    </div>
  )
}
