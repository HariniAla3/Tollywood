/**
 * All clue wording lives here, separate from the logic that picks it.
 * Rewrite these freely -- no test asserts on exact phrasing, only on the
 * rules (five clues, never naming the answer, stable across runs).
 *
 * `{film}` is substituted with a linked film title. Add as many variants
 * per bank as you like; more variants means less repetition day to day.
 */

export const ERA = {
  '2000s': [
    'Ee movie vachinappudu andari daggara Nokia 1100 undedi.',
    'CD shop lo pirated copy dorike rojulu. Aa era.',
    'Ee time lo cinema chudalante theatre ke vellali.',
  ],
  '2010s': [
    'Prathi function lo DSP song mogina era idhi.',
    'Facebook lo movie reviews raasina rojulu.',
    'Multiplex tickets inka affordable ga unna time.',
  ],
  '2020s': [
    'Intha old kaadu. Memes inka WhatsApp group lo circulate avuthunnay.',
    'OTT lo eppudo chusi untaru. Gurthu techukondi.',
    'Ee movie meme templates inka expire avvaledu.',
  ],
} as const

export const TITLE_SHAPE = {
  one: [
    'One word title. Anthe. Aa oka word chaalu.',
    'Title lo oke oka word. Confidence chudandi.',
  ],
  two: [
    'Rendu words. Poster lo rendintini enormous ga vesaru.',
    'Two-word title. Rendu kuda meeku telisinave.',
  ],
  many: [
    'Title ki oka full sentence ye undi.',
    'Title chadavadaniki ye oka nimisham padutundi.',
  ],
} as const

export const FAME = {
  huge: [
    'Mee non-Telugu friends ki kuda idhi telusu.',
    'Idhi teliyadu ante meeru cinema chudanattu.',
  ],
  known: [
    'Mee amma idhi rendu sarlu chusindi. Minimum.',
    'TV lo prathi festival ki vestharu idhi.',
  ],
  deep: [
    'Blockbuster kaadu. Kaani fans meeda debate ki dhigutharu.',
    'Box office lo pedda kaadu, kaani oka fanbase undi.',
  ],
} as const

export const LEAD_LINK = [
  'Ee hero banisalu prathi Sunday {film} TV lo chustharu. Adhe hero.',
  'Same hero. {film} lo chusinaru kada? Aayane.',
  'Ee hero ne {film} lo kuda hero.',
] as const

export const DIRECTOR_LINK = [
  'Idhi teesina director ye {film} kuda teesadu. Same brain.',
  'Same director. {film} kuda aayane teesadu.',
  '{film} teesina director ye idhi kuda teesadu.',
] as const

export const MUSIC_LINK = [
  '{film} ki music ichina same person ye deeniki kuda ichadu.',
  'Same music director. {film} songs gurthunnaya? Aayane.',
] as const

/** Last resort when a film has no linked co-credit anywhere. */
export const FIRST_LETTER = [
  'Title "{letter}" tho start avutundi. Anthe cheptha.',
  'Okate hint: first letter "{letter}".',
] as const

/**
 * Second last resort, for the rare film with no co-credits at all -- both
 * link rungs would otherwise print the same first-letter line twice.
 */
export const LETTER_COUNT = [
  'Title lo {n} letters unnay. Count chesukondi.',
  '{n} letters. Anthe cheptha, inka em adagakandi.',
] as const
