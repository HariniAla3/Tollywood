import { readFileSync, writeFileSync } from 'node:fs'
import { guessableFilms } from '../src/data/repository'
import { normalizeTitle } from '../src/domain/search'

/**
 * Riddles are supplied numbered by rank in docs/mystery-pool.md, which is the
 * answer pool sorted by vote count. Mapping by rank is exact, but a renumbering
 * would silently attach every riddle to the wrong film -- so each entry's label
 * is checked against the film actually sitting at that rank.
 */
type Entry = { label: string; riddle: string }

const staged = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Record<string, Entry>
const ranked = [...guessableFilms().filter((f) => f.isMysteryEligible)].sort(
  (a, b) => b.voteCount - a.voteCount,
)

const out: Record<string, string> = {}
const mismatches: string[] = []

for (const [rank, entry] of Object.entries(staged)) {
  const film = ranked[Number(rank) - 1]
  if (!film) {
    mismatches.push(`rank ${rank}: no film at that position`)
    continue
  }
  if (normalizeTitle(film.title) !== normalizeTitle(entry.label)) {
    mismatches.push(`rank ${rank}: label "${entry.label}" vs pool "${film.title}"`)
    continue
  }
  if (entry.riddle.toLowerCase().includes(film.title.toLowerCase())) {
    mismatches.push(`rank ${rank}: riddle names its own film "${film.title}"`)
    continue
  }
  out[film.id] = entry.riddle
}

writeFileSync('src/data/riddles.json', JSON.stringify(out, null, 1) + '\n')
console.log(`  imported ${Object.keys(out).length} riddles`)
console.log(`  answer pool: ${ranked.length}  |  still unwritten: ${ranked.length - Object.keys(out).length}`)
if (mismatches.length) {
  console.log(`\n  NEEDS ATTENTION (${mismatches.length}):`)
  mismatches.forEach((m) => console.log('    - ' + m))
} else {
  console.log('\n  every riddle matched its film exactly')
}
