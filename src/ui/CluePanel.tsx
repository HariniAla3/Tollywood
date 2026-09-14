import { CLUE_COUNT } from '../domain/clues'

type Props = {
  clues: string[]
  /** How many are unlocked -- one per wrong guess. */
  unlocked: number
}

export function CluePanel({ clues, unlocked }: Props) {
  if (clues.length === 0) return null

  return (
    <section className="clues" aria-label="Clues">
      <h2 className="board__heading">Clues</h2>
      <ol className="clues__list">
        {clues.map((clue, i) => {
          const open = i < unlocked
          return (
            <li key={i} className={`clues__item${open ? '' : ' clues__item--locked'}`}>
              <span className="clues__num">{i + 1}</span>
              <span className="clues__text">
                {open ? clue : `Unlocks after guess ${i + 1}`}
              </span>
            </li>
          )
        })}
      </ol>
      {unlocked === 0 && (
        <p className="clues__hint">Clue unlocks with each wrong guess.</p>
      )}
      {unlocked >= CLUE_COUNT && null}
    </section>
  )
}
