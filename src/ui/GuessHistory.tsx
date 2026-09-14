import type { GuessOutcome } from '../domain/compare'
import type { Film } from '../domain/types'

type Props = {
  outcomes: GuessOutcome[]
  lookup: (id: string) => Film | undefined
}

/** Reveals include the always-present year entry; cells opened excludes it. */
function cellsOpened(outcome: GuessOutcome): number {
  return outcome.reveals.filter((r) => r.kind !== 'year').length
}

export function GuessHistory({ outcomes, lookup }: Props) {
  if (outcomes.length === 0) return null

  return (
    <ol className="history">
      {[...outcomes].reverse().map((outcome) => {
        const film = lookup(outcome.guessId)
        return (
          <li
            key={outcome.guessId}
            className={`history__item${outcome.correct ? ' history__item--win' : ''}`}
          >
            <span className="history__title">{film?.title ?? 'Unknown film'}</span>
            <span className="history__year">{film?.year}</span>
            <span className="history__count">{cellsOpened(outcome)} revealed</span>
          </li>
        )
      })}
    </ol>
  )
}
