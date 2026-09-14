import { RIDDLE_UNLOCK_AT } from '../domain/clues'

type Props = {
  riddle: string
  /** Guesses used so far. */
  guesses: number
}

export function RiddlePanel({ riddle, guesses }: Props) {
  const unlocked = guesses >= RIDDLE_UNLOCK_AT
  const left = RIDDLE_UNLOCK_AT - guesses

  return (
    <section className="riddle" aria-label="Riddle">
      <h2 className="board__heading">Riddle</h2>
      {unlocked ? (
        <p className="riddle__text">{riddle}</p>
      ) : (
        <p className="riddle__locked">
          Unlocks after {left} more {left === 1 ? 'guess' : 'guesses'}.
        </p>
      )}
    </section>
  )
}
