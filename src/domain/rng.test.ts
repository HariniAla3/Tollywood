import { describe, it, expect } from 'vitest'
import { makeRng, shuffled } from './rng'

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produces different sequences for different seeds', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)())
  })

  it('stays within [0, 1)', () => {
    const rng = makeRng(7)
    for (let i = 0; i < 500; i++) {
      const n = rng()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
})

describe('shuffled', () => {
  it('keeps every element exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect([...shuffled(items, makeRng(3))].sort((a, b) => a - b)).toEqual(items)
  })

  it('does not mutate the input', () => {
    const items = [1, 2, 3, 4, 5]
    shuffled(items, makeRng(3))
    expect(items).toEqual([1, 2, 3, 4, 5])
  })

  it('is deterministic for a given seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffled(items, makeRng(9))).toEqual(shuffled(items, makeRng(9)))
  })

  it('actually reorders', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    expect(shuffled(items, makeRng(11))).not.toEqual(items)
  })
})
