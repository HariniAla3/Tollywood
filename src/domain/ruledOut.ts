import type { Person } from './types'

/** Append people not already listed, preserving discovery order. */
export function mergeRuledOut(existing: Person[], incoming: Person[]): Person[] {
  const seen = new Set(existing.map((p) => p.id))
  const out = [...existing]
  for (const person of incoming) {
    if (seen.has(person.id)) continue
    seen.add(person.id)
    out.push(person)
  }
  return out
}
