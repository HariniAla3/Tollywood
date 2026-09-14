import type { Person } from '../domain/types'

export function RuledOutPanel({ people }: { people: Person[] }) {
  if (people.length === 0) return null

  return (
    <section className="ruledout">
      <h2 className="board__heading">
        Ruled out <span className="ruledout__count">{people.length}</span>
      </h2>
      <ul className="ruledout__list">
        {people.map((person) => (
          <li key={person.id} className="ruledout__name">{person.name}</li>
        ))}
      </ul>
    </section>
  )
}
