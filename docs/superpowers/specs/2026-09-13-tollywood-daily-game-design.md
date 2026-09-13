# Tollywood Daily — Design

**Date:** 2026-09-13
**Status:** Approved for planning

## 1. What we are building

A daily browser game. One mystery Telugu film per day, the same film for
every player worldwide. You have 7 attempts (with an option to unlock 3
more). Every guess must itself be a Telugu film released in 2005 or later.

Each guess is a probe, not a shot in the dark. The game compares the
guessed film to the mystery film and reveals only what the two have in
common: shared genres, shared cast members at their exact billing
positions, shared director or music director, and a narrowing bound on
the release year. Wrong guesses are still informative — they eliminate
every actor and crew member in the guessed film.

The genre is deduction, not trivia. Success comes from choosing probes
that split the space, the way Poeltl works for basketball players.

## 2. Goals and non-goals

### Goals

- One puzzle per day, identical for all players, rolling over at midnight IST.
- Past Days' Games: any previous date is playable.
- Deduction-first feedback, including visible tracking of what has been ruled out.
- Spoiler-free share card for WhatsApp.
- Ship as a static site with no backend and no running costs.

### Non-goals (deliberately deferred)

- User accounts, login, cross-device sync.
- Global leaderboards or server-side statistics.
- Any backend service or database.
- Dialogue and box-office clue cells (revisit after launch).
- Telugu-language UI strings. Telugu *titles* are stored and displayed;
  the interface itself is English.
- Native mobile apps. The site is installable as a PWA; that is enough.
- Monetization. See the licensing constraint in section 9.

## 3. Architecture

Three parts, only one of which the developer ever runs:

```
   OCCASIONALLY, ON A LAPTOP              ALWAYS, IN THE BROWSER
   ┌───────────────────────┐             ┌─────────────────────────┐
   │  scripts/build-data   │──writes──▶  │  static React site      │
   │  TMDB only            │  films.json │  (Vercel, free tier)    │
   │                       │  schedule.json                        │
   └───────────────────────┘             └─────────────────────────┘
                                          localStorage: progress, streak
```

There is no server, no database, and no network call at play time. The
film data is a JSON file committed to the repository and imported by the
app like any other module. This is the single largest simplification in
the design and it is what makes the game buildable quickly and free to
operate.

**Consequence accepted:** the day's answer is present in the client
bundle and can be read with developer tools. Wordle has the same
property. Concealing it would require a backend and is not worth it.

**Escape hatch:** all film and schedule access goes through one module,
`src/data/repository.ts`. Swapping the JSON files for Supabase later is a
change to that one file, not to game logic.

## 4. Data

### 4.1 Sources

**TMDB is the only source.** The window is 2005–2025 precisely because
TMDB's Telugu coverage is dependable over that period; the original
1995–2004 range was what required backfilling from elsewhere.

Single-sourcing buys more than less code. It removes **cross-source person
identity reconciliation** — deciding that a TMDB person id and an IMDb
`nm…` id are the same actor, across thousands of inconsistently
transliterated Telugu names. That is the most defect-prone work in any
film-data pipeline, and with one source it does not exist: every person is
a TMDB id, and cast comparison is integer equality.

TMDB provides titles, release year, genres, cast **with billing order**,
crew by job, and posters. The `order` field is the foundation of the
numbered-cast mechanic — real credit data, not something we invent.

**Contingency, not plan.** If the counts in section 4.2 come back short,
the fallbacks in priority order are: (1) hand-fill the missing fields for
answer-pool films via `overrides.json`, a few hundred rows at most;
(2) add a Wikidata SPARQL pass, which is strong on Indian cinema and
especially on music directors; (3) only as a last resort, add the IMDb
bulk datasets and accept the reconciliation work. Nothing in the schema
blocks any of these later.

### 4.2 Build pipeline

`scripts/build-data.ts`, run manually, idempotent and re-runnable:

1. TMDB `discover/movie?with_original_language=te` walked across
   2005-01-01 → 2025-12-31, paginated.
2. TMDB `/movie/{id}/credits` for each film.
3. Apply `src/data/overrides.json` last, so a re-run never discards a hand fix.
4. Apply the section 4.3 gates, write `src/data/films.json`.
5. **Print a coverage report** and fail loudly if the pools are too small.

The coverage report is the first deliverable of the whole project, and it
is what validates the TMDB-only decision empirically rather than on
assumption. It prints: films returned, how many clear the guessable gate,
how many clear the answer gate, and a breakdown of which gate rejected
what — in particular how many films were lost solely for a missing music
director, since that is the field most likely to be thin.

Target thresholds: **≥1500 guessable and ≥300 answer-eligible.** Below
those, escalate through the section 4.1 contingencies before building
further.

### 4.3 Two pools, not one

This distinction is critical to playability.

- **`isGuessable`** — the autocomplete list. Being generous here is good,
  because obscure guesses should work.
- **`isMysteryEligible`** — a popularity-gated subset, in the low
  hundreds. Only these are ever the answer.

Without the split, the game eventually serves a film nobody has heard of.
With it, guessing stays wide open while answers stay fair.

**Both pools need quality gates, not just the answer pool.** A guessed
film's credits are what produce commonalities and Ruled Out entries, so a
film in the autocomplete with half its cast missing gives *misleading*
feedback — worse than not being guessable at all. A smaller correct guess
pool beats a larger broken one.

| Gate | `isGuessable` | `isMysteryEligible` |
|---|---|---|
| Release year | 2005–2025 | 2005–2025 |
| Director | required | required |
| Credited cast | ≥ 3 | ≥ 6 |
| Genres | ≥ 1 | ≥ 2 |
| Music director | not required | **required** |
| Popularity | none | above threshold, tuned to pool size |

Music director is a hard answer-gate because it is one of only twelve
cells and the one Telugu audiences care most about; an answer missing it
plays as a broken puzzle. It is deliberately *not* a guess-gate, since a
guessed film lacking a composer simply never matches that cell.

### 4.4 Film record

```ts
type Film = {
  id: string              // stable internal id
  tmdbId: number
  title: string
  titleTelugu: string | null
  aliases: string[]       // alternate spellings, for search only
  year: number
  genres: string[]        // TMDB order preserved
  director: Person
  musicDirector: Person | null
  cast: Person[]          // ascending billing order
  posterPath: string | null
  popularity: number
  isGuessable: boolean
  isMysteryEligible: boolean
}

type Person = { id: number; name: string }  // TMDB person id
```

The internal `id` is derived from `tmdbId`. People are matched by
**id, never by name**, so "Jr NTR" and
"N. T. Rama Rao Jr." are one person. Name aliases matter only for
title search.

## 5. Daily puzzle selection

A build-time file, `src/data/schedule.json`, maps each date to a film id:

```json
{ "2026-09-13": "f_1042", "2026-09-14": "f_0317" }
```

Generated by `scripts/build-schedule.ts` using a seeded Fisher–Yates
shuffle over the answer pool, cycling when exhausted. This is preferred
over hashing the date at runtime because it guarantees no repeats within
a cycle, allows any single date to be overridden by hand (a star's
birthday, a release week), and makes the archive a trivial lookup.

**Past dates are frozen.** Regeneration after adding new films only
rewrites dates strictly after today. A played puzzle never changes.

**Day boundary is midnight IST** (`Asia/Kolkata`), not the viewer's local
timezone. This is a Telugu-audience game; the puzzle should turn over on
their clock. The current puzzle date is computed by converting `now` to
IST and taking the calendar date.

## 6. The board

Twelve cells describing the mystery film. All start hidden. A cell, once
open, stays open.

```
  YEAR     2005 ◄──────────────────────────────► 2025

  GENRE    [ ??? ] [ ??? ] [ ??? ]

  CAST     [ ①??? ] [ ②??? ] [ ③??? ]
           [ ④??? ] [ ⑤??? ] [ ⑥??? ]

  CREW     [ DIRECTOR ??? ]  [ MUSIC ??? ]
```

### Reveal rules

**Year** — never shown exactly by matching. It squeezes from both sides.
A guess older than the answer raises the floor to that year; a guess
newer lowers the ceiling. Bounds are exclusive of the guessed year unless
the years are equal, in which case the year is solved and the cell opens.

**Genre** — the mystery film's genres occupy fixed slots in TMDB order.
Any genre shared with the guess opens that slot. Slot count equals the
mystery film's genre count (2–4), and is visible from the start; this
leaks a little information and is accepted in exchange for never
presenting a cell that cannot be opened.

**Cast** — the answer's top six billed actors hold cells ①–⑥. If the
guessed film's cast contains a person occupying cell *n*, cell *n* opens.
Displayed numbers are 1-based; TMDB's `order` is 0-based.

**Crew** — director and music director. Exact person match or nothing. A
person who both directs and acts can open a crew cell and a cast cell from
a single guess; both open.

**Cast billed 7th or lower** — only the answer's top six actors have cells.
A guess sharing an actor billed 7th or lower in the answer opens nothing
and produces no feedback, though that actor is *not* added to Ruled Out,
since they are in fact in the film. Six is a tuning knob: if playtesting
shows puzzles are too hard, widen to eight cells.

**Repeat guesses** are rejected before submission and do not consume an
attempt. The autocomplete greys out films already guessed.

### Ruled Out panel

A running list of every person eliminated: each actor and crew member
appearing in a guessed film who did **not** open a cell. Deduction is the
point of the game, and this is what makes deduction visible rather than
something players must hold in their heads.

## 7. Lifelines

- **After guess 4** — open any one hidden cell of the player's choice.
- **After guess 6** — open one more.
- **After guess 7** — if unsolved, optionally unlock guesses 8, 9, 10.

Lifeline-opened cells are styled distinctly from matched cells, and the
share card marks lifeline use, so a 9/7 finish is honest about the help.

## 8. Share card

Spoiler-free: the **final board state**, one square per cell, in board
order and wrapped to the board's own row structure. No titles, names, or
years appear, so it is safe to paste into a group chat mid-day.

```
🎬 Tollywood #47   3/7

🟩              ← year
🟩🟩⬜            ← genres
🟩⬜🟩
⬜⬜🟨          ← cast ①–⑥
🟩🟩          ← director, music
🔥 streak 12
```

Green = opened by a match, yellow = opened by a lifeline, grey = never
opened. The header shows guesses used over the limit (`9/7` after taking
the extra-guesses lifeline). Copied to clipboard; `navigator.share` on
mobile when available.

## 9. Risks and constraints

**Licensing.** TMDB's free API tier is for **non-commercial** use with
attribution, which covers this game as designed; attribution appears in
the footer. Unlike the IMDb bulk datasets — which are non-commercial-only
with no upgrade path — TMDB offers a commercial licensing route, so
staying single-sourced keeps a door open should the game ever be
monetized.

**Data quality.** Wrong credits produce unfair puzzles. Mitigations: the
answer pool is small and popularity-gated, completeness checks gate
eligibility, and `overrides.json` allows permanent hand fixes that survive
re-runs.

**Thin music-director coverage.** The likeliest way the TMDB-only bet
fails. TMDB stores it as the crew job `Original Music Composer`,
well-populated for major films and patchy for mid-tier ones. The coverage
report in section 4.2 measures this directly before any game code is
written, and `overrides.json` absorbs the shortfall if it is small.

**No pre-2005 films.** Accepted scope cost: *Kushi*, *Indra*, *Okkadu* and
that era are out. Widening the window later is a date change in the build
script plus a re-run, but the 1995–2004 range would likely reintroduce the
need for a second source.

**Answer visible in bundle.** Accepted, as in section 3.

## 10. Modules

Pure logic is separated from React so it can be tested directly.

```
scripts/
  build-data.ts         TMDB → gates → films.json + coverage report
  build-schedule.ts     seeded shuffle → schedule.json
src/
  data/
    films.json, schedule.json, overrides.json
    repository.ts       the only reader of the above; the Supabase seam
  game/
    compare.ts          guess × answer → reveal result      (pure)
    board.ts            apply reveals to board state        (pure)
    ruledOut.ts         accumulate eliminated people        (pure)
    lifelines.ts        availability and application        (pure)
    share.ts            board → emoji card                  (pure)
    puzzleDate.ts       IST day boundary, date → puzzle     (pure)
  storage/
    GameStorage.ts      interface: progress and streak by date
    localStorage.ts     the v1 implementation
  ui/
    Board, Cell, GuessInput, GuessHistory, RuledOutPanel,
    LifelineBar, ResultModal, ArchiveList
```

`compare.ts` is the heart of the game and the most heavily tested module.

## 11. Testing

Test-driven, per the project's development workflow.

- **Unit (Vitest)** — `compare`, `board`, `ruledOut`, `lifelines`,
  `share`, `puzzleDate`. Includes edge cases: same-year guesses,
  repeat guesses, a person appearing in both cast and crew, films with
  exactly 2 genres, and IST rollover across the UTC date line.
- **Data validation** — a test suite asserting every answer-pool film
  satisfies the section 4.3 completeness rules, and that `schedule.json`
  references only eligible films with no duplicate dates.
- **Component (React Testing Library)** — guess submission, cell reveal,
  lifeline flow, archive navigation.
- **Determinism** — the same date yields the same film across runs and
  simulated timezones.

## 12. Build order

**Phase 1 — playable game.** TMDB-only data build, schedule generation,
`compare` and the board, guess input with autocomplete, Ruled Out panel,
lifelines, share card, localStorage progress and streak, Past Days'
archive, deploy to Vercel.

**Phase 2 — depth.** Personal statistics (distribution, win rate), PWA
install, and whichever section 4.1 contingency the coverage report showed
was actually needed.

**Phase 3 — only if warranted.** Swap `repository.ts` to Supabase when
editing data without redeploying becomes genuinely annoying. Add dialogue
and box-office cells once that data exists.
