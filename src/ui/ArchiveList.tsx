import { puzzleNumber } from '../domain/puzzleDate'

type Props = {
  dates: string[]
  current: string
  onPick: (date: string) => void
}

export function ArchiveList({ dates, current, onPick }: Props) {
  return (
    <ul className="archive">
      {dates.map((date) => (
        <li key={date}>
          <button
            type="button"
            className={`archive__item${date === current ? ' archive__item--current' : ''}`}
            onClick={() => onPick(date)}
          >
            <span>#{puzzleNumber(date)}</span>
            <span className="archive__date">{date}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
