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
    const locked = screen.queryAllByText(/Unlocks after guess/).length
    expect(dialog !== null || locked === 4).toBe(true)
    expect(answer.cast.length).toBeGreaterThanOrEqual(6)
  })

  it('generates real clues that never name the real answer', () => {
    const today = istDateString(new Date())
    const answer = getFilm(answerIdForDate(today)!)!
    render(<App />)
    expect(screen.getByLabelText('Clues').textContent).not.toContain(answer.title)
  })
})
