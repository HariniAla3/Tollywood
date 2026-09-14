import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HowToPlay } from './HowToPlay'
import { hasSeenHowToPlay, markHowToPlaySeen } from '../storage/prefs'

describe('HowToPlay', () => {
  it('states the goal in the first line', () => {
    render(<HowToPlay onClose={() => {}} />)
    expect(screen.getByText(/Guess the mystery Telugu film/i)).toBeInTheDocument()
    expect(screen.getByText('7 tries')).toBeInTheDocument()
  })

  it('shows a worked example with a real guess', () => {
    render(<HowToPlay onClose={() => {}} />)
    expect(screen.getByText(/Pokiri \(2006\)/)).toBeInTheDocument()
  })

  it('demonstrates a matched cell and a hidden one', () => {
    const { container } = render(<HowToPlay onClose={() => {}} />)
    expect(container.querySelector('.howto__demo .cell--matched')).toBeTruthy()
    expect(container.querySelector('.howto__demo .cell--hidden')).toBeTruthy()
  })

  it('explains the billing-order numbering', () => {
    render(<HowToPlay onClose={() => {}} />)
    expect(screen.getByText(/numbered by billing order/i)).toBeInTheDocument()
  })

  it('explains that the year narrows rather than reveals', () => {
    render(<HowToPlay onClose={() => {}} />)
    expect(screen.getByText(/never shows outright/i)).toBeInTheDocument()
  })

  it('explains that blank cells are information too', () => {
    render(<HowToPlay onClose={() => {}} />)
    expect(screen.getByText(/blank cell is information/i)).toBeInTheDocument()
  })

  it('says when the riddle unlocks', () => {
    render(<HowToPlay onClose={() => {}} />)
    expect(screen.getByText(/unlocks after your second guess/i)).toBeInTheDocument()
  })

  it('mentions the daily reset and the archive', () => {
    render(<HowToPlay onClose={() => {}} />)
    expect(screen.getByText(/midnight IST/i)).toBeInTheDocument()
    expect(screen.getByText(/Past days/i)).toBeInTheDocument()
  })

  it('closes from the play button', async () => {
    const onClose = vi.fn()
    render(<HowToPlay onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /let.s play/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes from the × button', async () => {
    const onClose = vi.fn()
    render(<HowToPlay onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('how-to-play preference', () => {
  it('is unseen before the first visit', () => {
    expect(hasSeenHowToPlay()).toBe(false)
  })

  it('remembers once marked', () => {
    markHowToPlaySeen()
    expect(hasSeenHowToPlay()).toBe(true)
  })

  it('survives storage being unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    expect(() => markHowToPlaySeen(broken)).not.toThrow()
    expect(hasSeenHowToPlay(broken)).toBe(false)
  })
})
