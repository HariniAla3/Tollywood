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

Current data: **2179 films discovered, 1661 guessable, 395 answer-eligible**
(a year and 30 days of puzzles).

## Notes for future maintainers

- **Answer recognition is gated on `vote_count`, never `popularity`.** TMDB's
  popularity is a trending score; measured live it ranked obscure recent films
  above *Pushpa* while *Bommarillu* sat near rank 350.
- **Composers are resolved across several crew-job spellings** — TMDB credits
  Indian composers under `Music` far more often than `Original Music Composer`.
  `Playback Singer` is deliberately excluded: it is the most common music job
  on these films, and accepting it would credit *Athadu* to its singer.

## Design

`docs/superpowers/specs/2026-09-13-tollywood-daily-game-design.md`

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
