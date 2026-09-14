import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGame } from './useGame'
import { createLocalStorage } from '../storage/localStorage'
import type { Film, Person } from '../domain/types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Answer', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'], director: p(100), musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map(p), posterPath: null, popularity: 50, voteCount: 50,
  isMysteryEligible: true,
}

const wrong: Film = { ...answer, id: 'f_b', title: 'Wrong', year: 2006, genres: ['Horror'],
  director: p(900), musicDirector: p(901), cast: [p(800)] }

vi.mock('../data/repository', () => ({
  getFilm: (id: string) => [answer, wrong].find((f) => f.id === id),
  guessableFilms: () => [answer, wrong],
  answerIdForDate: (date: string) => (date === '2026-09-13' ? 'f_a' : null),
  playableDates: () => ['2026-09-13'],
}))

describe('useGame', () => {
  beforeEach(() => localStorage.clear())

  it('starts a session for a scheduled date', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    expect(result.current.session?.status).toBe('playing')
  })

  it('returns no session for an unscheduled date', () => {
    const { result } = renderHook(() => useGame('1999-01-01', '2026-09-13'))
    expect(result.current.session).toBeNull()
  })

  it('records a guess', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    act(() => result.current.guess(wrong))
    expect(result.current.session?.outcomes).toHaveLength(1)
  })

  it('wins on the right guess', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    act(() => result.current.guess(answer))
    expect(result.current.session?.status).toBe('won')
  })

  it('persists progress across remounts', () => {
    const { result, unmount } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    act(() => result.current.guess(wrong))
    unmount()
    const second = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    expect(second.result.current.session?.outcomes).toHaveLength(1)
  })

  it('records the win in stats exactly once', () => {
    const storage = createLocalStorage()
    const { result, unmount } = renderHook(() => useGame('2026-09-13', '2026-09-13', storage))
    act(() => result.current.guess(answer))
    expect(result.current.stats.won).toBe(1)
    unmount()
    const second = renderHook(() => useGame('2026-09-13', '2026-09-13', storage))
    expect(second.result.current.stats.won).toBe(1)
    expect(second.result.current.stats.played).toBe(1)
  })

  it('exposes no lifeline reveals at the start', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    expect(result.current.revealsAvailable).toBe(0)
  })

  it('exposes a reveal after the fourth guess', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    expect(result.current.revealsAvailable).toBe(1)
  })

  it('opens a chosen cell via reveal', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    act(() => result.current.reveal({ kind: 'crew', role: 'director' }))
    expect(result.current.session?.board.director.state).toBe('lifeline')
  })

  it('keeps the recorded loss when extra guesses later produce a win', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    expect(result.current.stats.won).toBe(0)
    act(() => result.current.unlockExtra())
    act(() => result.current.guess(answer))
    expect(result.current.session?.status).toBe('won')
    expect(result.current.stats.won).toBe(0)
    expect(result.current.stats.played).toBe(1)
  })

  it('offers extra guesses after the seventh', () => {
    const { result } = renderHook(() => useGame('2026-09-13', '2026-09-13'))
    const misses = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ ...wrong, id: `f_m${n}` }))
    act(() => misses.forEach((m) => result.current.guess(m)))
    expect(result.current.canUnlockExtra).toBe(true)
    act(() => result.current.unlockExtra())
    expect(result.current.session?.status).toBe('playing')
  })
})
