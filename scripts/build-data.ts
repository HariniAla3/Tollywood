import 'dotenv/config'
import { writeFileSync, readFileSync } from 'node:fs'
import { FIRST_YEAR, LAST_YEAR, type Film, type FilmCandidate } from '../src/domain/types'
import { isGuessable, isMysteryEligible } from '../src/domain/gates'
import { discoverTeluguFilms, fetchCredits, fetchGenreMap, toCandidate } from './tmdb'
import {
  applyOverrides,
  buildCoverage,
  formatCoverage,
  VOTE_FLOOR,
  type OverrideMap,
} from './coverage'

/** Credits are fetched one film at a time; a little concurrency keeps it brief. */
const CONCURRENCY = 12

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) throw new Error('TMDB_API_KEY missing — copy .env.example to .env')

  const genreNames = await fetchGenreMap(apiKey)
  const overrides = JSON.parse(readFileSync('src/data/overrides.json', 'utf8')) as OverrideMap

  const movies = []
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const found = await discoverTeluguFilms(apiKey, year)
    process.stdout.write(`  ${year}: ${found.length} films\n`)
    movies.push(...found)
  }

  // TMDB can return the same film under more than one release year.
  const unique = [...new Map(movies.map((m) => [m.id, m])).values()]

  const candidates: FilmCandidate[] = await mapLimit(unique, CONCURRENCY, async (movie) => {
    const credits = await fetchCredits(apiKey, movie.id)
    return applyOverrides(toCandidate(movie, credits, genreNames), overrides)
  })

  const coverage = buildCoverage(candidates, VOTE_FLOOR)
  process.stdout.write(formatCoverage(coverage))

  const films: Film[] = candidates.filter(isGuessable).map((c) => ({
    ...c,
    director: c.director!,
    isMysteryEligible: isMysteryEligible(c, VOTE_FLOOR),
  }))

  films.sort((a, b) => a.id.localeCompare(b.id))
  writeFileSync('src/data/films.json', JSON.stringify(films))
  process.stdout.write(`  Wrote src/data/films.json (${films.length} films)\n\n`)

  if (!coverage.meetsThresholds) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
