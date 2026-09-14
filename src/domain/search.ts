import type { Film } from './types'

export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Lower is better. Infinity means no match. */
function score(film: Film, query: string): number {
  const haystacks = [film.title, film.titleTelugu ?? '', ...film.aliases]
    .filter(Boolean)
    .map(normalizeTitle)

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
  const q = normalizeTitle(query)
  if (q === '') return []

  return films
    .map((film) => ({ film, rank: score(film, q) }))
    .filter((x) => x.rank !== Infinity)
    .sort((a, b) => a.rank - b.rank || b.film.voteCount - a.film.voteCount)
    .slice(0, limit)
    .map((x) => x.film)
}
