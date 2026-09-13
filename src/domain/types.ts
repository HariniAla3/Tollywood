export const FIRST_YEAR = 2005
export const LAST_YEAR = 2025

/** Number of answer cast members that get their own board cell. */
export const CAST_CELLS = 6

/** How many billed cast we store per film; used for elimination. */
export const CAST_DEPTH = 10

export type Person = { id: number; name: string }

/** A film as fetched, before pool gates have been applied. */
export type FilmCandidate = {
  id: string
  tmdbId: number
  title: string
  titleTelugu: string | null
  aliases: string[]
  year: number
  genres: string[]
  director: Person | null
  musicDirector: Person | null
  cast: Person[]
  posterPath: string | null
  popularity: number
  /** TMDB rating count -- our recognition signal, never `popularity`. */
  voteCount: number
}

/**
 * A film that passed the guessable gate and lives in films.json.
 * Presence in the file is guessability, so there is no isGuessable flag.
 */
export type Film = Omit<FilmCandidate, 'director'> & {
  director: Person
  isMysteryEligible: boolean
}
