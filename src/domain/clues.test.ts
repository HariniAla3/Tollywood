import { describe, it, expect } from 'vitest'
import { buildClues, CLUE_COUNT } from './clues'
import type { Film, Person } from './types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const film = (over: Partial<Film> = {}): Film => ({
  id: 'f_a', tmdbId: 1, title: 'Rangasthalam', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'],
  director: p(100, 'Sukumar'), musicDirector: p(200, 'Devi Sri Prasad'),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)), posterPath: null,
  popularity: 50, voteCount: 50, isMysteryEligible: true, ...over,
})

const answer = film()
// Shares the director with the answer, but deliberately not the lead actor,
// so the director clue and the lead clue can be told apart.
const sameDirector = film({
  id: 'f_dir', title: 'Pushpa', voteCount: 900, cast: [p(40), p(41), p(42)],
})
const sameLead = film({
  id: 'f_lead', title: 'Magadheera', director: p(700, 'Rajamouli'),
  musicDirector: p(701), cast: [p(1), p(50)], voteCount: 800,
})
const unrelated = film({
  id: 'f_other', title: 'Pokiri', director: p(900), musicDirector: p(901),
  cast: [p(800)], voteCount: 700,
})

const catalogue = [answer, sameDirector, sameLead, unrelated]

describe('buildClues', () => {
  it('always produces exactly five clues', () => {
    expect(buildClues(answer, catalogue)).toHaveLength(CLUE_COUNT)
  })

  it('produces non-empty text for every clue', () => {
    for (const c of buildClues(answer, catalogue)) {
      expect(c.trim().length).toBeGreaterThan(0)
    }
  })

  it('never names the mystery film', () => {
    for (const c of buildClues(answer, catalogue)) {
      expect(c).not.toContain(answer.title)
    }
  })

  it('is stable across repeated calls', () => {
    expect(buildClues(answer, catalogue)).toEqual(buildClues(answer, catalogue))
  })

  it('gives different films different wording', () => {
    const a = buildClues(answer, catalogue)
    const b = buildClues({ ...answer, id: 'f_zzz' }, catalogue)
    expect(a).not.toEqual(b)
  })

  it('links to another film by the same director', () => {
    expect(buildClues(answer, catalogue).join(' ')).toContain('Pushpa')
  })

  it('links to another film with the same lead actor', () => {
    expect(buildClues(answer, catalogue).join(' ')).toContain('Magadheera')
  })

  it('never links to an unrelated film', () => {
    expect(buildClues(answer, catalogue).join(' ')).not.toContain('Pokiri')
  })

  it('does not name the same linked film in two different clues', () => {
    const clues = buildClues(answer, catalogue)
    for (const title of ['Pushpa', 'Magadheera']) {
      const hits = clues.filter((c) => c.includes(title)).length
      expect(hits).toBeLessThanOrEqual(1)
    }
  })

  it('falls back gracefully when the film has no co-credits at all', () => {
    const lonely = film({ id: 'f_lonely', title: 'Solo', director: p(555), musicDirector: p(556), cast: [p(557)] })
    const clues = buildClues(lonely, [lonely])
    expect(clues).toHaveLength(CLUE_COUNT)
    for (const c of clues) expect(c.trim().length).toBeGreaterThan(0)
    expect(clues.join(' ')).not.toContain('Solo')
  })

  it('mentions the decade era for a 2000s film', () => {
    const old = film({ id: 'f_old', title: 'Athadu', year: 2005 })
    expect(buildClues(old, [old, sameDirector]).length).toBe(CLUE_COUNT)
  })

  it('substitutes every placeholder', () => {
    for (const c of buildClues(answer, catalogue)) {
      expect(c).not.toContain('{film}')
      expect(c).not.toContain('{letter}')
    }
  })
})

describe('buildClues — franchise safety', () => {
  const original = film({ id: 'f_k1', title: 'Karthikeya', voteCount: 40 })
  const sequel = film({ id: 'f_k2', title: 'Karthikeya 2', voteCount: 900 })
  const safe = film({ id: 'f_safe', title: 'Vedam', voteCount: 100 })

  it('never names a sequel of the mystery film', () => {
    const clues = buildClues(original, [original, sequel, safe])
    expect(clues.join(' ')).not.toContain('Karthikeya 2')
  })

  it('never names the original when the sequel is the answer', () => {
    const clues = buildClues(sequel, [original, sequel, safe])
    for (const c of clues) expect(c).not.toMatch(/Karthikeya(?! 2)/)
  })

  it('still links to unrelated films', () => {
    expect(buildClues(original, [original, sequel, safe]).join(' ')).toContain('Vedam')
  })
})

describe('buildClues — no repeated rungs', () => {
  it('gives two different clues even with no co-credits at all', () => {
    const lonely = film({
      id: 'f_lonely', title: 'Vanaja',
      director: p(555), musicDirector: p(556), cast: [p(557)],
    })
    const clues = buildClues(lonely, [lonely])
    expect(new Set(clues).size).toBe(clues.length)
  })
})
