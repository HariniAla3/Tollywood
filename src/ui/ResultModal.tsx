import { useState } from 'react'
import { buildShareCard } from '../domain/share'
import type { Session } from '../domain/session'
import type { Stats } from '../storage/types'

type Props = { session: Session; stats: Stats; onClose: () => void }

export function ResultModal({ session, stats, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  if (session.status === 'playing') return null

  const card = buildShareCard(session, stats.currentStreak)
  const winRate = stats.played === 0 ? 0 : Math.round((stats.won / stats.played) * 100)

  async function share() {
    try {
      await navigator.clipboard.writeText(card)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__panel">
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">×</button>

        <p className="modal__verdict">{session.status === 'won' ? 'Got it' : 'Out of guesses'}</p>
        <h2 className="modal__title">{session.answer.title}</h2>
        <p className="modal__sub">
          {session.answer.year} · dir. {session.answer.director.name}
        </p>

        <dl className="modal__stats">
          <div><dt>Played</dt><dd>{stats.played}</dd></div>
          <div><dt>Win %</dt><dd>{winRate}%</dd></div>
          <div><dt>Streak</dt><dd>{stats.currentStreak}</dd></div>
          <div><dt>Best</dt><dd>{stats.maxStreak}</dd></div>
        </dl>

        <pre className="modal__card">{card}</pre>

        <button type="button" className="lifelines__btn" onClick={share}>
          {copied ? 'Copied' : 'Share result'}
        </button>
      </div>
    </div>
  )
}
