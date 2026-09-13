import { CAST_DEPTH, type FilmCandidate, type Person } from '../src/domain/types'

const BASE = 'https://api.themoviedb.org/3'

export type TmdbMovie = {
  id: number
  title: string
  original_title: string
  release_date: string
  genre_ids: number[]
  poster_path: string | null
  popularity: number
  vote_count: number
}

export type TmdbCredits = {
  cast: { id: number; name: string; order: number }[]
  crew: { id: number; name: string; job: string }[]
}

async function get<T>(apiKey: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path)
  url.searchParams.set('api_key', apiKey)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url)
    if (res.ok) return (await res.json()) as T
    if (res.status === 429) {
      // TMDB rate limit: back off and retry.
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }
    throw new Error(`TMDB ${res.status} for ${path}`)
  }
  throw new Error(`TMDB rate limit exhausted for ${path}`)
}

export async function fetchGenreMap(apiKey: string): Promise<Map<number, string>> {
  const data = await get<{ genres: { id: number; name: string }[] }>(
    apiKey,
    '/genre/movie/list',
    { language: 'en-US' },
  )
  return new Map(data.genres.map((g) => [g.id, g.name]))
}

/** All Telugu-language films released in a single year, across every page. */
export async function discoverTeluguFilms(apiKey: string, year: number): Promise<TmdbMovie[]> {
  const out: TmdbMovie[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const data = await get<{ results: TmdbMovie[]; total_pages: number }>(
      apiKey,
      '/discover/movie',
      {
        with_original_language: 'te',
        primary_release_year: String(year),
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: String(page),
      },
    )
    out.push(...data.results)
    totalPages = Math.min(data.total_pages, 500)
    page++
  }
  return out
}

export async function fetchCredits(apiKey: string, tmdbId: number): Promise<TmdbCredits> {
  return get<TmdbCredits>(apiKey, `/movie/${tmdbId}/credits`, {})
}

/**
 * Composer job spellings in priority order. TMDB credits Indian composers
 * under "Music" or "Music Director" far more often than under the canonical
 * "Original Music Composer": searching only the canonical job finds a
 * composer on 55% of Telugu films, this list finds one on 97%.
 *
 * Deliberately absent: Playback Singer (a singer, not the composer -- and the
 * most common music job on these films), Music Programmer, Music Arranger,
 * and every Sound department job.
 */
const COMPOSER_JOBS = [
  'Original Music Composer',
  'Music',
  'Music Director',
  'Composer',
] as const

function crewMember(credits: TmdbCredits, job: string): Person | null {
  const found = credits.crew.find((c) => c.job === job)
  return found ? { id: found.id, name: found.name } : null
}

function composer(credits: TmdbCredits): Person | null {
  for (const job of COMPOSER_JOBS) {
    const found = crewMember(credits, job)
    if (found) return found
  }
  return null
}

export function toCandidate(
  movie: TmdbMovie,
  credits: TmdbCredits,
  genreNames: Map<number, string>,
): FilmCandidate {
  const year = movie.release_date ? Number(movie.release_date.slice(0, 4)) : 0

  return {
    id: `f_${movie.id}`,
    tmdbId: movie.id,
    title: movie.title,
    titleTelugu: movie.original_title !== movie.title ? movie.original_title : null,
    aliases: [],
    year,
    genres: movie.genre_ids
      .map((id) => genreNames.get(id))
      .filter((n): n is string => n !== undefined),
    director: crewMember(credits, 'Director'),
    musicDirector: composer(credits),
    cast: [...credits.cast]
      .sort((a, b) => a.order - b.order)
      .slice(0, CAST_DEPTH)
      .map((c) => ({ id: c.id, name: c.name })),
    posterPath: movie.poster_path,
    popularity: movie.popularity,
    voteCount: movie.vote_count,
  }
}
