import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { answerIdForDate, getFilm } from '../data/repository'
import { istDateString } from '../domain/puzzleDate'

/** No repository mock -- this runs against the real generated films.json. */
describe('App against real data', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('tollywood:seen-how-to-play', '1')
    window.history.replaceState({}, '', '/')
  })
  afterEach(() => vi.useRealTimers())

  it('renders today’s real puzzle', () => {
    render(<App />)
    expect(screen.getByText('Tollywood')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('does not leak today’s real answer into the DOM', () => {
    const today = istDateString(new Date())
    const answer = getFilm(answerIdForDate(today)!)!
    const { container } = render(<App />)
    expect(container.innerHTML).not.toContain(answer.title)
    expect(container.innerHTML).not.toContain(answer.director.name)
  })

  it('autocompletes real Telugu films', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('combobox'), 'baahubali')
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    expect(options[0].textContent).toMatch(/hubali/i)
  })

  it('plays a real guess and advances the game', async () => {
    const today = istDateString(new Date())
    const answer = getFilm(answerIdForDate(today)!)!
    render(<App />)
    await userEvent.type(screen.getByRole('combobox'), 'rangasthalam')
    await userEvent.click(screen.getAllByRole('option')[0])
    // Either it was the answer (modal) or a clue unlocked.
    const dialog = screen.queryByRole('dialog')
    const countdown = screen.queryByText(/Unlocks after 1 more guess/i)
    expect(dialog !== null || countdown !== null).toBe(true)
    expect(answer.cast.length).toBeGreaterThanOrEqual(6)
  })

  it('generates a real riddle that never names the real answer', async () => {
    const today = istDateString(new Date())
    const answer = getFilm(answerIdForDate(today)!)!
    render(<App />)
    // Unlock it: the riddle only renders after two guesses.
    for (const title of ['rangasthalam', 'pokiri']) {
      await userEvent.type(screen.getByRole('combobox'), title)
      const opts = screen.queryAllByRole('option')
      if (opts.length) await userEvent.click(opts[0])
    }
    expect(screen.getByLabelText('Riddle').textContent).not.toContain(answer.title)
  })
})
