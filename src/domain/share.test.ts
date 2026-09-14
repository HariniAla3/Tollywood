import { describe, it, expect } from 'vitest'
import { buildShareCard } from './share'
import { startSession, submitGuess, useReveal } from './session'
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
const miss = (n: number) =>
  film({
    id: `f_miss_${n}`, title: `Miss ${n}`, year: 2006, genres: ['Horror'],
    director: p(900 + n), musicDirector: p(950 + n), cast: [p(800 + n)],
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
    const grid = buildShareCard(s, 1).split('\n').filter((l) => /^[🟩🟨⬜]+$/u.test(l))
    // year(1), genres(2), cast rows of three (3+3), crew(2)
    expect(grid.map((l) => [...l].length)).toEqual([1, 2, 3, 3, 2])
  })

  it('drops the music square when the film has no composer', () => {
    const noMusic = { ...answer, musicDirector: null }
    const s = submitGuess(startSession('2026-01-01', noMusic), noMusic)
    const grid = buildShareCard(s, 1).split('\n').filter((l) => /^[🟩🟨⬜]+$/u.test(l))
    expect(grid.map((l) => [...l].length)).toEqual([1, 2, 3, 3, 1])
  })

  it('includes the streak when there is one', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    expect(buildShareCard(s, 12)).toContain('12')
  })

  it('omits the streak line at zero', () => {
    const s = submitGuess(startSession('2026-01-01', answer), miss(1))
    expect(buildShareCard(s, 0)).not.toContain('🔥')
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
