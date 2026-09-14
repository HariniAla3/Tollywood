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

  it('keeps every clue locked before the first guess', () => {
    render(<App />)
    expect(screen.getAllByText(/Unlocks after guess/)).toHaveLength(5)
  })

  it('unlocks one clue after a wrong guess', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.type(screen.getByRole('combobox'), 'pokiri')
    await user.click(screen.getByRole('option'))
    expect(screen.getAllByText(/Unlocks after guess/)).toHaveLength(4)
  })

  it('never shows a clue naming the answer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.type(screen.getByRole('combobox'), 'pokiri')
    await user.click(screen.getByRole('option'))
    const panel = screen.getByLabelText('Clues')
    expect(panel.textContent).not.toContain('Rangasthalam')
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
