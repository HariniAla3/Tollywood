import { FIRST_YEAR, LAST_YEAR, type FilmCandidate } from './types'

export function isGuessable(c: FilmCandidate): boolean {
  return (
    c.year >= FIRST_YEAR &&
    c.year <= LAST_YEAR &&
    c.director !== null &&
    c.cast.length >= 3 &&
    c.genres.length >= 1
  )
}

/**
 * Recognition is gated on vote_count, never popularity: TMDB popularity is a
 * trending score that ranks recent obscurities above Pushpa.
 *
 * A music director is required. That is only affordable because toCandidate()
 * resolves the composer across several crew-job spellings -- searching just
 * "Original Music Composer" would drop Athadu, Dookudu and Nannaku Prematho.
 */
export function isMysteryEligible(c: FilmCandidate, voteFloor: number): boolean {
  return (
    isGuessable(c) &&
    c.cast.length >= 6 &&
    c.musicDirector !== null &&
    c.voteCount >= voteFloor
  )
}
