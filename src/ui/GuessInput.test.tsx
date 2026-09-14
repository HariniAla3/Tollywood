import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuessInput } from './GuessInput'
import type { Film, Person } from '../domain/types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const film = (id: string, title: string, year = 2018): Film => ({
  id, tmdbId: Number(id.replace('f_', '')), title, titleTelugu: null, aliases: [],
  year, genres: ['Action'], director: p(1), musicDirector: p(2),
  cast: [p(3), p(4), p(5)], posterPath: null, popularity: 10, voteCount: 10,
  isMysteryEligible: false,
})

const films = [film('f_1', 'Rangasthalam'), film('f_2', 'Rangam', 2011), film('f_3', 'Pokiri', 2006)]

describe('GuessInput', () => {
  it('shows no suggestions before typing', () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('suggests matching films as you type', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'rang')
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('shows the year alongside the title', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    expect(screen.getByRole('option')).toHaveTextContent('2006')
  })

  it('fires onGuess with the chosen film', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(onGuess).toHaveBeenCalledWith(films[2])
  })

  it('clears the field after a guess', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(input).toHaveValue('')
  })

  it('disables an already-guessed film', async () => {
    render(<GuessInput films={films} guessedIds={['f_3']} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    expect(screen.getByRole('option')).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not fire onGuess for an already-guessed film', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={['f_3']} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri')
    await userEvent.click(screen.getByRole('option'))
    expect(onGuess).not.toHaveBeenCalled()
  })

  it('does not submit free text on Enter', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'Pokiri{Enter}')
    expect(onGuess).not.toHaveBeenCalled()
  })

  it('selects the highlighted option with the keyboard', async () => {
    const onGuess = vi.fn()
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={onGuess} />)
    await userEvent.type(screen.getByRole('combobox'), 'pokiri{ArrowDown}{Enter}')
    expect(onGuess).toHaveBeenCalledWith(films[2])
  })

  it('says so when nothing matches', async () => {
    render(<GuessInput films={films} guessedIds={[]} disabled={false} onGuess={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'zzzz')
    expect(screen.getByText(/no telugu film/i)).toBeInTheDocument()
  })

  it('is disabled once the game is over', () => {
    render(<GuessInput films={films} guessedIds={[]} disabled onGuess={() => {}} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
