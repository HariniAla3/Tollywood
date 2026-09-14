import {
  DIRECTOR_LINK, ERA, FAME, FIRST_LETTER, LEAD_LINK, LETTER_COUNT, MUSIC_LINK,
  TITLE_SHAPE,
} from '../data/clueVoice'
import { makeRng } from './rng'
import { normalizeTitle } from './search'
import type { Film } from './types'

/** One clue per wrong guess, up to this many. */
export const CLUE_COUNT = 5

/** Rank cutoffs (by vote count within the catalogue) for the fame clue. */
const HUGELY_KNOWN = 25
const WELL_KNOWN = 100

/**
 * True when two titles belong to the same franchise -- "Karthikeya" and
 * "Karthikeya 2", "Mathu Vadalara" and "Mathu Vadalara 2". Naming a sequel
 * as a clue for its own original effectively hands over the answer, so these
 * are never used as linked films.
 */
function sameFranchise(a: string, b: string): boolean {
  const x = normalizeTitle(a)
  const y = normalizeTitle(b)
  if (!x || !y) return false
  const prefix = (long: string, short: string) =>
    long === short || long.startsWith(short + ' ')
  return prefix(x, y) || prefix(y, x)
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Pick one phrasing from a bank, stably. Seeding from the film id plus the
 * rung means a given puzzle always reads the same -- including in the
 * archive, where a changing clue would be a bug -- while different films
 * get different jokes.
 */
function pick(bank: readonly string[], filmId: string, rung: number): string {
  const rng = makeRng(hashSeed(`${filmId}:${rung}`))
  return bank[Math.floor(rng() * bank.length)]
}

function era(year: number): readonly string[] {
  if (year < 2010) return ERA['2000s']
  if (year < 2020) return ERA['2010s']
  return ERA['2020s']
}

function titleShape(title: string): readonly string[] {
  const words = title.split(/[\s:,-]+/).filter(Boolean).length
  if (words <= 1) return TITLE_SHAPE.one
  if (words === 2) return TITLE_SHAPE.two
  return TITLE_SHAPE.many
}

function fame(answer: Film, catalogue: Film[]): readonly string[] {
  const ranked = catalogue
    .filter((f) => f.isMysteryEligible)
    .sort((a, b) => b.voteCount - a.voteCount)
  const rank = ranked.findIndex((f) => f.id === answer.id) + 1
  if (rank > 0 && rank <= HUGELY_KNOWN) return FAME.huge
  if (rank > 0 && rank <= WELL_KNOWN) return FAME.known
  return FAME.deep
}

/**
 * The best-known OTHER film sharing a credit, or null. Never the answer, and
 * never a film already used by an earlier rung -- two clues naming the same
 * film would spend a rung saying nothing new.
 */
function linkedFilm(
  answer: Film,
  catalogue: Film[],
  shares: (f: Film) => boolean,
  exclude: Set<string> = new Set(),
): Film | null {
  const found = catalogue
    .filter(
      (f) =>
        f.id !== answer.id &&
        !exclude.has(f.id) &&
        !sameFranchise(f.title, answer.title) &&
        shares(f),
    )
    .sort((a, b) => b.voteCount - a.voteCount)
  return found[0] ?? null
}

function linkClue(
  bank: readonly string[],
  film: Film | null,
  answerId: string,
  rung: number,
): string | null {
  if (!film) return null
  return pick(bank, answerId, rung).replace('{film}', film.title)
}

/**
 * Five clues, vague to sharp, unlocked one per wrong guess.
 *
 * No clue ever references the mystery film itself -- every linked title is
 * a different film by construction, and a test asserts it across the whole
 * answer pool.
 */
export function buildClues(answer: Film, catalogue: Film[]): string[] {
  const lead = answer.cast[0]

  const firstLetter = () =>
    pick(FIRST_LETTER, answer.id, 9).replace('{letter}', answer.title.charAt(0).toUpperCase())

  const byLead = lead
    ? linkedFilm(answer, catalogue, (f) => f.cast.some((c) => c.id === lead.id))
    : null
  const byMusicFor4 = answer.musicDirector
    ? linkedFilm(answer, catalogue, (f) => f.musicDirector?.id === answer.musicDirector!.id)
    : null

  const rung4 =
    linkClue(LEAD_LINK, byLead, answer.id, 4) ??
    linkClue(MUSIC_LINK, byMusicFor4, answer.id, 4) ??
    firstLetter()

  // Whatever rung 4 actually named is off the table for rung 5.
  const usedByRung4 = new Set(
    [byLead, byMusicFor4]
      .filter((f): f is Film => !!f && rung4.includes(f.title))
      .map((f) => f.id),
  )

  const byDirector = linkedFilm(
    answer, catalogue,
    (f) => f.director.id === answer.director.id,
    usedByRung4,
  )
  const byMusicFor5 = answer.musicDirector
    ? linkedFilm(
        answer, catalogue,
        (f) => f.musicDirector?.id === answer.musicDirector!.id,
        usedByRung4,
      )
    : null

  const letterCount = () =>
    pick(LETTER_COUNT, answer.id, 10).replace(
      '{n}',
      String(answer.title.replace(/[^\p{L}\p{N}]/gu, '').length),
    )

  let rung5 =
    linkClue(DIRECTOR_LINK, byDirector, answer.id, 5) ??
    linkClue(MUSIC_LINK, byMusicFor5, answer.id, 5) ??
    firstLetter()

  // A film with no co-credits at all would print the same fallback twice.
  if (rung5 === rung4) rung5 = letterCount()

  return [
    pick(era(answer.year), answer.id, 1),
    pick(titleShape(answer.title), answer.id, 2),
    pick(fame(answer, catalogue), answer.id, 3),
    rung4,
    rung5,
  ]
}
