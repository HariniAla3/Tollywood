import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuessHistory } from './GuessHistory'
import { RuledOutPanel } from './RuledOutPanel'
import { LifelineBar } from './LifelineBar'
import { ResultModal } from './ResultModal'
import { startSession, submitGuess } from '../domain/session'
import { emptyStats } from '../storage/stats'
import type { Film, Person } from '../domain/types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Rangasthalam', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'], director: p(100), musicDirector: p(200),
  cast: [1, 2, 3, 4, 5, 6].map((n) => p(n)), posterPath: null,
  popularity: 50, voteCount: 50, isMysteryEligible: true,
}
const wrong: Film = { ...answer, id: 'f_b', title: 'Pokiri', year: 2006, genres: ['Crime'],
  director: p(900), musicDirector: p(901), cast: [p(800)] }
const athadu: Film = { ...wrong, id: 'f_c', title: 'Athadu' }

const lookup = (id: string) => [answer, wrong, athadu].find((f) => f.id === id)

describe('GuessHistory', () => {
  it('says nothing before the first guess', () => {
    const { container } = render(<GuessHistory outcomes={[]} lookup={lookup} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists a guessed title and year', () => {
    const s = submitGuess(startSession('d', answer), wrong)
    render(<GuessHistory outcomes={s.outcomes} lookup={lookup} />)
    expect(screen.getByText('Pokiri')).toBeInTheDocument()
    expect(screen.getByText('2006')).toBeInTheDocument()
  })

  it('shows newest first', () => {
    let s = submitGuess(startSession('d', answer), wrong)
    s = submitGuess(s, athadu)
    render(<GuessHistory outcomes={s.outcomes} lookup={lookup} />)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Athadu')
  })

  it('shows how many cells a guess opened', () => {
    const s = submitGuess(startSession('d', answer), wrong)
    render(<GuessHistory outcomes={s.outcomes} lookup={lookup} />)
    expect(screen.getByText(/0 revealed/i)).toBeInTheDocument()
  })
})

describe('RuledOutPanel', () => {
  it('renders nothing when nobody is ruled out', () => {
    const { container } = render(<RuledOutPanel people={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists ruled-out names', () => {
    render(<RuledOutPanel people={[p(1, 'Mahesh Babu'), p(2, 'Puri Jagannadh')]} />)
    expect(screen.getByText('Mahesh Babu')).toBeInTheDocument()
    expect(screen.getByText('Puri Jagannadh')).toBeInTheDocument()
  })

  it('shows how many are ruled out', () => {
    render(<RuledOutPanel people={[p(1), p(2), p(3)]} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('LifelineBar', () => {
  const noop = () => {}

  it('is silent with nothing available', () => {
    const { container } = render(
      <LifelineBar revealsAvailable={0} canUnlockExtra={false} selecting={false}
        onStartSelect={noop} onCancelSelect={noop} onUnlockExtra={noop} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers a reveal when one is available', async () => {
    const onStartSelect = vi.fn()
    render(
      <LifelineBar revealsAvailable={1} canUnlockExtra={false} selecting={false}
        onStartSelect={onStartSelect} onCancelSelect={noop} onUnlockExtra={noop} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /reveal a cell/i }))
    expect(onStartSelect).toHaveBeenCalled()
  })

  it('offers cancel while selecting', async () => {
    const onCancelSelect = vi.fn()
    render(
      <LifelineBar revealsAvailable={1} canUnlockExtra={false} selecting
        onStartSelect={noop} onCancelSelect={onCancelSelect} onUnlockExtra={noop} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancelSelect).toHaveBeenCalled()
  })

  it('offers extra guesses when unlockable', async () => {
    const onUnlockExtra = vi.fn()
    render(
      <LifelineBar revealsAvailable={0} canUnlockExtra selecting={false}
        onStartSelect={noop} onCancelSelect={noop} onUnlockExtra={onUnlockExtra} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /3 more guesses/i }))
    expect(onUnlockExtra).toHaveBeenCalled()
  })
})

describe('ResultModal', () => {
  it('does not render while the game is in play', () => {
    const { container } = render(
      <ResultModal session={startSession('2026-01-01', answer)} stats={emptyStats()} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('reveals the title on a win', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    render(<ResultModal session={s} stats={emptyStats()} onClose={() => {}} />)
    expect(screen.getByText(/Rangasthalam/)).toBeInTheDocument()
  })

  it('reveals the title on a loss', () => {
    let s = startSession('2026-01-01', answer)
    for (let i = 1; i <= 7; i++) s = submitGuess(s, { ...wrong, id: `f_m${i}` })
    render(<ResultModal session={s} stats={emptyStats()} onClose={() => {}} />)
    expect(screen.getByText(/Rangasthalam/)).toBeInTheDocument()
  })

  it('copies the share card to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    render(<ResultModal session={s} stats={emptyStats()} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /share/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Tollywood #1'))
  })

  it('shows played and win-rate statistics', () => {
    const s = submitGuess(startSession('2026-01-01', answer), answer)
    render(
      <ResultModal session={s} stats={{ ...emptyStats(), played: 4, won: 3, currentStreak: 2 }} onClose={() => {}} />,
    )
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
