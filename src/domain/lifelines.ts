export const BASE_GUESS_LIMIT = 7
export const EXTRA_GUESSES = 3

export type LifelineState = {
  revealsUsed: number
  extraGuessesUnlocked: boolean
}

export function emptyLifelines(): LifelineState {
  return { revealsUsed: 0, extraGuessesUnlocked: false }
}

/** Guess counts at which a cell reveal becomes available. */
export const FIRST_REVEAL_AT = 3
export const SECOND_REVEAL_AT = 4

/** One reveal is earned after the 3rd guess, a second after the 4th. */
export function revealsEarned(guessCount: number): number {
  if (guessCount >= SECOND_REVEAL_AT) return 2
  if (guessCount >= FIRST_REVEAL_AT) return 1
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
