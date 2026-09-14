import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import type { Film, Person } from '../domain/types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Rangasthalam', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'],
  director: p(100, 'Sukumar'), musicDirector: p(200, 'DSP'),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)), posterPath: null,
  popularity: 50, voteCount: 50, isMysteryEligible: true,
}
const other: Film = { ...answer, id: 'f_b', title: 'Pokiri', year: 2006, genres: ['Crime'],
  director: p(900, 'Puri'), musicDirector: p(901, 'Mani'), cast: [p(800, 'Mahesh Babu')] }

vi.mock('../data/repository', () => ({
  getFilm: (id: string) => [answer, other].find((f) => f.id === id),
  guessableFilms: () => [answer, other],
  answerIdForDate: (d: string) => (d === '2026-09-13' || d === '2026-09-12' ? 'f_a' : null),
  playableDates: () => ['2026-09-13', '2026-09-12'],
}))

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    // Most tests exercise the game, not the first-visit intro.
    localStorage.setItem('tollywood:seen-how-to-play', '1')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-13T06:00:00Z'))
    window.history.replaceState({}, '', '/')
  })
  afterEach(() => vi.useRealTimers())

  it('shows today’s puzzle number', () => {
    render(<App />)
    expect(screen.getByText(/#256/)).toBeInTheDocument()
  })

  it('renders the board with everything hidden', () => {
    const { container } = render(<App />)
    expect(container.innerHTML).not.toContain('Sukumar')
  })

  it('plays a guess end to end', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.type(screen.getByRole('combobox'), 'pokiri')
    await user.click(screen.getByRole('option'))
    expect(screen.getByText('Pokiri')).toBeInTheDocument()
  })

  it('keeps the riddle locked before two guesses', () => {
    render(<App />)
    expect(screen.getByText(/Unlocks after 2 more guesses/i)).toBeInTheDocument()
  })

  it('counts down the riddle after one guess', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.type(screen.getByRole('combobox'), 'pokiri')
    await user.click(screen.getByRole('option'))
    expect(screen.getByText(/Unlocks after 1 more guess\./i)).toBeInTheDocument()
  })

  it('never shows a riddle naming the answer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.type(screen.getByRole('combobox'), 'pokiri')
    await user.click(screen.getByRole('option'))
    expect(screen.getByLabelText('Riddle').textContent).not.toContain('Rangasthalam')
  })

  it('shows how to play on a first visit', () => {
    localStorage.clear()
    render(<App />)
    expect(screen.getByRole('dialog', { name: /how to play/i })).toBeInTheDocument()
  })

  it('does not show how to play again once dismissed', async () => {
    localStorage.clear()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: /let.s play/i }))
    unmount()
    render(<App />)
    expect(screen.queryByRole('dialog', { name: /how to play/i })).not.toBeInTheDocument()
  })

  it('reopens how to play from the ? button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /how to play/i }))
    expect(screen.getByRole('dialog', { name: /how to play/i })).toBeInTheDocument()
  })

  it('shows the result modal on a win', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.type(screen.getByRole('combobox'), 'rangasthalam')
    await user.click(screen.getByRole('option'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens the archive', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /past days/i }))
    expect(screen.getByRole('button', { name: /#255/ })).toBeInTheDocument()
  })

  it('switches to an archived puzzle and reflects it in the URL', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /past days/i }))
    await user.click(screen.getByRole('button', { name: /#255/ }))
    expect(screen.getByText(/#255/)).toBeInTheDocument()
    expect(window.location.search).toContain('d=2026-09-12')
  })

  it('loads the date from the URL on first render', () => {
    window.history.replaceState({}, '', '/?d=2026-09-12')
    render(<App />)
    expect(screen.getByText(/#255/)).toBeInTheDocument()
  })

  it('keeps archived progress separate from today’s', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.type(screen.getByRole('combobox'), 'pokiri')
    await user.click(screen.getByRole('option'))
    await user.click(screen.getByRole('button', { name: /past days/i }))
    await user.click(screen.getByRole('button', { name: /#255/ }))
    expect(screen.queryByText('Mahesh Babu')).not.toBeInTheDocument()
  })

  it('credits TMDB in the footer', () => {
    render(<App />)
    expect(screen.getByText(/TMDB/)).toBeInTheDocument()
  })
})
