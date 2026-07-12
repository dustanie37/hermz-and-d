// oscarCategories.js — Shared Oscar category normalisation (mirrors oscar_noms_fetch.py)
//
// Single source of truth for Wikidata → canonical category mapping.
// Consumed by MoviesOscarBackfill.jsx and OscarsNewYear.jsx — any fix to a QID,
// label variant, or category name belongs HERE, never in a page file.
// Extracted 2026-07-03 after the phantom-nomination bug required patching
// identical logic in two places.

export const QID_OVERRIDE = {
  'Q19024':   'Best Sound Mixing',
  'Q869717':  'Best Sound Editing',
  'Q1047215': 'Best Sound',
  'Q1148280': 'Best Sound',
}

export const CATEGORY_NORM = {
  'best picture': 'Best Picture', 'outstanding picture': 'Best Picture', 'outstanding production': 'Best Picture',
  'best director': 'Best Director', 'directing': 'Best Director', 'best directing': 'Best Director',
  'best actor in a leading role': 'Best Actor', 'best actor': 'Best Actor',
  'best performance by an actor in a leading role': 'Best Actor',
  'best actress in a leading role': 'Best Actress', 'best actress': 'Best Actress',
  'best performance by an actress in a leading role': 'Best Actress',
  'best actor in a supporting role': 'Best Supporting Actor', 'best supporting actor': 'Best Supporting Actor',
  'best performance by an actor in a supporting role': 'Best Supporting Actor',
  'best actress in a supporting role': 'Best Supporting Actress', 'best supporting actress': 'Best Supporting Actress',
  'best performance by an actress in a supporting role': 'Best Supporting Actress',
  'best original screenplay': 'Best Original Screenplay',
  'best writing, original screenplay': 'Best Original Screenplay',
  'best writing, screenplay written directly for the screen': 'Best Original Screenplay',
  'best writing, story and screenplay written directly for the screen': 'Best Original Screenplay',
  'best writing, motion picture story': 'Best Original Screenplay',
  'best original story': 'Best Original Screenplay',
  'best writing, story and screenplay': 'Best Original Screenplay',
  'best adapted screenplay': 'Best Adapted Screenplay',
  'best writing, adapted screenplay': 'Best Adapted Screenplay',
  'best writing, screenplay based on material previously produced or published': 'Best Adapted Screenplay',
  'best writing, screenplay adapted from other material': 'Best Adapted Screenplay',
  'best writing, adaptation': 'Best Adapted Screenplay',
  'best cinematography': 'Best Cinematography',
  'best cinematography (color)': 'Best Cinematography', 'best cinematography (black-and-white)': 'Best Cinematography',
  'best cinematography, color': 'Best Cinematography', 'best cinematography, black-and-white': 'Best Cinematography',
  'best film editing': 'Best Film Editing', 'best editing': 'Best Film Editing',
  'best production design': 'Best Production Design', 'best art direction': 'Best Production Design',
  'best art direction-set decoration': 'Best Production Design',
  'best art direction-set decoration (color)': 'Best Production Design',
  'best art direction-set decoration (black-and-white)': 'Best Production Design',
  'best art direction, color': 'Best Production Design', 'best art direction, black and white': 'Best Production Design',
  'best costume design': 'Best Costume Design',
  'best costume design (color)': 'Best Costume Design', 'best costume design (black-and-white)': 'Best Costume Design',
  'best costume design, black-and-white': 'Best Costume Design',
  'best makeup and hairstyling': 'Best Makeup and Hairstyling', 'best makeup': 'Best Makeup and Hairstyling',
  'best original score': 'Best Original Score', 'best original dramatic score': 'Best Original Score',
  'best original dramatic or comedy score': 'Best Original Score',
  'best original musical or comedy score': 'Best Original Score',
  'best original score, no musical': 'Best Original Score', 'best score': 'Best Original Score',
  'best score, adaptation or treatment': 'Best Original Score',
  'best scoring: substantially original': 'Best Original Score',
  'best scoring: adaptation or treatment': 'Best Original Score',
  'best original song': 'Best Original Song',
  'best original song score': 'Best Original Song Score',
  'best original song score or adaptation score': 'Best Original Song Score',
  'best sound': 'Best Sound',
  'best sound editing': 'Best Sound Editing',
  'best sound mixing': 'Best Sound Mixing',
  'best sound effects editing': 'Best Sound Editing',
  'best visual effects': 'Best Visual Effects', 'best special effects': 'Best Visual Effects',
  'best special visual effects': 'Best Visual Effects',
  // ⚠️ canonical names below carry the " Film" suffix to match oscar_categories rows
  // exactly (2026-07-12 fix — the suffixless variants never matched the DB, so these
  // categories silently skipped auto-fill).
  'best animated feature film': 'Best Animated Feature Film', 'best animated feature': 'Best Animated Feature Film',
  'best animated short film': 'Best Animated Short Film', 'best animated short': 'Best Animated Short Film',
  'best documentary feature': 'Best Documentary Feature Film', 'best documentary feature film': 'Best Documentary Feature Film',
  'best feature documentary': 'Best Documentary Feature Film',
  'best documentary short film': 'Best Documentary Short Film', 'best documentary short subject': 'Best Documentary Short Film',
  'best documentary (short subject)': 'Best Documentary Short Film',
  'best documentary short': 'Best Documentary Short Film', 'best documentary': 'Best Documentary Feature Film',
  'best live action short film': 'Best Live Action Short Film', 'best live action short': 'Best Live Action Short Film',
  'best short film, live action': 'Best Live Action Short Film', 'best short subject, live action': 'Best Live Action Short Film',
  'best international feature film': 'Best International Feature Film',
  'best international feature': 'Best International Feature Film',
  'best foreign language film': 'Best International Feature Film',
  'best casting': 'Best Casting', 'achievement in casting': 'Best Casting',
  'special achievement academy award': 'Special Achievement Award', 'honorary award': 'Honorary Award',
}

export const PERSON_CATEGORIES = new Set([
  'Best Actor', 'Best Actress', 'Best Supporting Actor', 'Best Supporting Actress', 'Best Director',
])

export const ACTING_CATEGORIES = new Set([
  'Best Actor', 'Best Actress', 'Best Supporting Actor', 'Best Supporting Actress',
])

export function extractQid(uri) {
  if (!uri) return ''
  const m = uri.match(/(Q\d+)$/)
  return m ? m[1] : ''
}

export function normalizeCategory(rawLabel, awardUri = '', ceremonyYear = null) {
  const qid = extractQid(awardUri)
  let canon = null
  if (qid && QID_OVERRIDE[qid]) canon = QID_OVERRIDE[qid]
  if (!canon) {
    const s = rawLabel.trim()
    canon = CATEGORY_NORM[s.toLowerCase()] || null
    if (!canon) {
      let trimmed = s
      for (const prefix of ['Academy Award for Best ', 'Academy Award for ']) {
        if (s.toLowerCase().startsWith(prefix.toLowerCase())) { trimmed = s.slice(prefix.length); break }
      }
      const key = trimmed.toLowerCase()
      canon = CATEGORY_NORM[key] || CATEGORY_NORM['best ' + key] || null
    }
  }
  // Wikidata labels the pre-2021 mixing award plainly "Best Sound" — the split
  // categories existed through the 2020 ceremony (year-aware, 2026-07-12).
  if (canon === 'Best Sound' && ceremonyYear && ceremonyYear <= 2020) return 'Best Sound Mixing'
  return canon
}

// ── Wikidata nominee fetch (Phase 13c — moved from OscarsNewYear so the
//    New Year wizard and the year page's re-fetch/merge share ONE query) ──────
const WIKIDATA_URL = 'https://query.wikidata.org/sparql'

/**
 * All nominees for a ceremony year, keyed by canonical category name.
 *
 * 2026-07-12 rewrite:
 * - Wikidata retired the old ceremony class QID (Q4688419) — ceremonies are now
 *   instances of Q16913666. We match BOTH so this survives another migration.
 * - The nomination statement's P1686 ("for work") qualifier is captured: it gives
 *   the film for person nominations and the song title for Best Original Song
 *   (whose statements sit on the songwriters, not the song).
 * - Person categories keep the person as nominee; song category uses the song
 *   title; film categories use the work when the statement sits on a person.
 *
 * Returns { [canonicalCategory]: [names…] }.
 * Pass { withFilms: true } to instead get { byCat, films } where films maps
 * `${canonicalCategory}|${name}` → film title (null when Wikidata doesn't know).
 */
export async function fetchWikidataNominees(ceremonyYear, { withFilms = false } = {}) {
  const sparql = `
SELECT ?entityLabel ?awardUri ?awardLabel ?workLabel WHERE {
  VALUES ?ceremonyClass { wd:Q16913666 wd:Q4688419 }
  ?ceremony wdt:P31 ?ceremonyClass .
  ?ceremony wdt:P585 ?date .
  FILTER(YEAR(?date) = ${ceremonyYear})

  {
    ?entity p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    ?stmt pq:P805 ?ceremony .
  } UNION {
    ?entity p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    ?stmt pq:P805 ?ceremony .
  }

  BIND(str(?award) AS ?awardUri)
  OPTIONAL { ?stmt pq:P1686 ?work . }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
    ?entity rdfs:label ?entityLabel .
    ?work rdfs:label ?workLabel .
  }
}
ORDER BY ?awardLabel ?entityLabel
`
  const url  = `${WIKIDATA_URL}?query=${encodeURIComponent(sparql)}&format=json`
  const resp = await fetch(url, {
    headers: {
      'Accept':     'application/sparql-results+json',
      'User-Agent': 'HermzAndDMoviesApp/2.0 (film ranking app; contact: bard37@gmail.com)',
    },
  })
  if (!resp.ok) throw new Error(`Wikidata ${resp.status}: ${resp.statusText}`)
  const data = await resp.json()
  const results = {}
  const films = {}
  for (const b of (data?.results?.bindings || [])) {
    const entityLabel = b.entityLabel?.value || ''
    const awardLabel  = b.awardLabel?.value  || ''
    const awardUri    = b.awardUri?.value    || ''
    const workLabel   = b.workLabel?.value   || ''
    if (!entityLabel || /^Q\d+$/.test(entityLabel)) continue
    const canon = normalizeCategory(awardLabel, awardUri, ceremonyYear)
    if (!canon) continue

    let nominee = entityLabel
    let film = null
    if (canon === 'Best Original Song') {
      if (!workLabel) continue           // songwriter row without the song — useless alone
      nominee = workLabel                // the song is the nominee
    } else if (PERSON_CATEGORIES.has(canon)) {
      film = workLabel || null           // person nominee, film from the qualifier
    } else {
      // film categories: statements on the film give the film directly; statements
      // on craftspeople carry the film in the work qualifier
      if (workLabel) { nominee = workLabel }
      film = nominee
    }

    if (!results[canon]) results[canon] = new Set()
    results[canon].add(nominee)
    const key = `${canon}|${nominee}`
    if (film && !films[key]) films[key] = film
  }
  const byCat = Object.fromEntries(
    Object.entries(results).map(([cat, names]) => [cat, [...names].sort()])
  )
  return withFilms ? { byCat, films } : byCat
}
