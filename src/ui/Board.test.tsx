import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardView } from './Board'
import { createBoard, applyReveals, revealCell } from '../domain/board'
import type { Film, Person } from '../domain/types'

const p = (id: number, name: string): Person => ({ id, name })

const answer: Film = {
  id: 'f_a', tmdbId: 1, title: 'Rangasthalam', titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action', 'Drama'],
  director: p(100, 'Sukumar'), musicDirector: p(200, 'Devi Sri Prasad'),
  cast: [
    p(1, 'Ram Charan'), p(2, 'Samantha'), p(3, 'Aadhi'),
    p(4, 'Jagapathi Babu'), p(5, 'Prakash Raj'), p(6, 'Anasuya'),
  ],
  posterPath: null, popularity: 50, voteCount: 50, isMysteryEligible: true,
}

describe('BoardView', () => {
  it('renders no answer values while every cell is hidden', () => {
    const { container } = render(
      <BoardView board={createBoard(answer)} selecting={false} onPick={() => {}} />,
    )
    for (const secret of ['Sukumar', 'Devi Sri Prasad', 'Ram Charan', 'Action', 'Drama']) {
      expect(container.innerHTML).not.toContain(secret)
    }
  })

  it('shows the year range while unsolved', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'later', guessYear: 2010 },
    ])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText(/2011/)).toBeInTheDocument()
    expect(screen.getByText(/2025/)).toBeInTheDocument()
  })

  it('shows the exact year once solved', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'year', relation: 'exact', guessYear: 2018 },
    ])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText('2018')).toBeInTheDocument()
  })

  it('reveals a matched genre', () => {
    const board = applyReveals(createBoard(answer), [{ kind: 'genre', slot: 1, genre: 'Drama' }])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.queryByText('Action')).not.toBeInTheDocument()
  })

  it('reveals a matched cast member at their billing number', () => {
    const board = applyReveals(createBoard(answer), [
      { kind: 'cast', slot: 2, person: p(3, 'Aadhi') },
    ])
    render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(screen.getByText('Aadhi')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('marks a lifeline cell differently from a matched one', () => {
    let board = applyReveals(createBoard(answer), [
      { kind: 'crew', role: 'director', person: p(100, 'Sukumar') },
    ])
    board = revealCell(board, { kind: 'crew', role: 'musicDirector' })
    const { container } = render(<BoardView board={board} selecting={false} onPick={() => {}} />)
    expect(container.querySelector('.cell--matched')).toBeTruthy()
    expect(container.querySelector('.cell--lifeline')).toBeTruthy()
  })

  it('renders no Music cell when the film has no composer', () => {
    render(
      <BoardView board={createBoard({ ...answer, musicDirector: null })}
        selecting={false} onPick={() => {}} />,
    )
    expect(screen.queryByText('Music')).not.toBeInTheDocument()
    expect(screen.getByText('Director')).toBeInTheDocument()
  })

  it('offers only ten pickable cells when there is no Music cell', () => {
    render(
      <BoardView board={createBoard({ ...answer, musicDirector: null })}
        selecting onPick={() => {}} />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })

  it('does not offer cells as buttons outside selection mode', () => {
    render(<BoardView board={createBoard(answer)} selecting={false} onPick={() => {}} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('offers every hidden cell as a button in selection mode', () => {
    render(<BoardView board={createBoard(answer)} selecting onPick={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })

  it('reports which cell was picked', async () => {
    const onPick = vi.fn()
    render(<BoardView board={createBoard(answer)} selecting onPick={onPick} />)
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onPick).toHaveBeenCalledWith({ kind: 'year' })
  })

  it('does not offer already-open cells for selection', () => {
    const board = applyReveals(createBoard(answer), [{ kind: 'genre', slot: 0, genre: 'Action' }])
    render(<BoardView board={board} selecting onPick={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })
})
