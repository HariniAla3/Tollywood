import { describe, it, expect } from 'vitest'
import { toCandidate } from './tmdb'

const genreNames = new Map([[28, 'Action'], [18, 'Drama'], [35, 'Comedy']])

const movie = {
  id: 447365,
  title: 'Rangasthalam',
  original_title: 'రంగస్థలం',
  release_date: '2018-03-30',
  genre_ids: [28, 18],
  poster_path: '/poster.jpg',
  popularity: 42.5,
  vote_count: 85,
}

const credits = {
  cast: [
    { id: 1, name: 'Ram Charan', order: 0 },
    { id: 2, name: 'Samantha', order: 1 },
    { id: 3, name: 'Aadhi Pinisetty', order: 2 },
  ],
  crew: [
    { id: 10, name: 'Sukumar', job: 'Director' },
    { id: 11, name: 'Devi Sri Prasad', job: 'Original Music Composer' },
    { id: 12, name: 'Somebody Else', job: 'Producer' },
  ],
}

describe('toCandidate', () => {
  it('maps core fields', () => {
    const c = toCandidate(movie, credits, genreNames)
    expect(c.id).toBe('f_447365')
    expect(c.tmdbId).toBe(447365)
    expect(c.title).toBe('Rangasthalam')
    expect(c.year).toBe(2018)
    expect(c.posterPath).toBe('/poster.jpg')
    expect(c.popularity).toBe(42.5)
    expect(c.voteCount).toBe(85)
  })

  it('resolves genre ids to names in the order given', () => {
    expect(toCandidate(movie, credits, genreNames).genres).toEqual(['Action', 'Drama'])
  })

  it('drops genre ids it cannot resolve', () => {
    const m = { ...movie, genre_ids: [28, 9999] }
    expect(toCandidate(m, credits, genreNames).genres).toEqual(['Action'])
  })

  it('keeps the original title as titleTelugu only when it differs', () => {
    expect(toCandidate(movie, credits, genreNames).titleTelugu).toBe('రంగస్థలం')
    const same = { ...movie, original_title: 'Rangasthalam' }
    expect(toCandidate(same, credits, genreNames).titleTelugu).toBeNull()
  })

  it('sorts cast by billing order and caps at CAST_DEPTH', () => {
    const many = {
      cast: Array.from({ length: 15 }, (_, i) => ({
        id: 100 + i,
        name: `Actor ${i}`,
        order: 14 - i,
      })),
      crew: credits.crew,
    }
    const c = toCandidate(movie, many, genreNames)
    expect(c.cast).toHaveLength(10)
    expect(c.cast[0]).toEqual({ id: 114, name: 'Actor 14' })
  })

  it('extracts the director', () => {
    expect(toCandidate(movie, credits, genreNames).director).toEqual({
      id: 10,
      name: 'Sukumar',
    })
  })

  it('extracts the music director from Original Music Composer', () => {
    expect(toCandidate(movie, credits, genreNames).musicDirector).toEqual({
      id: 11,
      name: 'Devi Sri Prasad',
    })
  })

  // TMDB credits Indian composers under "Music" far more often than under
  // "Original Music Composer" -- this is how Athadu and Dookudu are recovered.
  it('falls back to the Music job', () => {
    const crew = [
      { id: 10, name: 'Sukumar', job: 'Director' },
      { id: 20, name: 'Mani Sharma', job: 'Music' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector)
      .toEqual({ id: 20, name: 'Mani Sharma' })
  })

  it('falls back to the Music Director job', () => {
    const crew = [{ id: 21, name: 'Keeravani', job: 'Music Director' }]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector)
      .toEqual({ id: 21, name: 'Keeravani' })
  })

  it('prefers Original Music Composer over the fallbacks', () => {
    const crew = [
      { id: 20, name: 'Wrong Person', job: 'Music' },
      { id: 11, name: 'Devi Sri Prasad', job: 'Original Music Composer' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector?.id)
      .toBe(11)
  })

  // Playback Singer is the most common music job on these films. Accepting it
  // would credit Athadu to S. P. Balasubramaniam instead of Mani Sharma.
  it('never treats a Playback Singer as the composer', () => {
    const crew = [
      { id: 30, name: 'S. P. Balasubramaniam', job: 'Playback Singer' },
      { id: 31, name: 'Someone', job: 'Music Programmer' },
      { id: 32, name: 'Another', job: 'Music Arranger' },
      { id: 33, name: 'Third', job: 'Sound Designer' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).musicDirector)
      .toBeNull()
  })

  it('returns null crew when the job is absent', () => {
    const c = toCandidate(movie, { cast: credits.cast, crew: [] }, genreNames)
    expect(c.director).toBeNull()
    expect(c.musicDirector).toBeNull()
  })

  it('takes the first credit when a job is listed twice', () => {
    const crew = [
      { id: 10, name: 'Sukumar', job: 'Director' },
      { id: 99, name: 'Co Director', job: 'Director' },
    ]
    expect(toCandidate(movie, { cast: credits.cast, crew }, genreNames).director?.id).toBe(10)
  })

  it('handles a missing release date as year 0', () => {
    const m = { ...movie, release_date: '' }
    expect(toCandidate(m, credits, genreNames).year).toBe(0)
  })
})
