import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

/**
 * Node 25 exposes its own `localStorage` global -- a plain object with none of
 * the Storage methods -- and it shadows the working one jsdom provides. Left
 * alone, every storage-backed test fails with "clear is not a function".
 *
 * Installing a real in-memory Storage here is also better than relying on
 * jsdom's: it is synchronous, origin-independent, and reset between tests.
 */
class MemoryStorage implements Storage {
  #map = new Map<string, string>()

  get length(): number {
    return this.#map.size
  }
  key(index: number): string | null {
    return [...this.#map.keys()][index] ?? null
  }
  getItem(key: string): string | null {
    return this.#map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.#map.set(key, String(value))
  }
  removeItem(key: string): void {
    this.#map.delete(key)
  }
  clear(): void {
    this.#map.clear()
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => storage.clear())
