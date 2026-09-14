import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { answerIdForDate, getFilm } from '../data/repository'
import type { CellRef } from '../domain/board'
import { canUnlockExtraGuesses, revealsAvailable } from '../domain/lifelines'
import {
  replaySession, startSession, submitGuess, toPersisted, unlockExtraGuesses, useReveal,
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
  injectedStorage?: GameStorage,
): GameApi {
  /**
   * A default-parameter `createLocalStorage()` would build a new object on
   * every render, and this object is a dependency of the effects below --
   * that refires them, sets state, and re-renders forever. Memoising keeps
   * one instance while still allowing a caller to inject its own.
   */
  const storage = useMemo(
    () => injectedStorage ?? createLocalStorage(),
    [injectedStorage],
  )

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
    // Already recorded as a loss; winning on the extra guesses does not amend it.
    recorded.current = true
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

  return { session, stats, revealsAvailable: reveals, canUnlockExtra: canUnlock, guess, reveal, unlockExtra }
}
