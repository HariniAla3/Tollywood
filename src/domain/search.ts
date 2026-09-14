import type { Film } from './types'

export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Telugu titles are transliterated inconsistently, and TMDB's spelling often
 * is not the one people type: "Bāhubali" normalises to "bahubali" while
 * everyone types "baahubali"; TMDB has "Aarya 2" for the film usually written
 * "Arya 2"; "Dookudu" is also written "Dokudu". Collapsing runs of the same
 * vowel makes all of those agree, on both sides of the comparison.
 */
export function searchKey(s: string): string {
  return normalizeTitle(s).replace(/([aeiou])\1+/g, '$1')
}

/** Lower is better. Infinity means no match. */
function score(film: Film, query: string): number {
  const haystacks = [film.title, film.titleTelugu ?? '', ...film.aliases]
    .filter(Boolean)
    .map(searchKey)

  let best = Infinity
  for (const h of haystacks) {
    if (h === query) best = Math.min(best, 0)
    else if (h.startsWith(query)) best = Math.min(best, 1)
    else if (h.split(' ').some((w) => w.startsWith(query))) best = Math.min(best, 2)
    else if (h.includes(query)) best = Math.min(best, 3)
  }
  return best
}

export function searchFilms(films: Film[], query: string, limit = 8): Film[] {
  const q = searchKey(query)
  if (q === '') return []

  return films
    .map((film) => ({ film, rank: score(film, q) }))
    .filter((x) => x.rank !== Infinity)
    .sort((a, b) => a.rank - b.rank || b.film.voteCount - a.film.voteCount)
    .slice(0, limit)
    .map((x) => x.film)
}
