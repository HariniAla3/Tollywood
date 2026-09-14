import { describe, it, expect } from 'vitest'
import {
  startSession, submitGuess, useReveal, unlockExtraGuesses, toPersisted, replaySession,
} from './session'
import type { Film, Person } from './types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const film = (over: Partial<Film> = {}): Film => ({
  id: 'f_a', tmdbId: 1, title: 'Answer', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'], director: p(100), musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map(p), posterPath: null, popularity: 50, voteCount: 50,
  isMysteryEligible: true, ...over,
})

const answer = film()
const miss = (n: number) =>
  film({
    id: `f_miss_${n}`, year: 2006, genres: ['Horror'],
    director: p(900 + n), musicDirector: p(950 + n), cast: [p(800 + n)],
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
    expect(submitGuess(startSession('d', answer), answer).status).toBe('won')
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
    expect(submitGuess(startSession('d', answer), miss(1)).board.year.min).toBe(2007)
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
    expect(s.board.musicDirector!.state).toBe('hidden')
  })

  it('allows a second reveal after the sixth guess', () => {
    let s = startSession('d', answer)
    for (let i = 1; i <= 6; i++) s = submitGuess(s, miss(i))
    s = useReveal(s, { kind: 'crew', role: 'director' })
    s = useReveal(s, { kind: 'crew', role: 'musicDirector' })
    expect(s.board.musicDirector!.state).toBe('lifeline')
    expect(s.lifelines.revealsUsed).toBe(2)
  })
})

describe('unlockExtraGuesses', () => {
  it('is refused before the seventh guess', () => {
    expect(unlockExtraGuesses(startSession('d', answer)).lifelines.extraGuessesUnlocked).toBe(false)
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
    const s = submitGuess(startSession('d', answer), answer)
    expect(replaySession(toPersisted(s), answer, lookup).status).toBe('won')
  })

  it('skips guess ids that no longer resolve to a film', () => {
    const restored = replaySession(
      { puzzleDate: 'd', guessIds: ['f_gone', 'f_miss_1'], revealedCells: [], extraGuessesUnlocked: false },
      answer, lookup,
    )
    expect(restored.outcomes).toHaveLength(1)
  })
})
