const SEEN_KEY = 'tollywood:seen-how-to-play'

/**
 * UI preferences, deliberately separate from GameStorage -- that interface is
 * the seam for game data. Every access is guarded because private browsing
 * makes localStorage throw rather than return null.
 */
export function hasSeenHowToPlay(ls: Storage = localStorage): boolean {
  try {
    return ls.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markHowToPlaySeen(ls: Storage = localStorage): void {
  try {
    ls.setItem(SEEN_KEY, '1')
  } catch {
    // Nothing to do -- they will see it again next visit.
  }
}
