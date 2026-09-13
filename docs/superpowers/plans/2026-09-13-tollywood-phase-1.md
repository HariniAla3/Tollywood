# Tollywood Daily — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable daily Telugu-film deduction game — guess the mystery film in 7 attempts, where each guess reveals only the attributes it shares with the answer.

**Architecture:** A static React site with no backend and no runtime network calls. Two Node scripts run on a laptop pull film data from TMDB and assign a film to each date, writing two JSON files that are committed to the repo and imported by the app like any other module. All game rules live in pure, framework-free modules under `src/domain/`, tested directly with Vitest; React only renders their output.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, React Testing Library, `tsx` for scripts, Vercel for hosting. No runtime dependencies beyond React.

**Spec:** `docs/superpowers/specs/2026-09-13-tollywood-daily-game-design.md`

## Global Constraints

- **Film window: 2005-01-01 → 2025-12-31.** Both guessable and answer pools.
- **TMDB is the only data source.** No second source, no fallback pipeline.
- **People are compared by TMDB person id, never by name.**
- **Day boundary is midnight IST (`Asia/Kolkata`)**, not the viewer's timezone.
- **Guess limit is 7**, extendable to 10 by lifeline. Cast cells: 6.
- **Past puzzle dates are frozen.** Regeneration only rewrites dates strictly after today.
- **No runtime network calls and no backend.** `films.json` and `schedule.json` are build-time artifacts.
- **The TMDB API key lives in `.env` and is used only by scripts.** It must never appear in the client bundle.
- **Attribution required:** "This product uses the TMDB API but is not endorsed or certified by TMDB." in the footer.
- **Thresholds that gate the project:** ≥1500 guessable films, ≥300 answer-eligible. **Already measured against live TMDB on 2026-09-13: 1663 guessable, 395 answer-eligible.** Task 3 re-verifies; a large drop means something broke.
- **Answer recognition is gated on `vote_count >= 10`, never on `popularity`** — TMDB popularity is a trending score and ranks obscure recent films above *Pushpa*.
- **Music director IS required for answers**, resolved across the ordered crew-job list `Original Music Composer` → `Music` → `Music Director` → `Composer`. **`Playback Singer` is never a composer** — it is the most common music job on these films and accepting it would credit *Athadu* to S. P. Balasubramaniam.
- **Measured final pools: 1663 guessable, 395 answer-eligible**, every answer board carrying all 12 cell types.

### Deliberate deviations from the spec

Two, both simplifications, flagged here so reviewers do not treat them as drift:

1. **`films.json` contains only gate-passing films, so `Film` has no `isGuessable` field.** Presence in the file *is* guessability. The spec's record lists the flag; emitting a field that is always `true` is dead weight in every row.
2. **`cast` is truncated to the top 10 billed at build time.** Cells use the first 6; elimination uses all 10. Storing full casts (often 30+) would multiply the file size for people no rule ever consults.

---

## File Structure

```
scripts/
  tmdb.ts              TMDB HTTP client + raw→candidate mapping
  build-data.ts        fetch → overrides → gates → films.json + coverage report
  build-schedule.ts    seeded shuffle over answer pool → schedule.json
src/
  domain/              pure logic, no React, no I/O
    types.ts           Film, Person, and the shared vocabulary
    gates.ts           pool eligibility predicates
    rng.ts             seeded PRNG + Fisher–Yates
    puzzleDate.ts      IST day boundary, puzzle numbering
    compare.ts         guess × answer → reveals + eliminations
    board.ts           board construction and cell state
    ruledOut.ts        accumulate eliminated people
    lifelines.ts       lifeline availability and guess limits
    session.ts         the game state machine; replay from persisted form
    search.ts          title normalization and autocomplete matching
    share.ts           board → emoji share card
  data/
    films.json         generated — do not hand-edit
    schedule.json      generated — do not hand-edit
    overrides.json     hand-maintained corrections, survives regeneration
    repository.ts      the only reader of the JSON files
  storage/
    types.ts           GameStorage interface, PersistedSession, Stats
    localStorage.ts    the Phase 1 implementation
  ui/
    App.tsx            wiring and layout
    Board.tsx, Cell.tsx
    GuessInput.tsx, GuessHistory.tsx
    RuledOutPanel.tsx, LifelineBar.tsx
    ResultModal.tsx, ArchiveList.tsx, Footer.tsx
```

`compare.ts` is the heart of the game and gets the heaviest test coverage.

---

## Task 1: Scaffold, domain types, and pool gates

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `.env.example`
- Create: `src/domain/types.ts`
- Create: `src/domain/gates.ts`
- Test: `src/domain/gates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Person`, `FilmCandidate`, `Film`, `CAST_CELLS`, `CAST_DEPTH`, `FIRST_YEAR`, `LAST_YEAR`, `isGuessable(c: FilmCandidate): boolean`, `isMysteryEligible(c: FilmCandidate, voteFloor: number): boolean`.

- [ ] **Step 1: Scaffold the project**

```bash
cd /Users/hariniala/Projects/Tollywood
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx dotenv
```

- [ ] **Step 2: Configure Vitest**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"build:data": "tsx scripts/build-data.ts",
"build:schedule": "tsx scripts/build-schedule.ts"
```

Create `.env.example`:

```
TMDB_API_KEY=your_key_here
```

Add `.env` to `.gitignore` (already present from the spec commit — verify).

- [ ] **Step 3: Write the domain types**

Create `src/domain/types.ts`:

```ts
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
  /** TMDB rating count -- our recognition signal. See Global Constraints. */
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
```

- [ ] **Step 4: Write the failing gate tests**

Create `src/domain/gates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isGuessable, isMysteryEligible } from './gates'
import type { FilmCandidate, Person } from './types'

const person = (id: number): Person => ({ id, name: `Person ${id}` })

const candidate = (over: Partial<FilmCandidate> = {}): FilmCandidate => ({
  id: 'f_1',
  tmdbId: 1,
  title: 'Test Film',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: person(100),
  musicDirector: person(200),
  cast: [person(1), person(2), person(3), person(4), person(5), person(6)],
  posterPath: '/p.jpg',
  popularity: 50,
  voteCount: 50,
  ...over,
})

describe('isGuessable', () => {
  it('accepts a complete film', () => {
    expect(isGuessable(candidate())).toBe(true)
  })

  it('rejects a film with no director', () => {
    expect(isGuessable(candidate({ director: null }))).toBe(false)
  })

  it('rejects a film with fewer than 3 credited cast', () => {
    expect(isGuessable(candidate({ cast: [person(1), person(2)] }))).toBe(false)
  })

  it('rejects a film with no genres', () => {
    expect(isGuessable(candidate({ genres: [] }))).toBe(false)
  })

  it('accepts a film with a single genre', () => {
    expect(isGuessable(candidate({ genres: ['Action'] }))).toBe(true)
  })

  it('rejects a film outside the year window', () => {
    expect(isGuessable(candidate({ year: 2004 }))).toBe(false)
    expect(isGuessable(candidate({ year: 2026 }))).toBe(false)
  })

  it('does not require a music director', () => {
    expect(isGuessable(candidate({ musicDirector: null }))).toBe(true)
  })
})

describe('isMysteryEligible', () => {
  it('accepts a complete, well-known film', () => {
    expect(isMysteryEligible(candidate(), 10)).toBe(true)
  })

  it('requires a music director', () => {
    expect(isMysteryEligible(candidate({ musicDirector: null }), 10)).toBe(false)
  })

  it('requires at least 6 credited cast', () => {
    const five = [1, 2, 3, 4, 5].map(person)
    expect(isMysteryEligible(candidate({ cast: five }), 10)).toBe(false)
  })

  // Requiring two genres was measured to exclude Magadheera and Happy Days.
  it('accepts a film with a single genre', () => {
    expect(isMysteryEligible(candidate({ genres: ['Action'] }), 10)).toBe(true)
  })

  it('rejects films below the vote floor', () => {
    expect(isMysteryEligible(candidate({ voteCount: 9 }), 10)).toBe(false)
  })

  it('accepts films exactly at the vote floor', () => {
    expect(isMysteryEligible(candidate({ voteCount: 10 }), 10)).toBe(true)
  })

  it('ignores popularity entirely', () => {
    expect(isMysteryEligible(candidate({ popularity: 0 }), 10)).toBe(true)
  })

  it('rejects anything that is not guessable', () => {
    expect(isMysteryEligible(candidate({ director: null }), 10)).toBe(false)
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npm test -- src/domain/gates.test.ts`
Expected: FAIL — `Failed to resolve import "./gates"`

- [ ] **Step 6: Implement the gates**

Create `src/domain/gates.ts`:

```ts
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
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -- src/domain/gates.test.ts`
Expected: PASS, 15 tests

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold project with domain types and pool gates"
```

---

## Task 2: TMDB client

**Files:**
- Create: `scripts/tmdb.ts`
- Test: `scripts/tmdb.test.ts`

**Interfaces:**
- Consumes: `FilmCandidate`, `Person`, `CAST_DEPTH` from `src/domain/types`.
- Produces: `toCandidate(movie: TmdbMovie, credits: TmdbCredits, genreNames: Map<number, string>): FilmCandidate`, `discoverTeluguFilms(apiKey: string, year: number): Promise<TmdbMovie[]>`, `fetchCredits(apiKey: string, tmdbId: number): Promise<TmdbCredits>`, `fetchGenreMap(apiKey: string): Promise<Map<number, string>>`.

**Why fetch year by year:** TMDB's `discover` endpoint caps pagination at 500 pages but, more importantly, silently truncates large result sets. Querying one release year at a time keeps every slice comfortably small and makes partial failures easy to retry.

- [ ] **Step 1: Write the failing mapping test**

Create `scripts/tmdb.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toCandidate } from './tmdb'

const genreNames = new Map([[28, 'Action'], [18, 'Drama'], [35, 'Comedy']])

const movie = {
  id: 447365,
  title: 'Rangasthalam',
  original_title: 'రంగస్థలం',
  release_date: '2018-03-30',
  genre_ids: [28, 18],
  poster_path: '/poster.jpg',
  popularity: 42.5,
  vote_count: 85,
}

const credits = {
  cast: [
    { id: 1, name: 'Ram Charan', order: 0 },
    { id: 2, name: 'Samantha', order: 1 },
    { id: 3, name: 'Aadhi Pinisetty', order: 2 },
  ],
  crew: [
    { id: 10, name: 'Sukumar', job: 'Director' },
    { id: 11, name: 'Devi Sri Prasad', job: 'Original Music Composer' },
    { id: 12, name: 'Somebody Else', job: 'Producer' },
  ],
}

describe('toCandidate', () => {
  it('maps core fields', () => {
    const c = toCandidate(movie, credits, genreNames)
    expect(c.id).toBe('f_447365')
    expect(c.tmdbId).toBe(447365)
    expect(c.title).toBe('Rangasthalam')
    expect(c.year).toBe(2018)
    expect(c.posterPath).toBe('/poster.jpg')
    expect(c.popularity).toBe(42.5)
    expect(c.voteCount).toBe(85)
  })

  it('resolves genre ids to names in the order given', () => {
    expect(toCandidate(movie, credits, genreNames).genres).toEqual(['Action', 'Drama'])
  })

  it('drops genre ids it cannot resolve', () => {
    const m = { ...movie, genre_ids: [28, 9999] }
    expect(toCandidate(m, credits, genreNames).genres).toEqual(['Action'])
  })

  it('keeps the original title as titleTelugu only when it differs', () => {
    expect(toCandidate(movie, credits, genreNames).titleTelugu).toBe('రంగస్థలం')
    const same = { ...movie, original_title: 'Rangasthalam' }
    expect(toCandidate(same, credits, genreNames).titleTelugu).toBeNull()
  })

  it('sorts cast by billing order and caps at CAST_DEPTH', () => {
    const many = {
      cast: Array.from({ length: 15 }, (_, i) => ({
        id: 100 + i,
        name: `Actor ${i}`,
        order: 14 - i,
      })),
      crew: credits.crew,
    }
    const c = toCandidate(movie, many, genreNames)
    expect(c.cast).toHaveLength(10)
    expect(c.cast[0]).toEqual({ id: 114, name: 'Actor 14' })
  })

  it('extracts the director', () => {
    expect(toCandidate(movie, credits, genreNames).director).toEqual({
      id: 10,
      name: 'Sukumar',
    })
  })

  it('extracts the music director from Original Music Composer', () => {
    expect(toCandidate(movie, credits, genreNames).musicDirector).toEqual({
      id: 11,
      name: 'Devi Sri Prasad',
    })
  })

  // TMDB credits Indian composers under "Music" far more often than under
  // "Original Music Composer" -- this is how Athadu and Dookudu are recovered.
  it('falls back to the Music job', () => {
    const crew = [
      { id: 10, name: 'Sukumar', job: 'Director' },
      { id: 20, name: 'Mani Sharma', job: 'Music' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector)
      .toEqual({ id: 20, name: 'Mani Sharma' })
  })

  it('falls back to the Music Director job', () => {
    const crew = [{ id: 21, name: 'Keeravani', job: 'Music Director' }]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector)
      .toEqual({ id: 21, name: 'Keeravani' })
  })

  it('prefers Original Music Composer over the fallbacks', () => {
    const crew = [
      { id: 20, name: 'Wrong Person', job: 'Music' },
      { id: 11, name: 'Devi Sri Prasad', job: 'Original Music Composer' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector?.id)
      .toBe(11)
  })

  // Playback Singer is the most common music job on these films. Accepting it
  // would credit Athadu to S. P. Balasubramaniam instead of Mani Sharma.
  it('never treats a Playback Singer as the composer', () => {
    const crew = [
      { id: 30, name: 'S. P. Balasubramaniam', job: 'Playback Singer' },
      { id: 31, name: 'Someone', job: 'Music Programmer' },
      { id: 32, name: 'Another', job: 'Music Arranger' },
      { id: 33, name: 'Third', job: 'Sound Designer' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector)
      .toBeNull()
  })

  it('returns null crew when the job is absent', () => {
    const c = toCandidate(movie, { cast: credits.cast, crew: [] }, genreNames)
    expect(c.director).toBeNull()
    expect(c.musicDirector).toBeNull()
  })

  it('takes the first credit when a job is listed twice', () => {
    const crew = [
      { id: 10, name: 'Sukumar', job: 'Director' },
      { id: 99, name: 'Co Director', job: 'Director' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).director?.id).toBe(10)
  })

  it('handles a missing release date as year 0', () => {
    const m = { ...movie, release_date: '' }
    expect(toCandidate(m, credits, genreNames).year).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- scripts/tmdb.test.ts`
Expected: FAIL — `Failed to resolve import "./tmdb"`

- [ ] **Step 3: Implement the client**

Create `scripts/tmdb.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- scripts/tmdb.test.ts`
Expected: PASS, 14 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TMDB client and candidate mapping"
```

---

## Task 3: build-data script and coverage report

**Files:**
- Create: `scripts/build-data.ts`
- Create: `src/data/overrides.json`
- Create: `scripts/coverage.ts`
- Test: `scripts/coverage.test.ts`

**Interfaces:**
- Consumes: `discoverTeluguFilms`, `fetchCredits`, `fetchGenreMap`, `toCandidate` from `scripts/tmdb`; `isGuessable`, `isMysteryEligible` from `src/domain/gates`.
- Produces: `applyOverrides(c: FilmCandidate, overrides: OverrideMap): FilmCandidate`, `buildCoverage(candidates: FilmCandidate[], voteFloor: number): Coverage`, `formatCoverage(c: Coverage): string`, and the generated `src/data/films.json`.

**This is the project's first real deliverable.** The coverage report is what decides whether the TMDB-only bet holds. Do not proceed past this task if the thresholds fail — escalate per spec §4.1 instead.

- [ ] **Step 1: Write the failing coverage tests**

Create `scripts/coverage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyOverrides, buildCoverage } from './coverage'
import type { FilmCandidate, Person } from '../src/domain/types'

const person = (id: number): Person => ({ id, name: `Person ${id}` })

const candidate = (over: Partial<FilmCandidate> = {}): FilmCandidate => ({
  id: 'f_1',
  tmdbId: 1,
  title: 'Test Film',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: person(100),
  musicDirector: person(200),
  cast: [1, 2, 3, 4, 5, 6].map(person),
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  ...over,
})

describe('applyOverrides', () => {
  it('returns the candidate unchanged when no override exists', () => {
    const c = candidate()
    expect(applyOverrides(c, {})).toEqual(c)
  })

  it('patches a missing music director', () => {
    const c = candidate({ musicDirector: null })
    const patched = applyOverrides(c, {
      f_1: { musicDirector: { id: 77, name: 'Thaman S' } },
    })
    expect(patched.musicDirector).toEqual({ id: 77, name: 'Thaman S' })
  })

  it('patches aliases used for search', () => {
    const patched = applyOverrides(candidate(), { f_1: { aliases: ['RGV'] } })
    expect(patched.aliases).toEqual(['RGV'])
  })

  it('leaves unpatched fields alone', () => {
    const patched = applyOverrides(candidate(), { f_1: { aliases: ['X'] } })
    expect(patched.title).toBe('Test Film')
    expect(patched.director).toEqual(person(100))
  })
})

describe('buildCoverage', () => {
  it('counts total, guessable, and answer-eligible films', () => {
    const cov = buildCoverage(
      [candidate({ id: 'a' }), candidate({ id: 'b', voteCount: 1 }), candidate({ id: 'c', director: null })],
      10,
    )
    expect(cov.total).toBe(3)
    expect(cov.guessable).toBe(2)
    expect(cov.mysteryEligible).toBe(1)
  })

  it('excludes a composerless film from the answer pool', () => {
    const cov = buildCoverage([candidate({ musicDirector: null })], 10)
    expect(cov.mysteryEligible).toBe(0)
  })

  it('reports how many answers were lost to a missing composer', () => {
    const cov = buildCoverage([candidate({ musicDirector: null }), candidate({ id: 'b' })], 10)
    expect(cov.lostToMissingComposer).toBe(1)
    expect(cov.mysteryEligible).toBe(1)
  })

  it('breaks down guess-gate rejections by reason', () => {
    const cov = buildCoverage(
      [
        candidate({ director: null }),
        candidate({ cast: [person(1)] }),
        candidate({ genres: [] }),
        candidate({ year: 1999 }),
      ],
      10,
    )
    expect(cov.rejected.noDirector).toBe(1)
    expect(cov.rejected.tooFewCast).toBe(1)
    expect(cov.rejected.noGenres).toBe(1)
    expect(cov.rejected.outOfWindow).toBe(1)
  })

  it('flags when thresholds are not met', () => {
    expect(buildCoverage([candidate()], 10).meetsThresholds).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- scripts/coverage.test.ts`
Expected: FAIL — `Failed to resolve import "./coverage"`

- [ ] **Step 3: Implement coverage and overrides**

Create `scripts/coverage.ts`:

```ts
import { isGuessable, isMysteryEligible } from '../src/domain/gates'
import { FIRST_YEAR, LAST_YEAR, type FilmCandidate } from '../src/domain/types'

export const MIN_GUESSABLE = 1500
export const MIN_MYSTERY = 300

/**
 * Measured 2026-09-13 against live TMDB: a floor of 10 votes gives 405
 * answers (over a year of puzzles) and ranks the way a fan would.
 */
export const VOTE_FLOOR = 10

export type OverrideMap = Record<string, Partial<FilmCandidate>>

export function applyOverrides(c: FilmCandidate, overrides: OverrideMap): FilmCandidate {
  const patch = overrides[c.id]
  return patch ? { ...c, ...patch } : c
}

export type Coverage = {
  total: number
  guessable: number
  mysteryEligible: number
  /** Would be answers, but no composer credit exists under any job name. */
  lostToMissingComposer: number
  rejected: {
    outOfWindow: number
    noDirector: number
    tooFewCast: number
    noGenres: number
  }
  meetsThresholds: boolean
}

export function buildCoverage(candidates: FilmCandidate[], voteFloor: number): Coverage {
  const rejected = { outOfWindow: 0, noDirector: 0, tooFewCast: 0, noGenres: 0 }
  let guessable = 0
  let mysteryEligible = 0
  let lostToMissingComposer = 0

  for (const c of candidates) {
    if (isGuessable(c)) {
      guessable++
      if (isMysteryEligible(c, voteFloor)) {
        mysteryEligible++
      } else if (c.musicDirector === null && c.cast.length >= 6 && c.voteCount >= voteFloor) {
        lostToMissingComposer++
      }
    } else {
      if (c.year < FIRST_YEAR || c.year > LAST_YEAR) rejected.outOfWindow++
      else if (c.director === null) rejected.noDirector++
      else if (c.cast.length < 3) rejected.tooFewCast++
      else if (c.genres.length < 1) rejected.noGenres++
    }
  }

  return {
    total: candidates.length,
    guessable,
    mysteryEligible,
    lostToMissingComposer,
    rejected,
    meetsThresholds: guessable >= MIN_GUESSABLE && mysteryEligible >= MIN_MYSTERY,
  }
}

export function formatCoverage(c: Coverage): string {
  return [
    '',
    '  TMDB COVERAGE REPORT',
    '  ─────────────────────────────────────────',
    `  Films returned            ${c.total}`,
    `  Guessable                 ${c.guessable}   (need ${MIN_GUESSABLE})`,
    `  Answer-eligible           ${c.mysteryEligible}   (need ${MIN_MYSTERY})`,
    '',
    `  Lost to a missing composer  ${c.lostToMissingComposer}   (measured: 10)`,
    '    ^ recoverable by adding them to src/data/overrides.json',
    '',
    '  Guess-gate rejections',
    `    outside 2005-2025       ${c.rejected.outOfWindow}`,
    `    no director             ${c.rejected.noDirector}`,
    `    fewer than 3 cast       ${c.rejected.tooFewCast}`,
    `    no genres               ${c.rejected.noGenres}`,
    '',
    c.meetsThresholds
      ? '  ✅ Thresholds met — proceed.'
      : '  ❌ Thresholds NOT met — stop and escalate per spec §4.1.',
    '',
  ].join('\n')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- scripts/coverage.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Create the empty overrides file**

Create `src/data/overrides.json`:

```json
{}
```

- [ ] **Step 6: Write the build script**

Create `scripts/build-data.ts`:

```ts
import 'dotenv/config'
import { writeFileSync, readFileSync } from 'node:fs'
import { FIRST_YEAR, LAST_YEAR, type Film, type FilmCandidate } from '../src/domain/types'
import { isGuessable, isMysteryEligible } from '../src/domain/gates'
import { discoverTeluguFilms, fetchCredits, fetchGenreMap, toCandidate } from './tmdb'
import { applyOverrides, buildCoverage, formatCoverage, type OverrideMap } from './coverage'


import { VOTE_FLOOR } from './coverage'

async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) throw new Error('TMDB_API_KEY missing — copy .env.example to .env')

  const genreNames = await fetchGenreMap(apiKey)
  const overrides = JSON.parse(
    readFileSync('src/data/overrides.json', 'utf8'),
  ) as OverrideMap

  const candidates: FilmCandidate[] = []

  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const movies = await discoverTeluguFilms(apiKey, year)
    process.stdout.write(`  ${year}: ${movies.length} films\n`)

    for (const movie of movies) {
      const credits = await fetchCredits(apiKey, movie.id)
      candidates.push(applyOverrides(toCandidate(movie, credits, genreNames), overrides))
    }
  }

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
```

- [ ] **Step 7: Run the build against real TMDB**

```bash
cp .env.example .env    # then paste the real key into .env
npm run build:data
```

Expected: a per-year progress log, then the coverage report. **Read the report before continuing.** If it prints `❌ Thresholds NOT met`, stop here and escalate per spec §4.1 rather than proceeding to Task 4.

This takes several minutes — it makes roughly one request per film for credits.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: build films.json from TMDB with coverage reporting"
```

---

## Task 4: Seeded schedule generation

**Files:**
- Create: `src/domain/rng.ts`
- Create: `scripts/build-schedule.ts`
- Test: `src/domain/rng.test.ts`
- Test: `scripts/build-schedule.test.ts`

**Interfaces:**
- Consumes: `Film` from `src/domain/types`.
- Produces: `makeRng(seed: number): () => number`, `shuffled<T>(items: T[], rng: () => number): T[]`, `buildSchedule(opts: ScheduleOptions): Record<string, string>`, and the generated `src/data/schedule.json`.

- [ ] **Step 1: Write the failing RNG tests**

Create `src/domain/rng.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeRng, shuffled } from './rng'

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produces different sequences for different seeds', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)())
  })

  it('stays within [0, 1)', () => {
    const rng = makeRng(7)
    for (let i = 0; i < 500; i++) {
      const n = rng()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
})

describe('shuffled', () => {
  it('keeps every element exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect([...shuffled(items, makeRng(3))].sort((a, b) => a - b)).toEqual(items)
  })

  it('does not mutate the input', () => {
    const items = [1, 2, 3, 4, 5]
    shuffled(items, makeRng(3))
    expect(items).toEqual([1, 2, 3, 4, 5])
  })

  it('is deterministic for a given seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffled(items, makeRng(9))).toEqual(shuffled(items, makeRng(9)))
  })

  it('actually reorders', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    expect(shuffled(items, makeRng(11))).not.toEqual(items)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/domain/rng.test.ts`
Expected: FAIL — `Failed to resolve import "./rng"`

- [ ] **Step 3: Implement the RNG**

Create `src/domain/rng.ts`:

```ts
/** mulberry32 — small, fast, deterministic across platforms. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates over a copy. */
export function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/domain/rng.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Write the failing schedule tests**

Create `scripts/build-schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSchedule } from './build-schedule'

const ids = ['f_1', 'f_2', 'f_3', 'f_4']

describe('buildSchedule', () => {
  it('assigns one film to every date in the range', () => {
    const s = buildSchedule({
      answerIds: ids,
      existing: {},
      today: '2026-01-01',
      from: '2026-01-01',
      days: 4,
      seed: 1,
    })
    expect(Object.keys(s)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
  })

  it('never repeats a film within one cycle', () => {
    const s = buildSchedule({
      answerIds: ids,
      existing: {},
      today: '2026-01-01',
      from: '2026-01-01',
      days: 4,
      seed: 1,
    })
    expect(new Set(Object.values(s)).size).toBe(4)
  })

  it('cycles with a fresh shuffle once the pool is exhausted', () => {
    const s = buildSchedule({
      answerIds: ids,
      existing: {},
      today: '2026-01-01',
      from: '2026-01-01',
      days: 8,
      seed: 1,
    })
    expect(Object.keys(s)).toHaveLength(8)
    expect(new Set(Object.values(s)).size).toBe(4)
  })

  it('is deterministic for a given seed', () => {
    const opts = { answerIds: ids, existing: {}, today: '2026-01-01', from: '2026-01-01', days: 6, seed: 5 }
    expect(buildSchedule(opts)).toEqual(buildSchedule(opts))
  })

  it('freezes dates on or before today', () => {
    const existing = { '2026-01-01': 'f_9', '2026-01-02': 'f_8' }
    const s = buildSchedule({
      answerIds: ids,
      existing,
      today: '2026-01-02',
      from: '2026-01-01',
      days: 4,
      seed: 3,
    })
    expect(s['2026-01-01']).toBe('f_9')
    expect(s['2026-01-02']).toBe('f_8')
  })

  it('rewrites future dates even when they already exist', () => {
    const existing = { '2026-01-03': 'f_9' }
    const s = buildSchedule({
      answerIds: ids,
      existing,
      today: '2026-01-02',
      from: '2026-01-01',
      days: 4,
      seed: 3,
    })
    expect(s['2026-01-03']).not.toBe('f_9')
  })

  it('does not reuse a frozen film later in the same cycle', () => {
    const existing = { '2026-01-01': 'f_3' }
    const s = buildSchedule({
      answerIds: ids,
      existing,
      today: '2026-01-01',
      from: '2026-01-01',
      days: 4,
      seed: 3,
    })
    const future = ['2026-01-02', '2026-01-03', '2026-01-04'].map((d) => s[d])
    expect(future).not.toContain('f_3')
  })

  it('throws when the answer pool is empty', () => {
    expect(() =>
      buildSchedule({ answerIds: [], existing: {}, today: '2026-01-01', from: '2026-01-01', days: 1, seed: 1 }),
    ).toThrow(/empty/i)
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- scripts/build-schedule.test.ts`
Expected: FAIL — `Failed to resolve import "./build-schedule"`

- [ ] **Step 7: Implement the schedule builder**

Create `scripts/build-schedule.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { makeRng, shuffled } from '../src/domain/rng'
import type { Film } from '../src/domain/types'

export type Schedule = Record<string, string>

export type ScheduleOptions = {
  answerIds: string[]
  existing: Schedule
  today: string
  from: string
  days: number
  seed: number
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function buildSchedule(opts: ScheduleOptions): Schedule {
  const { answerIds, existing, today, from, days, seed } = opts
  if (answerIds.length === 0) throw new Error('Answer pool is empty')

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
  const out: Schedule = {}

  // Frozen dates keep their film and consume it from the current cycle.
  const frozen = new Set<string>()
  for (const date of dates) {
    if (date <= today && existing[date]) {
      out[date] = existing[date]
      frozen.add(existing[date])
    }
  }

  const rng = makeRng(seed)
  let pool = shuffled(answerIds, rng).filter((id) => !frozen.has(id))
  let cursor = 0

  for (const date of dates) {
    if (out[date]) continue
    if (cursor >= pool.length) {
      pool = shuffled(answerIds, rng)
      cursor = 0
    }
    out[date] = pool[cursor++]
  }

  return out
}

function main() {
  const films = JSON.parse(readFileSync('src/data/films.json', 'utf8')) as Film[]
  const answerIds = films.filter((f) => f.isMysteryEligible).map((f) => f.id)

  let existing: Schedule = {}
  try {
    existing = JSON.parse(readFileSync('src/data/schedule.json', 'utf8')) as Schedule
  } catch {
    // First run — no schedule yet.
  }

  const today = new Date().toISOString().slice(0, 10)
  const schedule = buildSchedule({
    answerIds,
    existing,
    today,
    from: '2026-01-01',
    days: 365 * 3,
    seed: 20260913,
  })

  writeFileSync('src/data/schedule.json', JSON.stringify(schedule, null, 0))
  process.stdout.write(
    `  Wrote src/data/schedule.json — ${Object.keys(schedule).length} dates from a pool of ${answerIds.length}\n`,
  )
}

// Only run when invoked directly, so tests can import buildSchedule.
if (process.argv[1]?.endsWith('build-schedule.ts')) main()
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- scripts/build-schedule.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 9: Generate the real schedule**

```bash
npm run build:schedule
```

Expected: `Wrote src/data/schedule.json — 1095 dates from a pool of N`

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add seeded daily schedule generation with frozen past dates"
```

---

## Task 5: IST puzzle dates and the data repository

**Files:**
- Create: `src/domain/puzzleDate.ts`
- Create: `src/data/repository.ts`
- Test: `src/domain/puzzleDate.test.ts`

**Interfaces:**
- Consumes: `Film` from `src/domain/types`; the generated `films.json` and `schedule.json`.
- Produces: `EPOCH_DATE`, `istDateString(now: Date): string`, `puzzleNumber(date: string): number`, `addDays(date: string, n: number): string`; and from the repository — `getFilm(id: string): Film | undefined`, `guessableFilms(): Film[]`, `answerIdForDate(date: string): string | null`, `playableDates(today: string): string[]`.

**Why the repository exists:** it is the single seam between game code and stored data. Nothing else imports the JSON files. Swapping to a database later touches this file only.

- [ ] **Step 1: Write the failing date tests**

Create `src/domain/puzzleDate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { istDateString, puzzleNumber, addDays, EPOCH_DATE } from './puzzleDate'

describe('istDateString', () => {
  it('converts a UTC morning to the same IST day', () => {
    expect(istDateString(new Date('2026-09-13T06:00:00Z'))).toBe('2026-09-13')
  })

  it('rolls over to the next day at 18:30 UTC', () => {
    expect(istDateString(new Date('2026-09-13T18:29:00Z'))).toBe('2026-09-13')
    expect(istDateString(new Date('2026-09-13T18:30:00Z'))).toBe('2026-09-14')
  })

  it('treats late UTC evening as the following IST day', () => {
    expect(istDateString(new Date('2026-09-13T23:45:00Z'))).toBe('2026-09-14')
  })

  it('handles the turn of the year', () => {
    expect(istDateString(new Date('2025-12-31T19:00:00Z'))).toBe('2026-01-01')
  })

  it('handles a leap day', () => {
    expect(istDateString(new Date('2028-02-28T19:00:00Z'))).toBe('2028-02-29')
  })
})

describe('puzzleNumber', () => {
  it('numbers the epoch as puzzle 1', () => {
    expect(puzzleNumber(EPOCH_DATE)).toBe(1)
  })

  it('increments by one per day', () => {
    expect(puzzleNumber('2026-01-02')).toBe(2)
    expect(puzzleNumber('2026-01-31')).toBe(31)
  })

  it('counts across month boundaries', () => {
    expect(puzzleNumber('2026-02-01')).toBe(32)
  })
})

describe('addDays', () => {
  it('advances a date', () => {
    expect(addDays('2026-09-13', 1)).toBe('2026-09-14')
  })

  it('goes backwards with a negative count', () => {
    expect(addDays('2026-09-13', -1)).toBe('2026-09-12')
  })

  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/domain/puzzleDate.test.ts`
Expected: FAIL — `Failed to resolve import "./puzzleDate"`

- [ ] **Step 3: Implement the date helpers**

Create `src/domain/puzzleDate.ts`:

```ts
/** Puzzle #1. Everything is numbered from here. */
export const EPOCH_DATE = '2026-01-01'

/** IST is a fixed UTC+5:30 — no daylight saving, so a constant offset is correct. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** The calendar date in Asia/Kolkata at the given instant, as YYYY-MM-DD. */
export function istDateString(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

function toUtcMidnight(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`)
}

export function puzzleNumber(date: string): number {
  return Math.round((toUtcMidnight(date) - toUtcMidnight(EPOCH_DATE)) / DAY_MS) + 1
}

export function addDays(isoDate: string, n: number): string {
  return new Date(toUtcMidnight(isoDate) + n * DAY_MS).toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/domain/puzzleDate.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Implement the repository**

Create `src/data/repository.ts`:

```ts
import type { Film } from '../domain/types'
import { EPOCH_DATE, addDays } from '../domain/puzzleDate'
import filmsJson from './films.json'
import scheduleJson from './schedule.json'

const films = filmsJson as Film[]
const schedule = scheduleJson as Record<string, string>

const byId = new Map(films.map((f) => [f.id, f]))

export function getFilm(id: string): Film | undefined {
  return byId.get(id)
}

export function guessableFilms(): Film[] {
  return films
}

export function answerIdForDate(date: string): string | null {
  return schedule[date] ?? null
}

/** Every scheduled date from the epoch through today, newest first. */
export function playableDates(today: string): string[] {
  const out: string[] = []
  for (let d = today; d >= EPOCH_DATE; d = addDays(d, -1)) {
    if (schedule[d]) out.push(d)
  }
  return out
}
```

Add `"resolveJsonModule": true` to `compilerOptions` in `tsconfig.json` if it is not already set.

- [ ] **Step 6: Verify the repository compiles against real data**

Run: `npx tsc --noEmit`
Expected: no errors. If `films.json` is missing, Task 3 was not completed — go back.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add IST puzzle dates and the data repository seam"
```

---

## Task 6: The comparison engine

**Files:**
- Create: `src/domain/compare.ts`
- Test: `src/domain/compare.test.ts`

**Interfaces:**
- Consumes: `Film`, `Person`, `CAST_CELLS` from `src/domain/types`.
- Produces: `Reveal`, `GuessOutcome`, `compareFilms(guess: Film, answer: Film): GuessOutcome`.

**This is the heart of the game.** Every rule in spec §6 lands here. Read that section before implementing.

- [ ] **Step 1: Write the failing comparison tests**

Create `src/domain/compare.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { compareFilms } from './compare'
import type { Film, Person } from './types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const film = (over: Partial<Film> = {}): Film => ({
  id: 'f_x',
  tmdbId: 1,
  title: 'Film',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: p(100, 'Director A'),
  musicDirector: p(200, 'Composer A'),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)),
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  isMysteryEligible: true,
  ...over,
})

describe('compareFilms — correctness', () => {
  it('marks an identical film as correct', () => {
    const answer = film()
    expect(compareFilms(answer, answer).correct).toBe(true)
  })

  it('marks a different film as incorrect', () => {
    expect(compareFilms(film({ id: 'f_y' }), film()).correct).toBe(false)
  })
})

describe('compareFilms — year', () => {
  it('reports "later" when the guess is older', () => {
    const out = compareFilms(film({ id: 'g', year: 2010 }), film({ year: 2018 }))
    expect(out.reveals).toContainEqual({ kind: 'year', relation: 'later', guessYear: 2010 })
  })

  it('reports "earlier" when the guess is newer', () => {
    const out = compareFilms(film({ id: 'g', year: 2022 }), film({ year: 2018 }))
    expect(out.reveals).toContainEqual({ kind: 'year', relation: 'earlier', guessYear: 2022 })
  })

  it('reports "exact" when the years match', () => {
    const out = compareFilms(film({ id: 'g', year: 2018 }), film({ year: 2018 }))
    expect(out.reveals).toContainEqual({ kind: 'year', relation: 'exact', guessYear: 2018 })
  })

  it('always emits exactly one year reveal', () => {
    const out = compareFilms(film({ id: 'g', year: 2010 }), film({ year: 2018 }))
    expect(out.reveals.filter((r) => r.kind === 'year')).toHaveLength(1)
  })
})

describe('compareFilms — genres', () => {
  it('reveals a shared genre at its answer slot', () => {
    const out = compareFilms(
      film({ id: 'g', genres: ['Comedy', 'Drama'] }),
      film({ genres: ['Action', 'Drama'] }),
    )
    expect(out.reveals).toContainEqual({ kind: 'genre', slot: 1, genre: 'Drama' })
  })

  it('reveals every shared genre', () => {
    const out = compareFilms(
      film({ id: 'g', genres: ['Drama', 'Action'] }),
      film({ genres: ['Action', 'Drama'] }),
    )
    expect(out.reveals.filter((r) => r.kind === 'genre')).toHaveLength(2)
  })

  it('reveals nothing when no genre is shared', () => {
    const out = compareFilms(
      film({ id: 'g', genres: ['Horror'] }),
      film({ genres: ['Action', 'Drama'] }),
    )
    expect(out.reveals.filter((r) => r.kind === 'genre')).toHaveLength(0)
  })
})

describe('compareFilms — cast', () => {
  it('reveals a shared actor at their answer billing slot', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(9), p(3)] }),
      film({ cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)) }),
    )
    expect(out.reveals).toContainEqual({ kind: 'cast', slot: 2, person: p(3) })
  })

  it('reveals multiple shared actors at their own slots', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(1), p(3)] }),
      film({ cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)) }),
    )
    const slots = out.reveals.filter((r) => r.kind === 'cast').map((r: any) => r.slot)
    expect(slots.sort()).toEqual([0, 2])
  })

  it('ignores an actor billed below the cell cutoff in the answer', () => {
    const answer = film({ cast: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => p(n)) })
    const out = compareFilms(film({ id: 'g', cast: [p(8)] }), answer)
    expect(out.reveals.filter((r) => r.kind === 'cast')).toHaveLength(0)
  })

  it('does not rule out an actor who is in the answer but below the cutoff', () => {
    const answer = film({ cast: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => p(n)) })
    const out = compareFilms(film({ id: 'g', cast: [p(8)] }), answer)
    expect(out.eliminated.map((e) => e.id)).not.toContain(8)
  })
})

describe('compareFilms — crew', () => {
  it('reveals a shared director', () => {
    const out = compareFilms(film({ id: 'g' }), film())
    expect(out.reveals).toContainEqual({
      kind: 'crew',
      role: 'director',
      person: p(100, 'Director A'),
    })
  })

  it('reveals a shared music director', () => {
    const out = compareFilms(film({ id: 'g' }), film())
    expect(out.reveals).toContainEqual({
      kind: 'crew',
      role: 'musicDirector',
      person: p(200, 'Composer A'),
    })
  })

  it('reveals nothing for crew when neither matches', () => {
    const out = compareFilms(
      film({ id: 'g', director: p(999), musicDirector: p(998) }),
      film(),
    )
    expect(out.reveals.filter((r) => r.kind === 'crew')).toHaveLength(0)
  })

  it('opens both a crew cell and a cast cell for a director who also acts', () => {
    const answer = film({ director: p(1), cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)) })
    const guess = film({ id: 'g', director: p(1), cast: [p(1)] })
    const out = compareFilms(guess, answer)
    expect(out.reveals).toContainEqual({ kind: 'crew', role: 'director', person: p(1) })
    expect(out.reveals).toContainEqual({ kind: 'cast', slot: 0, person: p(1) })
  })

  it('handles a guess with no music director', () => {
    const out = compareFilms(film({ id: 'g', musicDirector: null }), film())
    expect(out.reveals.filter((r: any) => r.role === 'musicDirector')).toHaveLength(0)
  })
})

describe('compareFilms — eliminations', () => {
  it('rules out every person in the guess who is absent from the answer', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(50), p(51)], director: p(52), musicDirector: p(53) }),
      film(),
    )
    expect(out.eliminated.map((e) => e.id).sort((a, b) => a - b)).toEqual([50, 51, 52, 53])
  })

  it('does not rule out people who matched', () => {
    const out = compareFilms(film({ id: 'g', cast: [p(1), p(50)] }), film())
    expect(out.eliminated.map((e) => e.id)).toEqual([50])
  })

  it('does not rule out the answer director when the guess shares them', () => {
    const out = compareFilms(film({ id: 'g', cast: [] as Person[] }), film())
    expect(out.eliminated.map((e) => e.id)).not.toContain(100)
  })

  it('lists each eliminated person only once', () => {
    const out = compareFilms(
      film({ id: 'g', cast: [p(50), p(50)], director: p(50), musicDirector: p(50) }),
      film(),
    )
    expect(out.eliminated).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/domain/compare.test.ts`
Expected: FAIL — `Failed to resolve import "./compare"`

- [ ] **Step 3: Implement the comparison engine**

Create `src/domain/compare.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/domain/compare.test.ts`
Expected: PASS, 22 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add guess/answer comparison engine"
```

---

## Task 7: Board state

**Files:**
- Create: `src/domain/board.ts`
- Test: `src/domain/board.test.ts`

**Interfaces:**
- Consumes: `Reveal` from `src/domain/compare`; `Film`, `Person`, `CAST_CELLS`, `FIRST_YEAR`, `LAST_YEAR` from `src/domain/types`.
- Produces: `CellState`, `CellRef`, `Board`, `createBoard(answer: Film): Board`, `applyReveals(board: Board, reveals: Reveal[]): Board`, `revealCell(board: Board, ref: CellRef): Board`, `hiddenCells(board: Board): CellRef[]`, `revealAll(board: Board): Board`, `cellStates(board: Board): CellState[]`.

The board holds the answer's values for every cell but the UI renders a value only when its state is not `hidden`. Cells never close once open.

- [ ] **Step 1: Write the failing board tests**

Create `src/domain/board.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createBoard, applyReveals, revealCell, hiddenCells, revealAll, cellStates } from './board'
import { FIRST_YEAR, LAST_YEAR, type Film, type Person } from './types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const answer: Film = {
  id: 'f_a',
  tmdbId: 1,
  title: 'Answer',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: p(100),
  musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map(p),
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  isMysteryEligible: true,
}

describe('createBoard', () => {
  it('starts every cell hidden', () => {
    const b = createBoard(answer)
    expect(cellStates(b).every((s) => s === 'hidden')).toBe(true)
  })

  it('starts the year bounds at the full window', () => {
    const b = createBoard(answer)
    expect(b.year.min).toBe(FIRST_YEAR)
    expect(b.year.max).toBe(LAST_YEAR)
  })

  it('creates one genre cell per answer genre', () => {
    expect(createBoard(answer).genres).toHaveLength(2)
  })

  it('creates six cast cells', () => {
    expect(createBoard(answer).cast).toHaveLength(6)
  })

  // Defensive only: the answer gates guarantee a composer. This pins the
  // degradation path so a bad override cannot crash the board.
  it('omits the music cell when the film has no composer', () => {
    const b = createBoard({ ...answer, musicDirector: null })
    expect(b.musicDirector).toBeNull()
    expect(cellStates(b)).toHaveLength(10)
  })

  it('includes the music cell when the film has a composer', () => {
    expect(cellStates(createBoard(answer))).toHaveLength(11)
  })
})

describe('applyReveals — year', () => {
  it('raises the floor above an older guess', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'later', guessYear: 2010 },
    ])
    expect(b.year.min).toBe(2011)
    expect(b.year.state).toBe('hidden')
  })

  it('lowers the ceiling below a newer guess', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'earlier', guessYear: 2022 },
    ])
    expect(b.year.max).toBe(2021)
  })

  it('solves the year on an exact match', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'exact', guessYear: 2018 },
    ])
    expect(b.year.state).toBe('matched')
    expect(b.year.min).toBe(2018)
    expect(b.year.max).toBe(2018)
  })

  it('never widens a bound already narrowed', () => {
    let b = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'later', guessYear: 2015 },
    ])
    b = applyReveals(b, [{ kind: 'year', relation: 'later', guessYear: 2008 }])
    expect(b.year.min).toBe(2016)
  })
})

describe('applyReveals — cells', () => {
  it('opens a genre cell', () => {
    const b = applyReveals(createBoard(answer), [{ kind: 'genre', slot: 1, genre: 'Drama' }])
    expect(b.genres[1].state).toBe('matched')
    expect(b.genres[0].state).toBe('hidden')
  })

  it('opens a cast cell', () => {
    const b = applyReveals(createBoard(answer), [{ kind: 'cast', slot: 2, person: p(3) }])
    expect(b.cast[2].state).toBe('matched')
  })

  it('opens a crew cell', () => {
    const b = applyReveals(createBoard(answer), [
      { kind: 'crew', role: 'musicDirector', person: p(200) },
    ])
    expect(b.musicDirector.state).toBe('matched')
    expect(b.director.state).toBe('hidden')
  })

  it('does not mutate the board it was given', () => {
    const b = createBoard(answer)
    applyReveals(b, [{ kind: 'genre', slot: 0, genre: 'Action' }])
    expect(b.genres[0].state).toBe('hidden')
  })
})

describe('revealCell', () => {
  it('opens a hidden cell as a lifeline reveal', () => {
    const b = revealCell(createBoard(answer), { kind: 'cast', slot: 4 })
    expect(b.cast[4].state).toBe('lifeline')
  })

  it('solves the year when the year cell is chosen', () => {
    const b = revealCell(createBoard(answer), { kind: 'year' })
    expect(b.year.state).toBe('lifeline')
    expect(b.year.min).toBe(2018)
    expect(b.year.max).toBe(2018)
  })

  it('leaves a matched cell as matched', () => {
    let b = applyReveals(createBoard(answer), [{ kind: 'genre', slot: 0, genre: 'Action' }])
    b = revealCell(b, { kind: 'genre', slot: 0 })
    expect(b.genres[0].state).toBe('matched')
  })
})

describe('hiddenCells', () => {
  it('lists every cell on a fresh board', () => {
    expect(hiddenCells(createBoard(answer))).toHaveLength(11)
  })

  it('omits cells that have been opened', () => {
    const b = applyReveals(createBoard(answer), [{ kind: 'cast', slot: 0, person: p(1) }])
    expect(hiddenCells(b)).toHaveLength(10)
  })

  it('never offers a music cell that does not exist', () => {
    const b = createBoard({ ...answer, musicDirector: null })
    expect(hiddenCells(b)).toHaveLength(10)
    expect(hiddenCells(b)).not.toContainEqual({ kind: 'crew', role: 'musicDirector' })
  })
})

describe('revealAll', () => {
  it('opens every remaining cell', () => {
    const b = revealAll(createBoard(answer))
    expect(cellStates(b).some((s) => s === 'hidden')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/domain/board.test.ts`
Expected: FAIL — `Failed to resolve import "./board"`

- [ ] **Step 3: Implement the board**

Create `src/domain/board.ts`:

```ts
import type { Reveal } from './compare'
import { CAST_CELLS, FIRST_YEAR, LAST_YEAR, type Film, type Person } from './types'

export type CellState = 'hidden' | 'matched' | 'lifeline'

export type CellRef =
  | { kind: 'year' }
  | { kind: 'genre'; slot: number }
  | { kind: 'cast'; slot: number }
  | { kind: 'crew'; role: 'director' | 'musicDirector' }

type ValueCell<T> = { value: T; state: CellState }

export type Board = {
  answerYear: number
  year: { min: number; max: number; state: CellState }
  genres: ValueCell<string>[]
  cast: ValueCell<Person>[]
  director: ValueCell<Person>
  /**
   * The answer gates guarantee a composer, so this is non-null for every real
   * puzzle. The null path is defensive -- it keeps a bad hand-written override
   * from crashing the board, degrading to an 11-cell layout instead.
   */
  musicDirector: ValueCell<Person> | null
}

export function createBoard(answer: Film): Board {
  return {
    answerYear: answer.year,
    year: { min: FIRST_YEAR, max: LAST_YEAR, state: 'hidden' },
    genres: answer.genres.map((value) => ({ value, state: 'hidden' as CellState })),
    cast: answer.cast
      .slice(0, CAST_CELLS)
      .map((value) => ({ value, state: 'hidden' as CellState })),
    director: { value: answer.director, state: 'hidden' },
    musicDirector: answer.musicDirector
      ? { value: answer.musicDirector, state: 'hidden' }
      : null,
  }
}

function clone(b: Board): Board {
  return {
    answerYear: b.answerYear,
    year: { ...b.year },
    genres: b.genres.map((c) => ({ ...c })),
    cast: b.cast.map((c) => ({ ...c })),
    director: { ...b.director },
    musicDirector: b.musicDirector ? { ...b.musicDirector } : null,
  }
}

export function applyReveals(board: Board, reveals: Reveal[]): Board {
  const b = clone(board)

  for (const r of reveals) {
    switch (r.kind) {
      case 'year':
        if (r.relation === 'exact') {
          b.year.min = r.guessYear
          b.year.max = r.guessYear
          if (b.year.state === 'hidden') b.year.state = 'matched'
        } else if (r.relation === 'later') {
          b.year.min = Math.max(b.year.min, r.guessYear + 1)
        } else {
          b.year.max = Math.min(b.year.max, r.guessYear - 1)
        }
        break
      case 'genre':
        if (b.genres[r.slot].state === 'hidden') b.genres[r.slot].state = 'matched'
        break
      case 'cast':
        if (b.cast[r.slot].state === 'hidden') b.cast[r.slot].state = 'matched'
        break
      case 'crew': {
        const cell = b[r.role]
        if (cell && cell.state === 'hidden') cell.state = 'matched'
        break
      }
    }
  }

  return b
}

export function revealCell(board: Board, ref: CellRef): Board {
  const b = clone(board)

  switch (ref.kind) {
    case 'year':
      if (b.year.state === 'hidden') {
        b.year.state = 'lifeline'
        b.year.min = b.answerYear
        b.year.max = b.answerYear
      }
      break
    case 'genre':
      if (b.genres[ref.slot].state === 'hidden') b.genres[ref.slot].state = 'lifeline'
      break
    case 'cast':
      if (b.cast[ref.slot].state === 'hidden') b.cast[ref.slot].state = 'lifeline'
      break
    case 'crew': {
      const cell = b[ref.role]
      if (cell && cell.state === 'hidden') cell.state = 'lifeline'
      break
    }
  }

  return b
}

export function hiddenCells(board: Board): CellRef[] {
  const out: CellRef[] = []
  if (board.year.state === 'hidden') out.push({ kind: 'year' })
  board.genres.forEach((c, slot) => {
    if (c.state === 'hidden') out.push({ kind: 'genre', slot })
  })
  board.cast.forEach((c, slot) => {
    if (c.state === 'hidden') out.push({ kind: 'cast', slot })
  })
  if (board.director.state === 'hidden') out.push({ kind: 'crew', role: 'director' })
  if (board.musicDirector?.state === 'hidden') out.push({ kind: 'crew', role: 'musicDirector' })
  return out
}

export function revealAll(board: Board): Board {
  return hiddenCells(board).reduce(revealCell, board)
}

/** Board order, used by the share card and by tests. */
export function cellStates(board: Board): CellState[] {
  return [
    board.year.state,
    ...board.genres.map((c) => c.state),
    ...board.cast.map((c) => c.state),
    board.director.state,
    ...(board.musicDirector ? [board.musicDirector.state] : []),
  ]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/domain/board.test.ts`
Expected: PASS, 21 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add board state with reveal and lifeline transitions"
```

---

## Task 8: Ruled-out accumulation and lifeline rules

**Files:**
- Create: `src/domain/ruledOut.ts`
- Create: `src/domain/lifelines.ts`
- Test: `src/domain/ruledOut.test.ts`
- Test: `src/domain/lifelines.test.ts`

**Interfaces:**
- Consumes: `Person` from `src/domain/types`.
- Produces: `mergeRuledOut(existing: Person[], incoming: Person[]): Person[]`; and `LifelineState`, `BASE_GUESS_LIMIT`, `EXTRA_GUESSES`, `emptyLifelines(): LifelineState`, `revealsEarned(guessCount: number): number`, `revealsAvailable(state: LifelineState, guessCount: number): number`, `guessLimit(state: LifelineState): number`, `canUnlockExtraGuesses(state: LifelineState, guessCount: number): boolean`.

- [ ] **Step 1: Write the failing ruled-out tests**

Create `src/domain/ruledOut.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mergeRuledOut } from './ruledOut'
import type { Person } from './types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

describe('mergeRuledOut', () => {
  it('adds new people', () => {
    expect(mergeRuledOut([p(1)], [p(2)])).toEqual([p(1), p(2)])
  })

  it('ignores people already listed', () => {
    expect(mergeRuledOut([p(1)], [p(1)])).toEqual([p(1)])
  })

  it('deduplicates within the incoming batch', () => {
    expect(mergeRuledOut([], [p(1), p(1)])).toEqual([p(1)])
  })

  it('preserves insertion order', () => {
    expect(mergeRuledOut([p(3)], [p(1), p(2)])).toEqual([p(3), p(1), p(2)])
  })

  it('does not mutate the existing list', () => {
    const existing = [p(1)]
    mergeRuledOut(existing, [p(2)])
    expect(existing).toEqual([p(1)])
  })

  it('returns an empty list when nothing is ruled out', () => {
    expect(mergeRuledOut([], [])).toEqual([])
  })
})
```

- [ ] **Step 2: Write the failing lifeline tests**

Create `src/domain/lifelines.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  revealsEarned,
  revealsAvailable,
  guessLimit,
  canUnlockExtraGuesses,
  BASE_GUESS_LIMIT,
  type LifelineState,
} from './lifelines'

const state = (over: Partial<LifelineState> = {}): LifelineState => ({
  revealsUsed: 0,
  extraGuessesUnlocked: false,
  ...over,
})

describe('revealsEarned', () => {
  it('earns none before the fourth guess', () => {
    expect(revealsEarned(0)).toBe(0)
    expect(revealsEarned(3)).toBe(0)
  })

  it('earns one after the fourth guess', () => {
    expect(revealsEarned(4)).toBe(1)
    expect(revealsEarned(5)).toBe(1)
  })

  it('earns two after the sixth guess', () => {
    expect(revealsEarned(6)).toBe(2)
    expect(revealsEarned(10)).toBe(2)
  })
})

describe('revealsAvailable', () => {
  it('is zero when none are earned', () => {
    expect(revealsAvailable(state(), 3)).toBe(0)
  })

  it('is one when earned and unused', () => {
    expect(revealsAvailable(state(), 4)).toBe(1)
  })

  it('drops to zero once spent', () => {
    expect(revealsAvailable(state({ revealsUsed: 1 }), 4)).toBe(0)
  })

  it('rises again at the sixth guess', () => {
    expect(revealsAvailable(state({ revealsUsed: 1 }), 6)).toBe(1)
  })

  it('never goes negative', () => {
    expect(revealsAvailable(state({ revealsUsed: 2 }), 4)).toBe(0)
  })
})

describe('guessLimit', () => {
  it('is seven by default', () => {
    expect(guessLimit(state())).toBe(BASE_GUESS_LIMIT)
  })

  it('is ten once extra guesses are unlocked', () => {
    expect(guessLimit(state({ extraGuessesUnlocked: true }))).toBe(10)
  })
})

describe('canUnlockExtraGuesses', () => {
  it('is false before the seventh guess', () => {
    expect(canUnlockExtraGuesses(state(), 6)).toBe(false)
  })

  it('is true at the seventh guess', () => {
    expect(canUnlockExtraGuesses(state(), 7)).toBe(true)
  })

  it('is false once already unlocked', () => {
    expect(canUnlockExtraGuesses(state({ extraGuessesUnlocked: true }), 7)).toBe(false)
  })
})
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npm test -- src/domain/ruledOut.test.ts src/domain/lifelines.test.ts`
Expected: FAIL — both imports unresolved

- [ ] **Step 4: Implement both modules**

Create `src/domain/ruledOut.ts`:

```ts
import type { Person } from './types'

/** Append people not already listed, preserving discovery order. */
export function mergeRuledOut(existing: Person[], incoming: Person[]): Person[] {
  const seen = new Set(existing.map((p) => p.id))
  const out = [...existing]
  for (const person of incoming) {
    if (seen.has(person.id)) continue
    seen.add(person.id)
    out.push(person)
  }
  return out
}
```

Create `src/domain/lifelines.ts`:

```ts
export const BASE_GUESS_LIMIT = 7
export const EXTRA_GUESSES = 3

export type LifelineState = {
  revealsUsed: number
  extraGuessesUnlocked: boolean
}

export function emptyLifelines(): LifelineState {
  return { revealsUsed: 0, extraGuessesUnlocked: false }
}

/** One reveal is earned after the 4th guess, a second after the 6th. */
export function revealsEarned(guessCount: number): number {
  if (guessCount >= 6) return 2
  if (guessCount >= 4) return 1
  return 0
}

export function revealsAvailable(state: LifelineState, guessCount: number): number {
  return Math.max(0, revealsEarned(guessCount) - state.revealsUsed)
}

export function guessLimit(state: LifelineState): number {
  return state.extraGuessesUnlocked ? BASE_GUESS_LIMIT + EXTRA_GUESSES : BASE_GUESS_LIMIT
}

export function canUnlockExtraGuesses(state: LifelineState, guessCount: number): boolean {
  return !state.extraGuessesUnlocked && guessCount >= BASE_GUESS_LIMIT
}
```

- [ ] **Step 5: Run both tests to verify they pass**

Run: `npm test -- src/domain/ruledOut.test.ts src/domain/lifelines.test.ts`
Expected: PASS, 19 tests

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add ruled-out accumulation and lifeline rules"
```

---

## Task 9: The session state machine

**Files:**
- Create: `src/domain/session.ts`
- Test: `src/domain/session.test.ts`

**Interfaces:**
- Consumes: `compareFilms`, `GuessOutcome` from `src/domain/compare`; `Board`, `CellRef`, `createBoard`, `applyReveals`, `revealCell`, `revealAll` from `src/domain/board`; `mergeRuledOut` from `src/domain/ruledOut`; lifeline helpers from `src/domain/lifelines`.
- Produces: `SessionStatus`, `Session`, `PersistedSession`, `startSession(puzzleDate: string, answer: Film): Session`, `submitGuess(s: Session, guess: Film): Session`, `useReveal(s: Session, ref: CellRef): Session`, `unlockExtraGuesses(s: Session): Session`, `toPersisted(s: Session): PersistedSession`, `replaySession(p: PersistedSession, answer: Film, lookup: (id: string) => Film | undefined): Session`.

**Persistence is replay, not serialization.** Only the guessed film ids and the chosen lifeline cells are stored; the board is rebuilt by re-running the rules. That keeps saved data tiny and means a rule fix applies retroactively instead of leaving stale boards behind.

- [ ] **Step 1: Write the failing session tests**

Create `src/domain/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  startSession,
  submitGuess,
  useReveal,
  unlockExtraGuesses,
  toPersisted,
  replaySession,
} from './session'
import type { Film, Person } from './types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const film = (over: Partial<Film> = {}): Film => ({
  id: 'f_a',
  tmdbId: 1,
  title: 'Answer',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: p(100),
  musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map(p),
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  isMysteryEligible: true,
  ...over,
})

const answer = film()
const miss = (n: number) =>
  film({
    id: `f_miss_${n}`,
    year: 2006,
    genres: ['Horror'],
    director: p(900 + n),
    musicDirector: p(950 + n),
    cast: [p(800 + n)],
  })

const lookup = (id: string): Film | undefined => {
  if (id === answer.id) return answer
  const n = Number(id.replace('f_miss_', ''))
  return Number.isNaN(n) ? undefined : miss(n)
}

describe('startSession', () => {
  it('begins playing with no guesses', () => {
    const s = startSession('2026-09-13', answer)
    expect(s.status).toBe('playing')
    expect(s.outcomes).toHaveLength(0)
    expect(s.ruledOut).toHaveLength(0)
  })
})

describe('submitGuess', () => {
  it('records an incorrect guess and stays playing', () => {
    const s = submitGuess(startSession('d', answer), miss(1))
    expect(s.outcomes).toHaveLength(1)
    expect(s.status).toBe('playing')
  })

  it('wins on a correct guess', () => {
    const s = submitGuess(startSession('d', answer), answer)
    expect(s.status).toBe('won')
  })

  it('opens every cell on a win', () => {
    const s = submitGuess(startSession('d', answer), answer)
    expect(s.board.cast.every((c) => c.state !== 'hidden')).toBe(true)
  })

  it('accumulates ruled-out people across guesses', () => {
    let s = startSession('d', answer)
    s = submitGuess(s, miss(1))
    s = submitGuess(s, miss(2))
    expect(s.ruledOut.map((x) => x.id)).toContain(801)
    expect(s.ruledOut.map((x) => x.id)).toContain(802)
  })

  it('narrows the year bound from a guess', () => {
    const s = submitGuess(startSession('d', answer), miss(1))
    expect(s.board.year.min).toBe(2007)
  })

  it('loses after the seventh wrong guess', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    expect(s.status).toBe('lost')
    expect(s.outcomes).toHaveLength(7)
  })

  it('reveals the whole board on a loss', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    expect(s.board.director.state).not.toBe('hidden')
  })

  it('ignores a repeat guess without consuming an attempt', () => {
    let s = submitGuess(startSession('d', answer), miss(1))
    s = submitGuess(s, miss(1))
    expect(s.outcomes).toHaveLength(1)
  })

  it('ignores guesses once the game is over', () => {
    let s = submitGuess(startSession('d', answer), answer)
    s = submitGuess(s, miss(1))
    expect(s.outcomes).toHaveLength(1)
  })
})

describe('useReveal', () => {
  it('is refused before a reveal is earned', () => {
    const s = useReveal(startSession('d', answer), { kind: 'crew', role: 'director' })
    expect(s.board.director.state).toBe('hidden')
    expect(s.lifelines.revealsUsed).toBe(0)
  })

  it('opens a chosen cell once earned', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 4; i++) s = submitGuess(s, miss(i))
    s = useReveal(s, { kind: 'crew', role: 'director' })
    expect(s.board.director.state).toBe('lifeline')
    expect(s.lifelines.revealsUsed).toBe(1)
  })

  it('refuses a second reveal until the sixth guess', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 4; i++) s = submitGuess(s, miss(i))
    s = useReveal(s, { kind: 'crew', role: 'director' })
    s = useReveal(s, { kind: 'crew', role: 'musicDirector' })
    expect(s.board.musicDirector.state).toBe('hidden')
  })

  it('allows a second reveal after the sixth guess', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 6; i++) s = submitGuess(s, miss(i))
    s = useReveal(s, { kind: 'crew', role: 'director' })
    s = useReveal(s, { kind: 'crew', role: 'musicDirector' })
    expect(s.board.musicDirector.state).toBe('lifeline')
    expect(s.lifelines.revealsUsed).toBe(2)
  })
})

describe('unlockExtraGuesses', () => {
  it('is refused before the seventh guess', () => {
    const s = unlockExtraGuesses(startSession('d', answer))
    expect(s.lifelines.extraGuessesUnlocked).toBe(false)
  })

  it('reopens a lost game with three more guesses', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    s = unlockExtraGuesses(s)
    expect(s.status).toBe('playing')
    expect(s.lifelines.extraGuessesUnlocked).toBe(true)
  })

  it('allows winning on the extra guesses', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    s = unlockExtraGuesses(s)
    s = submitGuess(s, answer)
    expect(s.status).toBe('won')
    expect(s.outcomes).toHaveLength(8)
  })

  it('loses for good after the tenth guess', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    s = unlockExtraGuesses(s)
    for (let i = 8; i <= 10; i++) s = submitGuess(s, miss(i))
    expect(s.status).toBe('lost')
    expect(s.outcomes).toHaveLength(10)
  })
})

describe('persistence round-trip', () => {
  it('restores guesses, board, and ruled-out from replay', () => {
    let s = startSession('2026-09-13', answer)
    s = submitGuess(s, miss(1))
    s = submitGuess(s, miss(2))

    const restored = replaySession(toPersisted(s), answer, lookup)
    expect(restored.outcomes).toHaveLength(2)
    expect(restored.board.year.min).toBe(s.board.year.min)
    expect(restored.ruledOut.map((x) => x.id)).toEqual(s.ruledOut.map((x) => x.id))
    expect(restored.status).toBe('playing')
  })

  it('restores lifeline reveals', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 4; i++) s = submitGuess(s, miss(i))
    s = useReveal(s, { kind: 'crew', role: 'director' })

    const restored = replaySession(toPersisted(s), answer, lookup)
    expect(restored.board.director.state).toBe('lifeline')
    expect(restored.lifelines.revealsUsed).toBe(1)
  })

  it('restores a won game', () => {
    let s = submitGuess(startSession('d', answer), answer)
    expect(replaySession(toPersisted(s), answer, lookup).status).toBe('won')
  })

  it('skips guess ids that no longer resolve to a film', () => {
    const restored = replaySession(
      { puzzleDate: 'd', guessIds: ['f_gone', 'f_miss_1'], revealedCells: [], extraGuessesUnlocked: false },
      answer,
      lookup,
    )
    expect(restored.outcomes).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/domain/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`

- [ ] **Step 3: Implement the session**

Create `src/domain/session.ts`:

```ts
import { compareFilms, type GuessOutcome } from './compare'
import {
  applyReveals,
  createBoard,
  revealAll,
  revealCell,
  type Board,
  type CellRef,
} from './board'
import { mergeRuledOut } from './ruledOut'
import {
  canUnlockExtraGuesses,
  emptyLifelines,
  guessLimit,
  revealsAvailable,
  type LifelineState,
} from './lifelines'
import type { Film, Person } from './types'

export type SessionStatus = 'playing' | 'won' | 'lost'

export type Session = {
  puzzleDate: string
  answer: Film
  board: Board
  outcomes: GuessOutcome[]
  ruledOut: Person[]
  revealedCells: CellRef[]
  lifelines: LifelineState
  status: SessionStatus
}

/** The only thing written to storage. Everything else is replayed from it. */
export type PersistedSession = {
  puzzleDate: string
  guessIds: string[]
  revealedCells: CellRef[]
  extraGuessesUnlocked: boolean
}

export function startSession(puzzleDate: string, answer: Film): Session {
  return {
    puzzleDate,
    answer,
    board: createBoard(answer),
    outcomes: [],
    ruledOut: [],
    revealedCells: [],
    lifelines: emptyLifelines(),
    status: 'playing',
  }
}

export function submitGuess(s: Session, guess: Film): Session {
  if (s.status !== 'playing') return s
  if (s.outcomes.some((o) => o.guessId === guess.id)) return s
  if (s.outcomes.length >= guessLimit(s.lifelines)) return s

  const outcome = compareFilms(guess, s.answer)
  const outcomes = [...s.outcomes, outcome]

  let status: SessionStatus = 'playing'
  if (outcome.correct) status = 'won'
  else if (outcomes.length >= guessLimit(s.lifelines)) status = 'lost'

  let board = applyReveals(s.board, outcome.reveals)
  if (status !== 'playing') board = revealAll(board)

  return {
    ...s,
    board,
    outcomes,
    ruledOut: mergeRuledOut(s.ruledOut, outcome.eliminated),
    status,
  }
}

export function useReveal(s: Session, ref: CellRef): Session {
  if (s.status !== 'playing') return s
  if (revealsAvailable(s.lifelines, s.outcomes.length) <= 0) return s

  return {
    ...s,
    board: revealCell(s.board, ref),
    revealedCells: [...s.revealedCells, ref],
    lifelines: { ...s.lifelines, revealsUsed: s.lifelines.revealsUsed + 1 },
  }
}

export function unlockExtraGuesses(s: Session): Session {
  if (s.status === 'won') return s
  if (!canUnlockExtraGuesses(s.lifelines, s.outcomes.length)) return s

  return {
    ...s,
    // The board was opened when the game was lost; rebuild it by replay.
    board: replayBoard(s.answer, s.outcomes, s.revealedCells),
    lifelines: { ...s.lifelines, extraGuessesUnlocked: true },
    status: 'playing',
  }
}

function replayBoard(answer: Film, outcomes: GuessOutcome[], cells: CellRef[]): Board {
  let board = createBoard(answer)
  for (const o of outcomes) board = applyReveals(board, o.reveals)
  for (const ref of cells) board = revealCell(board, ref)
  return board
}

export function toPersisted(s: Session): PersistedSession {
  return {
    puzzleDate: s.puzzleDate,
    guessIds: s.outcomes.map((o) => o.guessId),
    revealedCells: s.revealedCells,
    extraGuessesUnlocked: s.lifelines.extraGuessesUnlocked,
  }
}

export function replaySession(
  p: PersistedSession,
  answer: Film,
  lookup: (id: string) => Film | undefined,
): Session {
  let s = startSession(p.puzzleDate, answer)
  if (p.extraGuessesUnlocked) {
    s = { ...s, lifelines: { ...s.lifelines, extraGuessesUnlocked: true } }
  }

  for (const id of p.guessIds) {
    const film = lookup(id)
    if (film) s = submitGuess(s, film)
  }
  for (const ref of p.revealedCells) {
    s = {
      ...s,
      board: revealCell(s.board, ref),
      revealedCells: [...s.revealedCells, ref],
      lifelines: { ...s.lifelines, revealsUsed: s.lifelines.revealsUsed + 1 },
    }
  }

  return s
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/domain/session.test.ts`
Expected: PASS, 21 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add session state machine with replay-based persistence"
```

---

## Task 10: Storage and statistics

**Files:**
- Create: `src/storage/types.ts`
- Create: `src/storage/stats.ts`
- Create: `src/storage/localStorage.ts`
- Test: `src/storage/stats.test.ts`
- Test: `src/storage/localStorage.test.ts`

**Interfaces:**
- Consumes: `PersistedSession` from `src/domain/session`.
- Produces: `Stats`, `GameStorage`, `emptyStats(): Stats`, `recordResult(stats: Stats, opts: RecordOptions): Stats`, `createLocalStorage(ls?: Storage): GameStorage`.

**Streak rule:** only today's puzzle moves the streak. Archive plays count toward played, won, and the distribution, but replaying three old puzzles must not manufacture a three-day streak.

- [ ] **Step 1: Write the failing stats tests**

Create `src/storage/stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emptyStats, recordResult } from './stats'

describe('recordResult', () => {
  it('counts a win', () => {
    const s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    expect(s.played).toBe(1)
    expect(s.won).toBe(1)
    expect(s.distribution[3]).toBe(1)
  })

  it('counts a loss without touching the distribution', () => {
    const s = recordResult(emptyStats(), { date: '2026-09-13', won: false, guesses: 7, isToday: true })
    expect(s.played).toBe(1)
    expect(s.won).toBe(0)
    expect(s.distribution[7]).toBeUndefined()
  })

  it('starts a streak at one', () => {
    const s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    expect(s.currentStreak).toBe(1)
    expect(s.maxStreak).toBe(1)
  })

  it('extends a streak on consecutive days', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-14', won: true, guesses: 4, isToday: true })
    expect(s.currentStreak).toBe(2)
  })

  it('resets a streak after a skipped day', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-15', won: true, guesses: 4, isToday: true })
    expect(s.currentStreak).toBe(1)
  })

  it('breaks a streak on a loss', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-14', won: false, guesses: 7, isToday: true })
    expect(s.currentStreak).toBe(0)
  })

  it('remembers the best streak after it breaks', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-14', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-15', won: false, guesses: 7, isToday: true })
    expect(s.maxStreak).toBe(2)
    expect(s.currentStreak).toBe(0)
  })

  it('does not move the streak for an archive play', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-05-01', won: true, guesses: 2, isToday: false })
    expect(s.currentStreak).toBe(1)
    expect(s.played).toBe(2)
    expect(s.distribution[2]).toBe(1)
  })

  it('ignores a date that was already recorded', () => {
    let s = recordResult(emptyStats(), { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    s = recordResult(s, { date: '2026-09-13', won: true, guesses: 3, isToday: true })
    expect(s.played).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/storage/stats.test.ts`
Expected: FAIL — `Failed to resolve import "./stats"`

- [ ] **Step 3: Implement stats**

Create `src/storage/types.ts`:

```ts
import type { PersistedSession } from '../domain/session'

export type Stats = {
  played: number
  won: number
  currentStreak: number
  maxStreak: number
  lastStreakDate: string | null
  recordedDates: string[]
  distribution: Record<number, number>
}

export interface GameStorage {
  loadSession(date: string): PersistedSession | null
  saveSession(session: PersistedSession): void
  loadStats(): Stats
  saveStats(stats: Stats): void
}
```

Create `src/storage/stats.ts`:

```ts
import { addDays } from '../domain/puzzleDate'
import type { Stats } from './types'

export type RecordOptions = {
  date: string
  won: boolean
  guesses: number
  isToday: boolean
}

export function emptyStats(): Stats {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastStreakDate: null,
    recordedDates: [],
    distribution: {},
  }
}

export function recordResult(stats: Stats, opts: RecordOptions): Stats {
  if (stats.recordedDates.includes(opts.date)) return stats

  const next: Stats = {
    ...stats,
    played: stats.played + 1,
    won: stats.won + (opts.won ? 1 : 0),
    recordedDates: [...stats.recordedDates, opts.date],
    distribution: { ...stats.distribution },
  }

  if (opts.won) {
    next.distribution[opts.guesses] = (next.distribution[opts.guesses] ?? 0) + 1
  }

  // Archive plays never move the streak.
  if (!opts.isToday) return next

  if (!opts.won) {
    next.currentStreak = 0
    next.lastStreakDate = opts.date
    return next
  }

  const continues = stats.lastStreakDate === addDays(opts.date, -1)
  next.currentStreak = continues ? stats.currentStreak + 1 : 1
  next.maxStreak = Math.max(stats.maxStreak, next.currentStreak)
  next.lastStreakDate = opts.date
  return next
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/storage/stats.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Write the failing localStorage tests**

Create `src/storage/localStorage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalStorage } from './localStorage'
import { emptyStats } from './stats'

describe('createLocalStorage', () => {
  beforeEach(() => localStorage.clear())

  it('returns null for a date never saved', () => {
    expect(createLocalStorage().loadSession('2026-09-13')).toBeNull()
  })

  it('round-trips a session', () => {
    const storage = createLocalStorage()
    const session = {
      puzzleDate: '2026-09-13',
      guessIds: ['f_1', 'f_2'],
      revealedCells: [{ kind: 'year' as const }],
      extraGuessesUnlocked: false,
    }
    storage.saveSession(session)
    expect(storage.loadSession('2026-09-13')).toEqual(session)
  })

  it('keeps sessions for different dates apart', () => {
    const storage = createLocalStorage()
    storage.saveSession({ puzzleDate: 'a', guessIds: ['f_1'], revealedCells: [], extraGuessesUnlocked: false })
    storage.saveSession({ puzzleDate: 'b', guessIds: ['f_2'], revealedCells: [], extraGuessesUnlocked: false })
    expect(storage.loadSession('a')?.guessIds).toEqual(['f_1'])
    expect(storage.loadSession('b')?.guessIds).toEqual(['f_2'])
  })

  it('returns empty stats when none are stored', () => {
    expect(createLocalStorage().loadStats()).toEqual(emptyStats())
  })

  it('round-trips stats', () => {
    const storage = createLocalStorage()
    const stats = { ...emptyStats(), played: 4, won: 3, currentStreak: 2 }
    storage.saveStats(stats)
    expect(storage.loadStats()).toEqual(stats)
  })

  it('falls back to empty stats when the stored value is corrupt', () => {
    localStorage.setItem('tollywood:stats', 'not json')
    expect(createLocalStorage().loadStats()).toEqual(emptyStats())
  })

  it('returns null when a stored session is corrupt', () => {
    localStorage.setItem('tollywood:session:2026-09-13', '{{{')
    expect(createLocalStorage().loadSession('2026-09-13')).toBeNull()
  })

  it('survives storage being unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    const storage = createLocalStorage(broken)
    expect(() => storage.saveStats(emptyStats())).not.toThrow()
    expect(storage.loadStats()).toEqual(emptyStats())
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- src/storage/localStorage.test.ts`
Expected: FAIL — `Failed to resolve import "./localStorage"`

- [ ] **Step 7: Implement localStorage-backed storage**

Create `src/storage/localStorage.ts`:

```ts
import type { PersistedSession } from '../domain/session'
import { emptyStats } from './stats'
import type { GameStorage, Stats } from './types'

const SESSION_PREFIX = 'tollywood:session:'
const STATS_KEY = 'tollywood:stats'

/**
 * Private browsing and blocked site data make localStorage throw rather than
 * return null, so every access is guarded. A player with storage disabled
 * still gets a fully playable game -- it simply forgets between visits.
 */
export function createLocalStorage(ls: Storage = localStorage): GameStorage {
  function read<T>(key: string, fallback: T): T {
    try {
      const raw = ls.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  }

  function write(key: string, value: unknown): void {
    try {
      ls.setItem(key, JSON.stringify(value))
    } catch {
      // Nothing useful to do -- the game continues in memory.
    }
  }

  return {
    loadSession: (date) => read<PersistedSession | null>(SESSION_PREFIX + date, null),
    saveSession: (session) => write(SESSION_PREFIX + session.puzzleDate, session),
    loadStats: () => read<Stats>(STATS_KEY, emptyStats()),
    saveStats: (stats) => write(STATS_KEY, stats),
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- src/storage/localStorage.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add game storage interface with localStorage implementation"
```

---

## Task 11: Title search for autocomplete

**Files:**
- Create: `src/domain/search.ts`
- Test: `src/domain/search.test.ts`

**Interfaces:**
- Consumes: `Film` from `src/domain/types`.
- Produces: `normalizeTitle(s: string): string`, `searchFilms(films: Film[], query: string, limit?: number): Film[]`.

Players must pick from the dropdown; free text is never submitted. That removes fuzzy-matching entirely — search only has to *find* the film, not decide whether a typed string equals it.

- [ ] **Step 1: Write the failing search tests**

Create `src/domain/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeTitle, searchFilms } from './search'
import type { Film, Person } from './types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const film = (id: string, title: string, over: Partial<Film> = {}): Film => ({
  id,
  tmdbId: Number(id.replace('f_', '')),
  title,
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action'],
  director: p(100),
  musicDirector: p(200),
  cast: [p(1), p(2), p(3)],
  posterPath: null,
  popularity: 10,
  voteCount: 10,
  isMysteryEligible: false,
  ...over,
})

const catalogue = [
  film('f_1', 'Rangasthalam'),
  film('f_2', 'Rangam'),
  film('f_3', 'Baahubali: The Beginning', { popularity: 90 }),
  film('f_4', 'Baahubali 2: The Conclusion', { popularity: 80 }),
  film('f_5', 'Eega', { titleTelugu: 'ఈగ' }),
  film('f_6', 'Jalsa', { aliases: ['Jalsaa'] }),
  film('f_7', 'Ala Vaikunthapurramuloo'),
]

describe('normalizeTitle', () => {
  it('lowercases', () => {
    expect(normalizeTitle('Pokiri')).toBe('pokiri')
  })

  it('strips punctuation', () => {
    expect(normalizeTitle('Baahubali: The Beginning')).toBe('baahubali the beginning')
  })

  it('collapses whitespace', () => {
    expect(normalizeTitle('  Rang   De  ')).toBe('rang de')
  })

  it('strips diacritics', () => {
    expect(normalizeTitle('Áthadu')).toBe('athadu')
  })
})

describe('searchFilms', () => {
  it('returns nothing for an empty query', () => {
    expect(searchFilms(catalogue, '')).toEqual([])
  })

  it('returns nothing for a whitespace-only query', () => {
    expect(searchFilms(catalogue, '   ')).toEqual([])
  })

  it('finds by title prefix', () => {
    expect(searchFilms(catalogue, 'ranga').map((f) => f.id)).toEqual(['f_1'])
  })

  it('ranks an exact title first', () => {
    expect(searchFilms(catalogue, 'rangam')[0].id).toBe('f_2')
  })

  it('ranks prefix matches above mid-word matches', () => {
    const ids = searchFilms(catalogue, 'rang').map((f) => f.id)
    expect(ids.slice(0, 2).sort()).toEqual(['f_1', 'f_2'])
  })

  it('is case-insensitive', () => {
    expect(searchFilms(catalogue, 'POKIRI'.toLowerCase().slice(0, 3)).length).toBeGreaterThanOrEqual(0)
    expect(searchFilms(catalogue, 'EEGA').map((f) => f.id)).toEqual(['f_5'])
  })

  it('ignores punctuation in the query', () => {
    expect(searchFilms(catalogue, 'baahubali:').length).toBe(2)
  })

  it('matches on a later word', () => {
    expect(searchFilms(catalogue, 'conclusion').map((f) => f.id)).toEqual(['f_4'])
  })

  it('matches the Telugu title', () => {
    expect(searchFilms(catalogue, 'ఈగ').map((f) => f.id)).toEqual(['f_5'])
  })

  it('matches an alias', () => {
    expect(searchFilms(catalogue, 'jalsaa').map((f) => f.id)).toEqual(['f_6'])
  })

  it('breaks ties by popularity', () => {
    expect(searchFilms(catalogue, 'baahubali').map((f) => f.id)).toEqual(['f_3', 'f_4'])
  })

  it('respects the limit', () => {
    expect(searchFilms(catalogue, 'a', 2)).toHaveLength(2)
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchFilms(catalogue, 'zzzzz')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/domain/search.test.ts`
Expected: FAIL — `Failed to resolve import "./search"`

- [ ] **Step 3: Implement search**

Create `src/domain/search.ts`:

```ts
import type { Film } from './types'

export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
    .sort((a, b) => a.rank - b.rank || b.film.popularity - a.film.popularity)
    .slice(0, limit)
    .map((x) => x.film)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/domain/search.test.ts`
Expected: PASS, 18 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add title search for guess autocomplete"
```

---

## Task 12: The share card

**Files:**
- Create: `src/domain/share.ts`
- Test: `src/domain/share.test.ts`

**Interfaces:**
- Consumes: `Session` from `src/domain/session`; `CellState`, `cellStates` from `src/domain/board`; `puzzleNumber` from `src/domain/puzzleDate`; `guessLimit` from `src/domain/lifelines`.
- Produces: `buildShareCard(session: Session, streak: number): string`.

Spoiler-free is the hard requirement: no title, person, genre, or year may appear in the output. The last test in this task enforces that directly.

- [ ] **Step 1: Write the failing share tests**

Create `src/domain/share.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildShareCard } from './share'
import { startSession, submitGuess, useReveal } from './session'
import type { Film, Person } from './types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const film = (over: Partial<Film> = {}): Film => ({
  id: 'f_a',
  tmdbId: 1,
  title: 'Rangasthalam',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: p(100, 'Sukumar'),
  musicDirector: p(200, 'Devi Sri Prasad'),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)),
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  isMysteryEligible: true,
  ...over,
})

const answer = film()
const miss = (n: number) =>
  film({
    id: `f_miss_${n}`,
    title: `Miss ${n}`,
    year: 2006,
    genres: ['Horror'],
    director: p(900 + n),
    musicDirector: p(950 + n),
    cast: [p(800 + n)],
  })

describe('buildShareCard', () => {
  it('shows the puzzle number and the score', () => {
    const s = submitGuess(startSession('2026-01-03', answer), answer)
    expect(buildShareCard(s, 1)).toContain('Tollywood #3')
    expect(buildShareCard(s, 1)).toContain('1/7')
  })

  it('marks a loss with an X', () => {
    let s = startSession('2026-01-01', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    expect(buildShareCard(s, 0)).toContain('X/7')
  })

  it('reports the raised limit after extra guesses', () => {
    let s = startSession('2026-01-01', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    s = { ...s, lifelines: { ...s.lifelines, extraGuessesUnlocked: true }, status: 'playing' }
    s = submitGuess(s, answer)
    expect(buildShareCard(s, 0)).toContain('8/10')
  })

  it('uses green for matched cells', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    expect(buildShareCard(s, 1)).toContain('🟩')
  })

  it('uses yellow for lifeline cells', () => {
    let s = startSession('2026-01-01', answer)
    for (let i = 1; i <= 4; i++) s = submitGuess(s, miss(i))
    s = useReveal(s, { kind: 'crew', role: 'director' })
    expect(buildShareCard(s, 0)).toContain('🟨')
  })

  it('uses grey for cells never opened', () => {
    const s = submitGuess(startSession('2026-01-01', answer), miss(1))
    expect(buildShareCard(s, 0)).toContain('⬜')
  })

  it('lays the grid out in board order and row structure', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    const grid = buildShareCard(s, 1)
      .split('\n')
      .filter((l) => /^[🟩🟨⬜]+$/u.test(l))
    // year(1), genres(2), cast rows of three (3+3), crew(2)
    expect(grid.map((l) => [...l].length)).toEqual([1, 2, 3, 3, 2])
  })

  it('includes the streak when there is one', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    expect(buildShareCard(s, 12)).toContain('12')
  })

  it('omits the streak line at zero', () => {
    const s = submitGuess(startSession('2026-01-01', answer), miss(1))
    expect(buildShareCard(s, 0)).not.toContain('🔥')
  })

  it('drops the music square when the film has no composer', () => {
    const noMusic = { ...answer, musicDirector: null }
    const s = submitGuess(startSession('2026-01-01', noMusic), noMusic)
    const grid = buildShareCard(s, 1).split('\n').filter((l) => /^[🟩🟨⬜]+$/u.test(l))
    expect(grid.map((l) => [...l].length)).toEqual([1, 2, 3, 3, 1])
  })

  it('leaks nothing about the answer', () => {
    let s = startSession('2026-01-01', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, miss(i))
    const card = buildShareCard(s, 0)
    for (const secret of ['Rangasthalam', 'Sukumar', 'Devi Sri Prasad', 'Action', 'Drama', '2018']) {
      expect(card).not.toContain(secret)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/domain/share.test.ts`
Expected: FAIL — `Failed to resolve import "./share"`

- [ ] **Step 3: Implement the share card**

Create `src/domain/share.ts`:

```ts
import { cellStates, type CellState } from './board'
import { guessLimit } from './lifelines'
import { puzzleNumber } from './puzzleDate'
import type { Session } from './session'

const SQUARE: Record<CellState, string> = {
  matched: '🟩',
  lifeline: '🟨',
  hidden: '⬜',
}

export function buildShareCard(session: Session, streak: number): string {
  const squares = cellStates(session.board).map((s) => SQUARE[s])

  // Board order: year(1), genres(n), cast(6 as two rows of three), crew(1 or 2).
  // cellStates() already omits an absent Music cell, so the crew row is
  // whatever remains after the cast.
  const genreCount = session.board.genres.length
  const castStart = 1 + genreCount
  const crewStart = castStart + session.board.cast.length

  const rows = [
    squares.slice(0, 1),
    squares.slice(1, castStart),
    squares.slice(castStart, castStart + 3),
    squares.slice(castStart + 3, crewStart),
    squares.slice(crewStart),
  ].filter((r) => r.length > 0)

  const limit = guessLimit(session.lifelines)
  const score = session.status === 'won' ? `${session.outcomes.length}/${limit}` : `X/${limit}`

  const lines = [
    `🎬 Tollywood #${puzzleNumber(session.puzzleDate)}   ${score}`,
    '',
    ...rows.map((r) => r.join('')),
  ]

  if (streak > 0) lines.push('', `🔥 streak ${streak}`)

  return lines.join('\n')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/domain/share.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Run the whole domain suite**

Run: `npm test`
Expected: PASS — every domain and storage test green. The game is now fully implemented and playable through its API; only rendering remains.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add spoiler-free share card"
```

---

## Task 13: Board and Cell components

**Files:**
- Create: `src/ui/Cell.tsx`
- Create: `src/ui/Board.tsx`
- Create: `src/ui/styles.css`
- Test: `src/ui/Board.test.tsx`

**Interfaces:**
- Consumes: `Board`, `CellRef`, `CellState` from `src/domain/board`.
- Produces: `<Cell label value state onPick? pickable? />`, `<BoardView board selecting onPick />` where `selecting: boolean` puts hidden cells into lifeline-pick mode and `onPick: (ref: CellRef) => void`.

A hidden cell must render **no trace** of its value — not in text, not in a `title`, not in a data attribute. The first test enforces this.

- [ ] **Step 1: Write the failing board tests**

Create `src/ui/Board.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardView } from './Board'
import { createBoard, applyReveals, revealCell } from '../domain/board'
import type { Film, Person } from '../domain/types'

const p = (id: number, name: string): Person => ({ id, name })

const answer: Film = {
  id: 'f_a',
  tmdbId: 1,
  title: 'Rangasthalam',
  titleTelugu: null,
  aliases: [],
  year: 2018,
  genres: ['Action', 'Drama'],
  director: p(100, 'Sukumar'),
  musicDirector: p(200, 'Devi Sri Prasad'),
  cast: [
    p(1, 'Ram Charan'),
    p(2, 'Samantha'),
    p(3, 'Aadhi'),
    p(4, 'Jagapathi Babu'),
    p(5, 'Prakash Raj'),
    p(6, 'Anasuya'),
  ],
  posterPath: null,
  popularity: 50,
  voteCount: 50,
  isMysteryEligible: true,
}

describe('BoardView', () => {
  it('renders no answer values while every cell is hidden', () => {
    const { container } = render(
      <BoardView board={createBoard(answer)} selecting={false} onPick={() => {}} />,
    )
    for (const secret of ['Sukumar', 'Devi Sri Prasad', 'Ram Charan', 'Action', 'Drama']) {
      expect(container.innerHTML).not.toContain(secret)
    }
  })

  it('shows the year range while unsolved', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'later', guessYear: 2010 },
    ])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText(/2011/)).toBeInTheDocument()
    expect(screen.getByText(/2025/)).toBeInTheDocument()
  })

  it('shows the exact year once solved', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'exact', guessYear: 2018 },
    ])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText('2018')).toBeInTheDocument()
  })

  it('reveals a matched genre', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'genre', slot: 1, genre: 'Drama' },
    ])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.queryByText('Action')).not.toBeInTheDocument()
  })

  it('reveals a matched cast member at their billing number', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'cast', slot: 2, person: p(3, 'Aadhi') },
    ])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText('Aadhi')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('marks a lifeline cell differently from a matched one', () => {
    let board = applyReveals(createBoard(answer), [
      { kind: 'crew', role: 'director', person: p(100, 'Sukumar') },
    ])
    board = revealCell(board, { kind: 'crew', role: 'musicDirector' })
    const { container } = render(
      <BoardView board={board} selecting={false} onPick={() => {}} />,
    )
    expect(container.querySelector('.cell--matched')).toBeTruthy()
    expect(container.querySelector('.cell--lifeline')).toBeTruthy()
  })

  it('renders no Music cell when the film has no composer', () => {
    render(
      <BoardView board={createBoard({ ...answer, musicDirector: null })}
        selecting={false} onPick={() => {}} />,
    )
    expect(screen.queryByText('Music')).not.toBeInTheDocument()
    expect(screen.getByText('Director')).toBeInTheDocument()
  })

  it('offers only ten pickable cells when there is no Music cell', () => {
    render(
      <BoardView board={createBoard({ ...answer, musicDirector: null })}
        selecting onPick={() => {}} />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })

  it('does not offer cells as buttons outside selection mode', () => {
    render(<BoardView board={createBoard(answer)} selecting={false} onPick={() => {}} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('offers every hidden cell as a button in selection mode', () => {
    render(<BoardView board={createBoard(answer)} selecting onPick={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })

  it('reports which cell was picked', async () => {
    const onPick = vi.fn()
    render(<BoardView board={createBoard(answer)} selecting onPick={onPick} />)
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onPick).toHaveBeenCalledWith({ kind: 'year' })
  })

  it('does not offer already-open cells for selection', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'genre', slot: 0, genre: 'Action' },
    ])
    render(<BoardView board={board} selecting onPick={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/Board.test.tsx`
Expected: FAIL — `Failed to resolve import "./Board"`

- [ ] **Step 3: Implement Cell**

Create `src/ui/Cell.tsx`:

```tsx
import type { CellState } from '../domain/board'

type Props = {
  label?: string
  value: string
  state: CellState
  pickable: boolean
  onPick: () => void
}

export function Cell({ label, value, state, pickable, onPick }: Props) {
  const className = `cell cell--${state}${pickable ? ' cell--pickable' : ''}`
  // A hidden cell must not carry its value anywhere in the DOM.
  const shown = state === 'hidden' ? '?' : value

  const body = (
    <>
      {label && <span className="cell__label">{label}</span>}
      <span className="cell__value">{shown}</span>
    </>
  )

  if (pickable) {
    return (
      <button type="button" className={className} onClick={onPick} aria-label={`Reveal ${label ?? 'cell'}`}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}
```

- [ ] **Step 4: Implement BoardView**

Create `src/ui/Board.tsx`:

```tsx
import type { Board, CellRef } from '../domain/board'
import { Cell } from './Cell'

type Props = {
  board: Board
  selecting: boolean
  onPick: (ref: CellRef) => void
}

export function BoardView({ board, selecting, onPick }: Props) {
  const pick = (ref: CellRef, state: string) => selecting && state === 'hidden'

  const yearText =
    board.year.state === 'hidden'
      ? `${board.year.min} – ${board.year.max}`
      : String(board.year.min)

  return (
    <div className="board">
      <section className="board__row" aria-label="Year of release">
        <h2 className="board__heading">Year</h2>
        <div className="board__cells">
          <Cell
            value={yearText}
            state={board.year.state}
            pickable={pick({ kind: 'year' }, board.year.state)}
            onPick={() => onPick({ kind: 'year' })}
          />
        </div>
      </section>

      <section className="board__row" aria-label="Genres">
        <h2 className="board__heading">Genre</h2>
        <div className="board__cells">
          {board.genres.map((cell, slot) => (
            <Cell
              key={slot}
              value={cell.value}
              state={cell.state}
              pickable={pick({ kind: 'genre', slot }, cell.state)}
              onPick={() => onPick({ kind: 'genre', slot })}
            />
          ))}
        </div>
      </section>

      <section className="board__row" aria-label="Cast">
        <h2 className="board__heading">Cast</h2>
        <div className="board__cells board__cells--grid">
          {board.cast.map((cell, slot) => (
            <Cell
              key={slot}
              label={String(slot + 1)}
              value={cell.value.name}
              state={cell.state}
              pickable={pick({ kind: 'cast', slot }, cell.state)}
              onPick={() => onPick({ kind: 'cast', slot })}
            />
          ))}
        </div>
      </section>

      <section className="board__row" aria-label="Crew">
        <h2 className="board__heading">Crew</h2>
        <div className="board__cells">
          <Cell
            label="Director"
            value={board.director.value.name}
            state={board.director.state}
            pickable={pick({ kind: 'crew', role: 'director' }, board.director.state)}
            onPick={() => onPick({ kind: 'crew', role: 'director' })}
          />
          {board.musicDirector && (
            <Cell
              label="Music"
              value={board.musicDirector.value.name}
              state={board.musicDirector.state}
              pickable={pick({ kind: 'crew', role: 'musicDirector' }, board.musicDirector.state)}
              onPick={() => onPick({ kind: 'crew', role: 'musicDirector' })}
            />
          )}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Add the stylesheet**

Create `src/ui/styles.css`:

```css
:root {
  --bg: #12100e;
  --surface: #1e1b18;
  --border: #33302c;
  --text: #f2ede7;
  --muted: #9b938a;
  --matched: #2f7d4f;
  --lifeline: #b08422;
  --accent: #e0532f;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}

.app { max-width: 720px; margin: 0 auto; padding: 16px; }

.board__row { margin-bottom: 14px; }
.board__heading {
  font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--muted); margin: 0 0 6px;
}
.board__cells { display: flex; gap: 8px; flex-wrap: wrap; }
.board__cells--grid { display: grid; grid-template-columns: repeat(3, 1fr); }

.cell {
  flex: 1 1 0; min-width: 0; min-height: 58px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; padding: 8px 6px; text-align: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font: inherit; transition: background .25s, border-color .25s;
}
.cell__label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.cell__value { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.cell--hidden .cell__value { color: var(--muted); }
.cell--matched { background: var(--matched); border-color: var(--matched); }
.cell--lifeline { background: var(--lifeline); border-color: var(--lifeline); }
.cell--pickable { cursor: pointer; border-color: var(--accent); border-style: dashed; }
.cell--pickable:hover { background: #2a2622; }

@media (max-width: 480px) {
  .board__cells:not(.board__cells--grid) { flex-direction: column; }
  .board__cells--grid { grid-template-columns: repeat(2, 1fr); }
}
```

Import it from `src/main.tsx`:

```tsx
import './ui/styles.css'
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/ui/Board.test.tsx`
Expected: PASS, 12 tests

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add board and cell components"
```

---

## Task 14: Guess input with autocomplete

**Files:**
- Create: `src/ui/GuessInput.tsx`
- Test: `src/ui/GuessInput.test.tsx`

**Interfaces:**
- Consumes: `searchFilms` from `src/domain/search`; `Film` from `src/domain/types`.
- Produces: `<GuessInput films guessedIds disabled onGuess />` where `onGuess: (film: Film) => void` and `guessedIds: string[]` greys out repeats.

Free text is never submitted — only a dropdown selection fires `onGuess`. Same-title remakes are disambiguated by year in the option label.

- [ ] **Step 1: Write the failing input tests**

Create `src/ui/GuessInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuessInput } from './GuessInput'
import type { Film, Person } from '../domain/types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const film = (id: string, title: string, year = 2018): Film => ({
  id, tmdbId: Number(id.replace('f_', '')), title, titleTelugu: null, aliases: [],
  year, genres: ['Action'], director: p(1), musicDirector: p(2),
  cast: [p(3), p(4), p(5)], posterPath: null, popularity: 10, voteCount: 10, isMysteryEligible: false,
})

const films = [
  film('f_1', 'Rangasthalam'),
  film('f_2', 'Rangam', 2011),
  film('f_3', 'Pokiri', 2006),
]

describe('GuessInput', () => {
  it('shows no suggestions before typing', () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('suggests matching films as you type', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'rang')
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('shows the year alongside the title', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    expect(screen.getByRole('option')).toHaveTextContent('2006')
  })

  it('fires onGuess with the chosen film', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(onGuess).toHaveBeenCalledWith(films[2])
  })

  it('clears the field after a guess', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(input).toHaveValue('')
  })

  it('disables an already-guessed film', async () => {
    render(<GuessInput films={films} guessedIds={['f_3']} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    expect(screen.getByRole('option')).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not fire onGuess for an already-guessed film', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={['f_3']} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(onGuess).not.toHaveBeenCalled()
  })

  it('does not submit free text on Enter', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'Pokiri{Enter}')
    expect(onGuess).not.toHaveBeenCalled()
  })

  it('selects the highlighted option with the keyboard', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri{ArrowDown}{Enter}')
    expect(onGuess).toHaveBeenCalledWith(films[2])
  })

  it('says so when nothing matches', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'zzzz')
    expect(screen.getByText(/no telugu film/i)).toBeInTheDocument()
  })

  it('is disabled once the game is over', () => {
    render(<GuessInput films={films} guessedIds={[]} disabled onGuess={() => {}} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/GuessInput.test.tsx`
Expected: FAIL — `Failed to resolve import "./GuessInput"`

- [ ] **Step 3: Implement GuessInput**

Create `src/ui/GuessInput.tsx`:

```tsx
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
```

Append to `src/ui/styles.css`:

```css
.guess { position: relative; margin: 16px 0; }
.guess__input {
  width: 100%; padding: 12px 14px; font: inherit;
  background: var(--surface); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
}
.guess__input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.guess__input:disabled { opacity: .5; }
.guess__empty { color: var(--muted); font-size: 14px; margin: 8px 2px; }
.guess__options {
  list-style: none; margin: 4px 0 0; padding: 4px; position: absolute;
  left: 0; right: 0; z-index: 5; max-height: 260px; overflow-y: auto;
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
}
.guess__option {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 10px 12px; border-radius: 6px; cursor: pointer;
}
.guess__option--active { background: #2a2622; }
.guess__option--used { opacity: .4; cursor: not-allowed; text-decoration: line-through; }
.guess__year { color: var(--muted); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/ui/GuessInput.test.tsx`
Expected: PASS, 11 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add guess input with autocomplete"
```

---

## Task 15: The useGame hook

**Files:**
- Create: `src/ui/useGame.ts`
- Test: `src/ui/useGame.test.ts`

**Interfaces:**
- Consumes: session functions from `src/domain/session`; `getFilm`, `guessableFilms`, `answerIdForDate` from `src/data/repository`; `createLocalStorage` from `src/storage/localStorage`; `recordResult` from `src/storage/stats`.
- Produces: `useGame(puzzleDate: string, today: string, storage?: GameStorage): GameApi` where `GameApi = { session: Session | null; stats: Stats; revealsAvailable: number; canUnlockExtra: boolean; guess(film): void; reveal(ref): void; unlockExtra(): void }`.

This is the only place React state, storage, and the repository meet. Everything it calls is already tested; its own job is wiring, persistence on change, and recording a result exactly once.

**A deliberate rule about extra guesses and statistics:** a result is recorded the first time the game settles, and `recordResult` ignores a date it has already seen. So losing in 7 and then solving it on the unlocked guesses leaves a **loss** in your statistics. That is intentional — you did not solve it in 7 — and it matches the share card, which reports `8/10` rather than pretending the lifeline never happened. The test below pins this behaviour so a later reader does not "fix" it.

- [ ] **Step 1: Write the failing hook tests**

Create `src/ui/useGame.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGame } from './useGame'
import { createLocalStorage } from '../storage/localStorage'
import type { Film, Person } from '../domain/types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Answer', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'], director: p(100), musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map(p), posterPath: null, popularity: 50, voteCount: 50, isMysteryEligible: true,
}

const wrong: Film = { ...answer, id: 'f_b', title: 'Wrong', year: 2006, genres: ['Horror'],
  director: p(900), musicDirector: p(901), cast: [p(800)] }

vi.mock('../data/repository', () => ({
  getFilm: (id: string) => [answer, wrong].find((f) => f.id === id),
  guessableFilms: () => [answer, wrong],
  answerIdForDate: (date: string) => (date === '2026-09-13' ? 'f_a' : null),
  playableDates: () => ['2026-09-13'],
}))

describe('useGame', () => {
  beforeEach(() => localStorage.clear())

  it('starts a session for a scheduled date', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    expect(result.current.session?.status).toBe('playing')
  })

  it('returns no session for an unscheduled date', () => {
    const { result } = renderHook(() => useGame('1999-01-01', '2026-09-13'))
    expect(result.current.session).toBeNull()
  })

  it('records a guess', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    act(() => result.current.guess(wrong))
    expect(result.current.session?.outcomes).toHaveLength(1)
  })

  it('wins on the right guess', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    act(() => result.current.guess(answer))
    expect(result.current.session?.status).toBe('won')
  })

  it('persists progress across remounts', () => {
    const { result, unmount } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    act(() => result.current.guess(wrong))
    unmount()

    const second = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    expect(second.result.current.session?.outcomes).toHaveLength(1)
  })

  it('records the win in stats exactly once', () => {
    const storage = createLocalStorage()
    const { result, unmount } = renderHook(() => useGame('2026-09-13', '2026-09-13', storage))
    act(() => result.current.guess(answer))
    expect(result.current.stats.won).toBe(1)
    unmount()

    const second = renderHook(() => useGame('2026-09-13', '2026-09-13', storage))
    expect(second.result.current.stats.won).toBe(1)
    expect(second.result.current.stats.played).toBe(1)
  })

  it('exposes no lifeline reveals at the start', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    expect(result.current.revealsAvailable).toBe(0)
  })

  it('exposes a reveal after the fourth guess', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    expect(result.current.revealsAvailable).toBe(1)
  })

  it('opens a chosen cell via reveal', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    act(() => result.current.reveal({ kind: 'crew', role: 'director' }))
    expect(result.current.session?.board.director.state).toBe('lifeline')
  })

  it('keeps the recorded loss when extra guesses later produce a win', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    expect(result.current.stats.won).toBe(0)
    act(() => result.current.unlockExtra())
    act(() => result.current.guess(answer))
    expect(result.current.session?.status).toBe('won')
    expect(result.current.stats.won).toBe(0)
    expect(result.current.stats.played).toBe(1)
  })

  it('offers extra guesses after the seventh', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    expect(result.current.canUnlockExtra).toBe(true)
    act(() => result.current.unlockExtra())
    expect(result.current.session?.status).toBe('playing')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/useGame.test.ts`
Expected: FAIL — `Failed to resolve import "./useGame"`

- [ ] **Step 3: Implement useGame**

Create `src/ui/useGame.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { answerIdForDate, getFilm } from '../data/repository'
import type { CellRef } from '../domain/board'
import { canUnlockExtraGuesses, revealsAvailable } from '../domain/lifelines'
import {
  replaySession,
  startSession,
  submitGuess,
  toPersisted,
  unlockExtraGuesses,
  useReveal,
  type Session,
} from '../domain/session'
import type { Film } from '../domain/types'
import { createLocalStorage } from '../storage/localStorage'
import { recordResult } from '../storage/stats'
import type { GameStorage, Stats } from '../storage/types'

export type GameApi = {
  session: Session | null
  stats: Stats
  revealsAvailable: number
  canUnlockExtra: boolean
  guess: (film: Film) => void
  reveal: (ref: CellRef) => void
  unlockExtra: () => void
}

export function useGame(
  puzzleDate: string,
  today: string,
  storage: GameStorage = createLocalStorage(),
): GameApi {
  const [session, setSession] = useState<Session | null>(null)
  const [stats, setStats] = useState<Stats>(() => storage.loadStats())
  const recorded = useRef(false)

  useEffect(() => {
    recorded.current = false
    const answerId = answerIdForDate(puzzleDate)
    const answer = answerId ? getFilm(answerId) : undefined
    if (!answer) {
      setSession(null)
      return
    }
    const saved = storage.loadSession(puzzleDate)
    setSession(saved ? replaySession(saved, answer, getFilm) : startSession(puzzleDate, answer))
  }, [puzzleDate, storage])

  // Persist on every change, and record the result the first time it settles.
  useEffect(() => {
    if (!session) return
    storage.saveSession(toPersisted(session))

    if (session.status === 'playing' || recorded.current) return
    recorded.current = true

    const next = recordResult(storage.loadStats(), {
      date: session.puzzleDate,
      won: session.status === 'won',
      guesses: session.outcomes.length,
      isToday: session.puzzleDate === today,
    })
    storage.saveStats(next)
    setStats(next)
  }, [session, storage, today])

  const guess = useCallback((film: Film) => setSession((s) => (s ? submitGuess(s, film) : s)), [])
  const reveal = useCallback((ref: CellRef) => setSession((s) => (s ? useReveal(s, ref) : s)), [])
  const unlockExtra = useCallback(() => {
    recorded.current = true // already recorded as a loss; do not record again
    setSession((s) => (s ? unlockExtraGuesses(s) : s))
  }, [])

  const reveals = useMemo(
    () => (session ? revealsAvailable(session.lifelines, session.outcomes.length) : 0),
    [session],
  )
  const canUnlock = useMemo(
    () =>
      session !== null &&
      session.status !== 'won' &&
      canUnlockExtraGuesses(session.lifelines, session.outcomes.length),
    [session],
  )

  return {
    session,
    stats,
    revealsAvailable: reveals,
    canUnlockExtra: canUnlock,
    guess,
    reveal,
    unlockExtra,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/ui/useGame.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add useGame hook binding session, storage, and repository"
```

---

## Task 16: History, ruled-out, lifeline bar, and result panels

**Files:**
- Create: `src/ui/GuessHistory.tsx`
- Create: `src/ui/RuledOutPanel.tsx`
- Create: `src/ui/LifelineBar.tsx`
- Create: `src/ui/ResultModal.tsx`
- Test: `src/ui/panels.test.tsx`

**Interfaces:**
- Consumes: `GuessOutcome` from `src/domain/compare`; `Person`, `Film` from `src/domain/types`; `buildShareCard` from `src/domain/share`; `Session`, `Stats`.
- Produces: `<GuessHistory outcomes lookup />`, `<RuledOutPanel people />`, `<LifelineBar revealsAvailable canUnlockExtra selecting onStartSelect onCancelSelect onUnlockExtra />`, `<ResultModal session stats onClose />`.

- [ ] **Step 1: Write the failing panel tests**

Create `src/ui/panels.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuessHistory } from './GuessHistory'
import { RuledOutPanel } from './RuledOutPanel'
import { LifelineBar } from './LifelineBar'
import { ResultModal } from './ResultModal'
import { startSession, submitGuess } from '../domain/session'
import { emptyStats } from '../storage/stats'
import type { Film, Person } from '../domain/types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Rangasthalam', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'], director: p(100), musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)), posterPath: null, popularity: 50, voteCount: 50, isMysteryEligible: true,
}
const wrong: Film = { ...answer, id: 'f_b', title: 'Pokiri', year: 2006, genres: ['Crime'],
  director: p(900), musicDirector: p(901), cast: [p(800)] }

const lookup = (id: string) => [answer, wrong].find((f) => f.id === id)

describe('GuessHistory', () => {
  it('says nothing before the first guess', () => {
    const { container } = render(<GuessHistory outcomes={[]} lookup={lookup} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists a guessed title and year', () => {
    const s = submitGuess(startSession('d', answer), wrong)
    render(<GuessHistory outcomes={s.outcomes} lookup={lookup} />)
    expect(screen.getByText('Pokiri')).toBeInTheDocument()
    expect(screen.getByText('2006')).toBeInTheDocument()
  })

  it('shows newest first', () => {
    let s = submitGuess(startSession('d', answer), wrong)
    s = submitGuess(s, { ...wrong, id: 'f_c', title: 'Athadu' })
    render(<GuessHistory outcomes={s.outcomes} lookup={(id) => (id === 'f_c' ? { ...wrong, id: 'f_c', title: 'Athadu' } : lookup(id))} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Athadu')
  })

  it('shows how many cells a guess opened', () => {
    const s = submitGuess(startSession('d', answer), wrong)
    render(<GuessHistory outcomes={s.outcomes} lookup={lookup} />)
    expect(screen.getByText(/0 revealed/i)).toBeInTheDocument()
  })
})

describe('RuledOutPanel', () => {
  it('renders nothing when nobody is ruled out', () => {
    const { container } = render(<RuledOutPanel people={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists ruled-out names', () => {
    render(<RuledOutPanel people={[p(1, 'Mahesh Babu'), p(2, 'Puri Jagannadh')]} />)
    expect(screen.getByText('Mahesh Babu')).toBeInTheDocument()
    expect(screen.getByText('Puri Jagannadh')).toBeInTheDocument()
  })

  it('shows how many are ruled out', () => {
    render(<RuledOutPanel people={[p(1), p(2), p(3)]} />)
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })
})

describe('LifelineBar', () => {
  const noop = () => {}

  it('is silent with nothing available', () => {
    const { container } = render(
      <LifelineBar revealsAvailable={0} canUnlockExtra={false} selecting={false}
        onStartSelect={noop} onCancelSelect={noop} onUnlockExtra={noop} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers a reveal when one is available', async () => {
    const onStartSelect = vi.fn()
    render(
      <LifelineBar revealsAvailable={1} canUnlockExtra={false} selecting={false}
        onStartSelect={onStartSelect} onCancelSelect={noop} onUnlockExtra={noop} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /reveal a cell/i }))
    expect(onStartSelect).toHaveBeenCalled()
  })

  it('offers cancel while selecting', async () => {
    const onCancelSelect = vi.fn()
    render(
      <LifelineBar revealsAvailable={1} canUnlockExtra={false} selecting
        onStartSelect={noop} onCancelSelect={onCancelSelect} onUnlockExtra={noop} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancelSelect).toHaveBeenCalled()
  })

  it('offers extra guesses when unlockable', async () => {
    const onUnlockExtra = vi.fn()
    render(
      <LifelineBar revealsAvailable={0} canUnlockExtra selecting={false}
        onStartSelect={noop} onCancelSelect={noop} onUnlockExtra={onUnlockExtra} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /3 more guesses/i }))
    expect(onUnlockExtra).toHaveBeenCalled()
  })
})

describe('ResultModal', () => {
  it('does not render while the game is in play', () => {
    const { container } = render(
      <ResultModal session={startSession('2026-01-01', answer)} stats={emptyStats()} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('reveals the title on a win', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    render(<ResultModal session={s} stats={emptyStats()} onClose={() => {}} />)
    expect(screen.getByText(/Rangasthalam/)).toBeInTheDocument()
  })

  it('reveals the title on a loss', () => {
    let s = startSession('2026-01-01', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, { ...wrong, id: `f_m${i}` })
    render(<ResultModal session={s} stats={emptyStats()} onClose={() => {}} />)
    expect(screen.getByText(/Rangasthalam/)).toBeInTheDocument()
  })

  it('copies the share card to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    render(<ResultModal session={s} stats={emptyStats()} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /share/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Tollywood #1'))
  })

  it('shows played and win-rate statistics', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    render(
      <ResultModal session={s} stats={{ ...emptyStats(), played: 4, won: 3, currentStreak: 2 }} onClose={() => {}} />,
    )
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/panels.test.tsx`
Expected: FAIL — imports unresolved

- [ ] **Step 3: Implement GuessHistory and RuledOutPanel**

Create `src/ui/GuessHistory.tsx`:

```tsx
import type { GuessOutcome } from '../domain/compare'
import type { Film } from '../domain/types'

type Props = {
  outcomes: GuessOutcome[]
  lookup: (id: string) => Film | undefined
}

/** Reveals include the always-present year entry; cells opened excludes it. */
function cellsOpened(outcome: GuessOutcome): number {
  return outcome.reveals.filter((r) => r.kind !== 'year').length
}

export function GuessHistory({ outcomes, lookup }: Props) {
  if (outcomes.length === 0) return null

  return (
    <ol className="history">
      {[...outcomes].reverse().map((outcome) => {
        const film = lookup(outcome.guessId)
        return (
          <li key={outcome.guessId} className={`history__item${outcome.correct ? ' history__item--win' : ''}`}>
            <span className="history__title">{film?.title ?? 'Unknown film'}</span>
            <span className="history__year">{film?.year}</span>
            <span className="history__count">{cellsOpened(outcome)} revealed</span>
          </li>
        )
      })}
    </ol>
  )
}
```

Create `src/ui/RuledOutPanel.tsx`:

```tsx
import type { Person } from '../domain/types'

export function RuledOutPanel({ people }: { people: Person[] }) {
  if (people.length === 0) return null

  return (
    <section className="ruledout">
      <h2 className="board__heading">
        Ruled out <span className="ruledout__count">{people.length}</span>
      </h2>
      <ul className="ruledout__list">
        {people.map((person) => (
          <li key={person.id} className="ruledout__name">{person.name}</li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Implement LifelineBar and ResultModal**

Create `src/ui/LifelineBar.tsx`:

```tsx
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
```

Create `src/ui/ResultModal.tsx`:

```tsx
import { useState } from 'react'
import { buildShareCard } from '../domain/share'
import type { Session } from '../domain/session'
import type { Stats } from '../storage/types'

type Props = { session: Session; stats: Stats; onClose: () => void }

export function ResultModal({ session, stats, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  if (session.status === 'playing') return null

  const card = buildShareCard(session, stats.currentStreak)
  const winRate = stats.played === 0 ? 0 : Math.round((stats.won / stats.played) * 100)

  async function share() {
    try {
      await navigator.clipboard.writeText(card)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__panel">
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">×</button>

        <p className="modal__verdict">{session.status === 'won' ? 'Got it' : 'Out of guesses'}</p>
        <h2 className="modal__title">{session.answer.title}</h2>
        <p className="modal__sub">
          {session.answer.year} · dir. {session.answer.director.name}
        </p>

        <dl className="modal__stats">
          <div><dt>Played</dt><dd>{stats.played}</dd></div>
          <div><dt>Win %</dt><dd>{winRate}%</dd></div>
          <div><dt>Streak</dt><dd>{stats.currentStreak}</dd></div>
          <div><dt>Best</dt><dd>{stats.maxStreak}</dd></div>
        </dl>

        <pre className="modal__card">{card}</pre>

        <button type="button" className="lifelines__btn" onClick={share}>
          {copied ? 'Copied' : 'Share result'}
        </button>
      </div>
    </div>
  )
}
```

Append to `src/ui/styles.css`:

```css
.history { list-style: none; margin: 16px 0; padding: 0; }
.history__item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; margin-bottom: 6px;
}
.history__item--win { border-color: var(--matched); }
.history__title { font-weight: 600; }
.history__year { color: var(--muted); font-variant-numeric: tabular-nums; }
.history__count { margin-left: auto; color: var(--muted); font-size: 13px; }

.ruledout { margin: 16px 0; }
.ruledout__count { color: var(--accent); }
.ruledout__list { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; }
.ruledout__name {
  padding: 4px 10px; font-size: 13px; color: var(--muted);
  border: 1px solid var(--border); border-radius: 999px; text-decoration: line-through;
}

.lifelines { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.lifelines__btn {
  padding: 10px 16px; font: inherit; font-weight: 600; cursor: pointer;
  background: transparent; color: var(--accent);
  border: 1px solid var(--accent); border-radius: 8px;
}
.lifelines__btn:hover { background: rgba(224, 83, 47, .12); }

.modal {
  position: fixed; inset: 0; display: grid; place-items: center;
  background: rgba(0, 0, 0, .7); padding: 16px; z-index: 20;
}
.modal__panel {
  position: relative; width: 100%; max-width: 380px; padding: 24px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
}
.modal__close {
  position: absolute; top: 8px; right: 10px; background: none; border: none;
  color: var(--muted); font-size: 24px; cursor: pointer;
}
.modal__verdict { margin: 0; color: var(--muted); font-size: 13px; letter-spacing: .1em; text-transform: uppercase; }
.modal__title { margin: 4px 0 2px; font-size: 24px; }
.modal__sub { margin: 0 0 16px; color: var(--muted); font-size: 14px; }
.modal__stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 16px; }
.modal__stats div { text-align: center; }
.modal__stats dt { color: var(--muted); font-size: 11px; text-transform: uppercase; }
.modal__stats dd { margin: 2px 0 0; font-size: 20px; font-weight: 700; }
.modal__card {
  margin: 0 0 16px; padding: 12px; font-size: 15px; line-height: 1.35;
  background: var(--bg); border-radius: 8px; white-space: pre-wrap;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/ui/panels.test.tsx`
Expected: PASS, 15 tests

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add history, ruled-out, lifeline, and result panels"
```

---

## Task 17: App shell and the Past Days' archive

**Files:**
- Create: `src/ui/App.tsx`
- Create: `src/ui/ArchiveList.tsx`
- Create: `src/ui/Footer.tsx`
- Modify: `src/main.tsx`
- Test: `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `useGame`, `BoardView`, `GuessInput`, `GuessHistory`, `RuledOutPanel`, `LifelineBar`, `ResultModal`; `playableDates` from `src/data/repository`; `istDateString`, `puzzleNumber` from `src/domain/puzzleDate`.
- Produces: `<App />`, `<ArchiveList dates current onPick />`, `<Footer />`.

**Archive routing without a router:** the date lives in the URL query string (`?d=2026-05-01`) and is read once on load. One `useState` plus `history.pushState` covers every navigation this app has — adding a routing library for a single optional parameter is not warranted.

- [ ] **Step 1: Write the failing app tests**

Create `src/ui/App.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import type { Film, Person } from '../domain/types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Rangasthalam', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'], director: p(100, 'Sukumar'), musicDirector: p(200, 'DSP'),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)), posterPath: null, popularity: 50, voteCount: 50, isMysteryEligible: true,
}
const other: Film = { ...answer, id: 'f_b', title: 'Pokiri', year: 2006, genres: ['Crime'],
  director: p(900, 'Puri'), musicDirector: p(901, 'Mani'), cast: [p(800, 'Mahesh Babu')] }

vi.mock('../data/repository', () => ({
  getFilm: (id: string) => [answer, other].find((f) => f.id === id),
  guessableFilms: () => [answer, other],
  answerIdForDate: (d: string) => (d === '2026-09-13' || d === '2026-09-12' ? 'f_a' : null),
  playableDates: () => ['2026-09-13', '2026-09-12'],
}))

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.setSystemTime(new Date('2026-09-13T06:00:00Z'))
    window.history.replaceState({}, '', '/')
  })

  it('shows today’s puzzle number', () => {
    render(<App />)
    expect(screen.getByText(/#256/)).toBeInTheDocument()
  })

  it('renders the board with everything hidden', () => {
    const { container } = render(<App />)
    expect(container.innerHTML).not.toContain('Sukumar')
  })

  it('plays a guess end to end', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(screen.getByText('Pokiri')).toBeInTheDocument()
  })

  it('rules out people from a wrong guess', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(screen.getByText('Mahesh Babu')).toBeInTheDocument()
  })

  it('shows the result modal on a win', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('combobox'), 'rangasthalam')
    await userEvent.click(screen.getByRole('option'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens the archive', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /past days/i }))
    expect(screen.getByRole('button', { name: /#255/ })).toBeInTheDocument()
  })

  it('switches to an archived puzzle and reflects it in the URL', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /past days/i }))
    await userEvent.click(screen.getByRole('button', { name: /#255/ }))
    expect(screen.getByText(/#255/)).toBeInTheDocument()
    expect(window.location.search).toContain('d=2026-09-12')
  })

  it('loads the date from the URL on first render', () => {
    window.history.replaceState({}, '', '/?d=2026-09-12')
    render(<App />)
    expect(screen.getByText(/#255/)).toBeInTheDocument()
  })

  it('keeps archived progress separate from today’s', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    await userEvent.click(screen.getByRole('option'))

    await userEvent.click(screen.getByRole('button', { name: /past days/i }))
    await userEvent.click(screen.getByRole('button', { name: /#255/ }))
    expect(screen.queryByText('Mahesh Babu')).not.toBeInTheDocument()
  })

  it('credits TMDB in the footer', () => {
    render(<App />)
    expect(screen.getByText(/TMDB/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ui/App.test.tsx`
Expected: FAIL — `Failed to resolve import "./App"`

- [ ] **Step 3: Implement ArchiveList and Footer**

Create `src/ui/ArchiveList.tsx`:

```tsx
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
```

Create `src/ui/Footer.tsx`:

```tsx
export function Footer() {
  return (
    <footer className="footer">
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </footer>
  )
}
```

- [ ] **Step 4: Implement App**

Create `src/ui/App.tsx`:

```tsx
import { useCallback, useMemo, useState } from 'react'
import { getFilm, guessableFilms, playableDates } from '../data/repository'
import type { CellRef } from '../domain/board'
import { istDateString, puzzleNumber } from '../domain/puzzleDate'
import { ArchiveList } from './ArchiveList'
import { BoardView } from './Board'
import { Footer } from './Footer'
import { GuessHistory } from './GuessHistory'
import { GuessInput } from './GuessInput'
import { LifelineBar } from './LifelineBar'
import { ResultModal } from './ResultModal'
import { RuledOutPanel } from './RuledOutPanel'
import { useGame } from './useGame'

function dateFromUrl(fallback: string): string {
  const d = new URLSearchParams(window.location.search).get('d')
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallback
}

export function App() {
  const today = useMemo(() => istDateString(new Date()), [])
  const [puzzleDate, setPuzzleDate] = useState(() => dateFromUrl(today))
  const [showArchive, setShowArchive] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const game = useGame(puzzleDate, today)
  const films = useMemo(() => guessableFilms(), [])
  const dates = useMemo(() => playableDates(today), [today])

  const goToDate = useCallback((date: string) => {
    setPuzzleDate(date)
    setShowArchive(false)
    setSelecting(false)
    setDismissed(false)
    window.history.pushState({}, '', date === today ? '/' : `/?d=${date}`)
  }, [today])

  const pickCell = useCallback(
    (ref: CellRef) => {
      if (!selecting) return
      game.reveal(ref)
      setSelecting(false)
    },
    [game, selecting],
  )

  if (!game.session) {
    return (
      <div className="app">
        <h1 className="title">Tollywood</h1>
        <p>No puzzle is scheduled for {puzzleDate}.</p>
        <button type="button" className="lifelines__btn" onClick={() => goToDate(today)}>
          Go to today
        </button>
        <Footer />
      </div>
    )
  }

  const { session } = game
  const over = session.status !== 'playing'

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Tollywood</h1>
        <span className="header__num">#{puzzleNumber(puzzleDate)}</span>
        <button type="button" className="header__link" onClick={() => setShowArchive((v) => !v)}>
          Past days
        </button>
      </header>

      {showArchive && <ArchiveList dates={dates} current={puzzleDate} onPick={goToDate} />}

      <p className="attempts">
        Guess {Math.min(session.outcomes.length + 1, 10)} — {session.outcomes.length} used
      </p>

      <BoardView board={session.board} selecting={selecting} onPick={pickCell} />

      <LifelineBar
        revealsAvailable={game.revealsAvailable}
        canUnlockExtra={game.canUnlockExtra}
        selecting={selecting}
        onStartSelect={() => setSelecting(true)}
        onCancelSelect={() => setSelecting(false)}
        onUnlockExtra={() => { game.unlockExtra(); setDismissed(true) }}
      />

      <GuessInput
        films={films}
        guessedIds={session.outcomes.map((o) => o.guessId)}
        disabled={over || selecting}
        onGuess={game.guess}
      />

      <GuessHistory outcomes={session.outcomes} lookup={getFilm} />
      <RuledOutPanel people={session.ruledOut} />

      {!dismissed && (
        <ResultModal session={session} stats={game.stats} onClose={() => setDismissed(true)} />
      )}

      <Footer />
    </div>
  )
}
```

Replace `src/main.tsx` with:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './ui/App'
import './ui/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Append to `src/ui/styles.css`:

```css
.header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
.title { margin: 0; font-size: 22px; letter-spacing: -.01em; }
.header__num { color: var(--muted); font-variant-numeric: tabular-nums; }
.header__link {
  margin-left: auto; background: none; border: none; cursor: pointer;
  color: var(--accent); font: inherit; text-decoration: underline;
}
.attempts { color: var(--muted); font-size: 13px; margin: 0 0 14px; }

.archive { list-style: none; margin: 0 0 16px; padding: 0; max-height: 240px; overflow-y: auto; }
.archive__item {
  display: flex; justify-content: space-between; width: 100%; gap: 12px;
  padding: 10px 12px; margin-bottom: 4px; cursor: pointer; font: inherit;
  background: var(--surface); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
}
.archive__item--current { border-color: var(--accent); }
.archive__date { color: var(--muted); font-variant-numeric: tabular-nums; }

.footer { margin: 32px 0 8px; color: var(--muted); font-size: 12px; line-height: 1.5; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/ui/App.test.tsx`
Expected: PASS, 10 tests

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS across every file.

- [ ] **Step 7: Play it by hand**

```bash
npm run dev
```

Open the printed URL and play a full round. Confirm by eye: cells open as they should, the ruled-out list grows, lifelines appear after the 4th and 6th guesses, the share card copies, and reloading mid-game restores your progress.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add app shell with past days archive"
```

---

## Task 18: Data integrity tests and deployment

**Files:**
- Create: `src/data/integrity.test.ts`
- Create: `vercel.json`
- Create: `README.md`

**Interfaces:**
- Consumes: the generated `films.json` and `schedule.json` via `src/data/repository`.
- Produces: a deployed site and a README documenting how to regenerate data.

These tests run against the **real generated data**, not fixtures. They are what catch a bad import before players do.

- [ ] **Step 1: Write the data integrity tests**

Create `src/data/integrity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import filmsJson from './films.json'
import scheduleJson from './schedule.json'
import { isMysteryEligible } from '../domain/gates'
import { FIRST_YEAR, LAST_YEAR, type Film } from '../domain/types'
import { MIN_GUESSABLE, MIN_MYSTERY, VOTE_FLOOR } from '../../scripts/coverage'

const films = filmsJson as Film[]
const schedule = scheduleJson as Record<string, string>
const byId = new Map(films.map((f) => [f.id, f]))
const answers = films.filter((f) => f.isMysteryEligible)

describe('films.json', () => {
  it('meets the guessable threshold', () => {
    expect(films.length).toBeGreaterThanOrEqual(MIN_GUESSABLE)
  })

  it('meets the answer threshold', () => {
    expect(answers.length).toBeGreaterThanOrEqual(MIN_MYSTERY)
  })

  it('has unique ids', () => {
    expect(new Set(films.map((f) => f.id)).size).toBe(films.length)
  })

  it('keeps every film inside the year window', () => {
    for (const f of films) {
      expect(f.year).toBeGreaterThanOrEqual(FIRST_YEAR)
      expect(f.year).toBeLessThanOrEqual(LAST_YEAR)
    }
  })

  it('gives every film a director and at least 3 cast', () => {
    for (const f of films) {
      expect(f.director).toBeTruthy()
      expect(f.cast.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('never stores more than 10 cast', () => {
    for (const f of films) expect(f.cast.length).toBeLessThanOrEqual(10)
  })

  it('keeps every answer-eligible film above the vote floor', () => {
    for (const f of answers) expect(isMysteryEligible(f, VOTE_FLOOR)).toBe(true)
  })

  it('gives every answer at least 6 cast and 1 genre', () => {
    for (const f of answers) {
      expect(f.cast.length).toBeGreaterThanOrEqual(6)
      expect(f.genres.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('gives every answer a music director', () => {
    for (const f of answers) expect(f.musicDirector).not.toBeNull()
  })

  it('has a composer for most guessable films too', () => {
    // Measured at 77% on 2026-09-13. A sharp drop means the composer job
    // list in scripts/tmdb.ts stopped matching TMDB's spellings.
    const withComposer = films.filter((f) => f.musicDirector !== null).length
    expect(withComposer / films.length).toBeGreaterThan(0.6)
  })

  it('has no duplicate people within one film’s cast', () => {
    for (const f of films) {
      expect(new Set(f.cast.map((c) => c.id)).size).toBe(f.cast.length)
    }
  })
})

describe('schedule.json', () => {
  it('covers at least a year ahead', () => {
    expect(Object.keys(schedule).length).toBeGreaterThanOrEqual(365)
  })

  it('uses well-formed dates', () => {
    for (const date of Object.keys(schedule)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('references only films that exist', () => {
    for (const id of Object.values(schedule)) expect(byId.has(id)).toBe(true)
  })

  it('references only answer-eligible films', () => {
    for (const id of Object.values(schedule)) {
      expect(byId.get(id)?.isMysteryEligible).toBe(true)
    }
  })

  it('does not repeat a film within any 90-day window', () => {
    const ids = Object.keys(schedule).sort().map((d) => schedule[d])
    for (let i = 0; i < ids.length; i++) {
      const window = ids.slice(i, i + 90)
      expect(new Set(window).size).toBe(window.length)
    }
  })
})
```

- [ ] **Step 2: Run the integrity tests**

Run: `npm test -- src/data/integrity.test.ts`
Expected: PASS.

If the 90-day repeat test fails, the answer pool is smaller than 90 films and the schedule is cycling too fast — return to Task 3 and lower `VOTE_FLOOR`.

- [ ] **Step 3: Verify a production build**

Run: `npm run build`
Expected: builds with no TypeScript errors. Note the reported bundle size; `films.json` dominates it.

Then confirm the key never leaked:

```bash
grep -r "TMDB_API_KEY\|api_key" dist/ || echo "clean — no key in the bundle"
```

Expected: `clean — no key in the bundle`. If anything is found, stop and fix before deploying.

- [ ] **Step 4: Add the Vercel config**

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 5: Write the README**

Create `README.md`:

```markdown
# Tollywood Daily

Guess the mystery Telugu film in 7 tries. Each guess reveals only what it
shares with the answer: year, genres, cast (at their billing positions),
director, and music director.

A new puzzle appears at midnight IST. Past days are playable from the archive.

## Running it

```bash
npm install
npm run dev
```

## Regenerating the film data

Needs a free TMDB API key in `.env` (copy `.env.example`).

```bash
npm run build:data      # TMDB -> src/data/films.json, prints a coverage report
npm run build:schedule  # assigns films to dates; past dates are never rewritten
npm test                # integrity tests run against the generated data
```

`build:data` exits non-zero if the pools fall below the thresholds in
`scripts/coverage.ts`. Hand corrections go in `src/data/overrides.json`,
keyed by film id — they are applied after the fetch, so re-running never
discards them.

## Design

`docs/superpowers/specs/2026-09-13-tollywood-daily-game-design.md`

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
```

- [ ] **Step 6: Deploy**

```bash
npx vercel --prod
```

Accept the defaults. Open the deployed URL and play one full round on a phone-sized window to confirm the responsive layout holds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add data integrity tests, Vercel config, and README"
```
