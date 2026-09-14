import { describe, it, expect } from 'vitest'
import { normalizeTitle, searchFilms, searchKey } from './search'
import type { Film, Person } from './types'

const p = (id: number): Person => ({ id, name: `P${id}` })

const film = (id: string, title: string, over: Partial<Film> = {}): Film => ({
  id, tmdbId: Number(id.replace('f_', '')), title, titleTelugu: null, aliases: [],
  year: 2018, genres: ['Action'], director: p(100), musicDirector: p(200),
  cast: [p(1), p(2), p(3)], posterPath: null, popularity: 10, voteCount: 10,
  isMysteryEligible: false, ...over,
})

const catalogue = [
  film('f_1', 'Rangasthalam'),
  film('f_2', 'Rangam'),
  film('f_3', 'Baahubali: The Beginning', { voteCount: 90 }),
  film('f_4', 'Baahubali 2: The Conclusion', { voteCount: 80 }),
  film('f_5', 'Eega', { titleTelugu: 'ఈగ' }),
  film('f_6', 'Jalsa', { aliases: ['Jalsaa'] }),
  film('f_7', 'Ala Vaikunthapurramuloo'),
]

describe('normalizeTitle', () => {
  it('lowercases', () => expect(normalizeTitle('Pokiri')).toBe('pokiri'))
  it('strips punctuation', () =>
    expect(normalizeTitle('Baahubali: The Beginning')).toBe('baahubali the beginning'))
  it('collapses whitespace', () => expect(normalizeTitle('  Rang   De  ')).toBe('rang de'))
  it('strips diacritics', () => expect(normalizeTitle('Áthadu')).toBe('athadu'))
  it('strips the macron TMDB uses in Bāhubali', () =>
    expect(normalizeTitle('Bāhubali')).toBe('bahubali'))
})

describe('searchFilms', () => {
  it('returns nothing for an empty query', () => expect(searchFilms(catalogue, '')).toEqual([]))
  it('returns nothing for a whitespace-only query', () =>
    expect(searchFilms(catalogue, '   ')).toEqual([]))

  it('finds by title prefix', () => {
    // Both Rangasthalam and Rangam start with "ranga" -- both are correct hits.
    expect(searchFilms(catalogue, 'ranga').map((f) => f.id).sort()).toEqual(['f_1', 'f_2'])
  })

  it('narrows as the query gets longer', () => {
    expect(searchFilms(catalogue, 'rangas').map((f) => f.id)).toEqual(['f_1'])
  })

  it('ranks an exact title first', () => {
    expect(searchFilms(catalogue, 'rangam')[0].id).toBe('f_2')
  })

  it('ranks prefix matches above mid-word matches', () => {
    const ids = searchFilms(catalogue, 'rang').map((f) => f.id)
    expect(ids.slice(0, 2).sort()).toEqual(['f_1', 'f_2'])
  })

  it('is case-insensitive', () => {
    expect(searchFilms(catalogue, 'EEGA').map((f) => f.id)).toEqual(['f_5'])
  })

  it('ignores punctuation in the query', () => {
    expect(searchFilms(catalogue, 'baahubali:').length).toBe(2)
  })

  it('matches on a later word', () => {
    expect(searchFilms(catalogue, 'conclusion').map((f) => f.id)).toEqual(['f_4'])
  })

  it('matches the Telugu title', () => {
    expect(searchFilms(catalogue, 'ఈగ').map((f) => f.id)).toEqual(['f_5'])
  })

  it('matches an alias', () => {
    expect(searchFilms(catalogue, 'jalsaa').map((f) => f.id)).toEqual(['f_6'])
  })

  it('breaks ties by vote count', () => {
    expect(searchFilms(catalogue, 'baahubali').map((f) => f.id)).toEqual(['f_3', 'f_4'])
  })

  it('respects the limit', () => {
    expect(searchFilms(catalogue, 'a', 2)).toHaveLength(2)
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchFilms(catalogue, 'zzzzz')).toEqual([])
  })
})

describe('searchKey — Telugu transliteration', () => {
  it('collapses repeated vowels', () => {
    expect(searchKey('Baahubali')).toBe(searchKey('Bāhubali'))
    expect(searchKey('Aarya 2')).toBe(searchKey('Arya 2'))
    expect(searchKey('Dookudu')).toBe(searchKey('Dokudu'))
  })

  it('leaves single vowels alone', () => {
    expect(searchKey('Pokiri')).toBe('pokiri')
  })
})

describe('searchFilms — transliteration tolerance', () => {
  const alt = [
    film('f_10', 'Bāhubali: The Beginning'),
    film('f_11', 'Aarya 2'),
    film('f_12', 'Dookudu'),
  ]

  it('finds Bāhubali when the player types Baahubali', () => {
    expect(searchFilms(alt, 'baahubali').map((f) => f.id)).toContain('f_10')
  })

  it('finds Aarya 2 when the player types Arya 2', () => {
    expect(searchFilms(alt, 'arya 2').map((f) => f.id)).toContain('f_11')
  })

  it('finds Dookudu when the player types Dokudu', () => {
    expect(searchFilms(alt, 'dokudu').map((f) => f.id)).toContain('f_12')
  })
})
