import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CluePanel } from './CluePanel'

const clues = ['Clue one text', 'Clue two text', 'Clue three text', 'Clue four text', 'Clue five text']

describe('CluePanel', () => {
  it('renders nothing without clues', () => {
    const { container } = render(<CluePanel clues={[]} unlocked={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides every clue before the first wrong guess', () => {
    render(<CluePanel clues={clues} unlocked={0} />)
    for (const c of clues) expect(screen.queryByText(c)).not.toBeInTheDocument()
  })

  it('explains how clues unlock when none are open', () => {
    render(<CluePanel clues={clues} unlocked={0} />)
    expect(screen.getByText(/unlocks with each wrong guess/i)).toBeInTheDocument()
  })

  it('shows locked placeholders for every clue', () => {
    render(<CluePanel clues={clues} unlocked={0} />)
    expect(screen.getAllByText(/Unlocks after guess/)).toHaveLength(5)
  })

  it('opens one clue per wrong guess', () => {
    render(<CluePanel clues={clues} unlocked={2} />)
    expect(screen.getByText('Clue one text')).toBeInTheDocument()
    expect(screen.getByText('Clue two text')).toBeInTheDocument()
    expect(screen.queryByText('Clue three text')).not.toBeInTheDocument()
  })

  it('opens everything once enough guesses are used', () => {
    render(<CluePanel clues={clues} unlocked={5} />)
    for (const c of clues) expect(screen.getByText(c)).toBeInTheDocument()
  })

  it('does not break when unlocked exceeds the clue count', () => {
    render(<CluePanel clues={clues} unlocked={99} />)
    for (const c of clues) expect(screen.getByText(c)).toBeInTheDocument()
  })

  it('marks unopened clues as locked', () => {
    const { container } = render(<CluePanel clues={clues} unlocked={1} />)
    expect(container.querySelectorAll('.clues__item--locked')).toHaveLength(4)
  })
})
