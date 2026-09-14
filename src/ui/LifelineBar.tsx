type Props = {
  revealsAvailable: number
  canUnlockExtra: boolean
  selecting: boolean
  onStartSelect: () => void
  onCancelSelect: () => void
  onUnlockExtra: () => void
}

export function LifelineBar({
  revealsAvailable, canUnlockExtra, selecting,
  onStartSelect, onCancelSelect, onUnlockExtra,
}: Props) {
  if (revealsAvailable === 0 && !canUnlockExtra) return null

  return (
    <div className="lifelines">
      {revealsAvailable > 0 &&
        (selecting ? (
          <button type="button" className="lifelines__btn" onClick={onCancelSelect}>
            Cancel — pick a cell above
          </button>
        ) : (
          <button type="button" className="lifelines__btn" onClick={onStartSelect}>
            Reveal a cell ({revealsAvailable})
          </button>
        ))}

      {canUnlockExtra && (
        <button type="button" className="lifelines__btn" onClick={onUnlockExtra}>
          Unlock 3 more guesses
        </button>
      )}
    </div>
  )
}
