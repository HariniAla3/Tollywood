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
