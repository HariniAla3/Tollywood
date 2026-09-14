import type { CellState } from '../domain/board'

type Props = {
  label?: string
  value: string
  state: CellState
  pickable: boolean
  onPick: () => void
  /**
   * What to show while the cell is still hidden. Defaults to "?" so a cell
   * never leaks its answer. The Year cell passes its narrowing range here:
   * that range is deduced from the player's own guesses, so it is safe to
   * show, and hiding it would throw away the game's main feedback signal.
   */
  hiddenText?: string
}

export function Cell({ label, value, state, pickable, onPick, hiddenText }: Props) {
  const className = `cell cell--${state}${pickable ? ' cell--pickable' : ''}`
  const shown = state === 'hidden' ? (hiddenText ?? '?') : value

  const body = (
    <>
      {label && <span className="cell__label">{label}</span>}
      <span className="cell__value">{shown}</span>
    </>
  )

  if (pickable) {
    return (
      <button
        type="button"
        className={className}
        onClick={onPick}
        aria-label={`Reveal ${label ?? 'cell'}`}
      >
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}
