import { useMemo, useState } from 'react'
import { searchFilms } from '../domain/search'
import type { Film } from '../domain/types'

type Props = {
  films: Film[]
  guessedIds: string[]
  disabled: boolean
  onGuess: (film: Film) => void
}

export function GuessInput({ films, guessedIds, disabled, onGuess }: Props) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(-1)

  const matches = useMemo(() => searchFilms(films, query), [films, query])
  const guessed = useMemo(() => new Set(guessedIds), [guessedIds])

  function choose(film: Film) {
    if (guessed.has(film.id)) return
    onGuess(film)
    setQuery('')
    setHighlighted(-1)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Free text never submits -- only a highlighted suggestion does.
      if (highlighted >= 0 && matches[highlighted]) choose(matches[highlighted])
    } else if (e.key === 'Escape') {
      setQuery('')
      setHighlighted(-1)
    }
  }

  return (
    <div className="guess">
      <input
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls="guess-options"
        aria-autocomplete="list"
        className="guess__input"
        placeholder="Guess a Telugu film…"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlighted(-1)
        }}
        onKeyDown={onKeyDown}
      />

      {query.trim() !== '' && matches.length === 0 && (
        <p className="guess__empty">No Telugu film found for that.</p>
      )}

      {matches.length > 0 && (
        <ul className="guess__options" id="guess-options" role="listbox">
          {matches.map((film, i) => {
            const already = guessed.has(film.id)
            return (
              <li
                key={film.id}
                role="option"
                aria-selected={i === highlighted}
                aria-disabled={already}
                className={`guess__option${already ? ' guess__option--used' : ''}${
                  i === highlighted ? ' guess__option--active' : ''
                }`}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(film)}
              >
                <span>{film.title}</span>
                <span className="guess__year">{film.year}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
