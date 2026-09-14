import { describe, it, expect } from 'vitest'
import { mergeRuledOut } from './ruledOut'
import type { Person } from './types'

const p = (id: number, name = `P${id}`): Person => ({ id, name })

describe('mergeRuledOut', () => {
  it('adds new people', () => {
    expect(mergeRuledOut([p(1)], [p(2)])).toEqual([p(1), p(2)])
  })

  it('ignores people already listed', () => {
    expect(mergeRuledOut([p(1)], [p(1)])).toEqual([p(1)])
  })

  it('deduplicates within the incoming batch', () => {
    expect(mergeRuledOut([], [p(1), p(1)])).toEqual([p(1)])
  })

  it('preserves insertion order', () => {
    expect(mergeRuledOut([p(3)], [p(1), p(2)])).toEqual([p(3), p(1), p(2)])
  })

  it('does not mutate the existing list', () => {
    const existing = [p(1)]
    mergeRuledOut(existing, [p(2)])
    expect(existing).toEqual([p(1)])
  })

  it('returns an empty list when nothing is ruled out', () => {
    expect(mergeRuledOut([], [])).toEqual([])
  })
})
