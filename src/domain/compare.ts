import { CAST_CELLS, type Film, type Person } from './types'

export type Reveal =
  | { kind: 'year'; relation: 'exact' | 'earlier' | 'later'; guessYear: number }
  | { kind: 'genre'; slot: number; genre: string }
  | { kind: 'cast'; slot: number; person: Person }
  | { kind: 'crew'; role: 'director' | 'musicDirector'; person: Person }

export type GuessOutcome = {
  guessId: string
  correct: boolean
  reveals: Reveal[]
  /** People in the guess confirmed absent from the answer. */
  eliminated: Person[]
}

/** Everyone credited on a film, for presence checks. */
function everyone(f: Film): Person[] {
  const out = [...f.cast, f.director]
  if (f.musicDirector) out.push(f.musicDirector)
  return out
}

export function compareFilms(guess: Film, answer: Film): GuessOutcome {
  const reveals: Reveal[] = []

  if (guess.year === answer.year) {
    reveals.push({ kind: 'year', relation: 'exact', guessYear: guess.year })
  } else {
    reveals.push({
      kind: 'year',
      relation: guess.year < answer.year ? 'later' : 'earlier',
      guessYear: guess.year,
    })
  }

  const guessGenres = new Set(guess.genres)
  answer.genres.forEach((genre, slot) => {
    if (guessGenres.has(genre)) reveals.push({ kind: 'genre', slot, genre })
  })

  const guessCastIds = new Set(guess.cast.map((c) => c.id))
  answer.cast.slice(0, CAST_CELLS).forEach((person, slot) => {
    if (guessCastIds.has(person.id)) reveals.push({ kind: 'cast', slot, person })
  })

  if (guess.director.id === answer.director.id) {
    reveals.push({ kind: 'crew', role: 'director', person: answer.director })
  }
  if (
    guess.musicDirector &&
    answer.musicDirector &&
    guess.musicDirector.id === answer.musicDirector.id
  ) {
    reveals.push({ kind: 'crew', role: 'musicDirector', person: answer.musicDirector })
  }

  // A person is ruled out only if they are absent from the answer entirely --
  // an actor billed below the cell cutoff is still in the film, so they stay
  // unknown rather than becoming a false elimination.
  const answerIds = new Set(everyone(answer).map((p) => p.id))
  const eliminated: Person[] = []
  const seen = new Set<number>()
  for (const person of everyone(guess)) {
    if (answerIds.has(person.id) || seen.has(person.id)) continue
    seen.add(person.id)
    eliminated.push(person)
  }

  return { guessId: guess.id, correct: guess.id === answer.id, reveals, eliminated }
}
