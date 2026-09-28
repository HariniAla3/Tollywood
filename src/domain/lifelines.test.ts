import { describe, it, expect } from 'vitest'
import {
  revealsEarned, revealsAvailable, guessLimit, canUnlockExtraGuesses,
  BASE_GUESS_LIMIT, type LifelineState,
} from './lifelines'

const state = (over: Partial<LifelineState> = {}): LifelineState => ({
  revealsUsed: 0, extraGuessesUnlocked: false, ...over,
})

describe('revealsEarned', () => {
  it('earns none before the third guess', () => {
    expect(revealsEarned(0)).toBe(0)
    expect(revealsEarned(2)).toBe(0)
  })

  it('earns one after the third guess', () => {
    expect(revealsEarned(3)).toBe(1)
  })

  it('earns two after the fourth guess', () => {
    expect(revealsEarned(4)).toBe(2)
    expect(revealsEarned(10)).toBe(2)
  })
})

describe('revealsAvailable', () => {
  it('is zero when none are earned', () => {
    expect(revealsAvailable(state(), 2)).toBe(0)
  })

  it('is one when earned and unused', () => {
    expect(revealsAvailable(state(), 3)).toBe(1)
  })

  it('drops to zero once spent', () => {
    expect(revealsAvailable(state({ revealsUsed: 1 }), 3)).toBe(0)
  })

  it('rises again at the fourth guess', () => {
    expect(revealsAvailable(state({ revealsUsed: 1 }), 4)).toBe(1)
  })

  it('never goes negative', () => {
    expect(revealsAvailable(state({ revealsUsed: 2 }), 3)).toBe(0)
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
