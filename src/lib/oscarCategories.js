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
  'best animated feature film': 'Best Animated Feature', 'best animated feature': 'Best Animated Feature',
  'best animated short film': 'Best Animated Short', 'best animated short': 'Best Animated Short',
  'best documentary feature': 'Best Documentary Feature', 'best documentary feature film': 'Best Documentary Feature',
  'best feature documentary': 'Best Documentary Feature',
  'best documentary short film': 'Best Documentary Short', 'best documentary short subject': 'Best Documentary Short',
  'best documentary short': 'Best Documentary Short', 'best documentary': 'Best Documentary Feature',
  'best live action short film': 'Best Live Action Short', 'best live action short': 'Best Live Action Short',
  'best short film, live action': 'Best Live Action Short', 'best short subject, live action': 'Best Live Action Short',
  'best international feature film': 'Best International Feature Film',
  'best international feature': 'Best International Feature Film',
  'best foreign language film': 'Best International Feature Film',
  'special achievement academy award': 'Special Achievement Award', 'honorary award': 'Honorary Award',
}

export const ACTING_CATEGORIES = new Set([
  'Best Actor', 'Best Actress', 'Best Supporting Actor', 'Best Supporting Actress',
])

export function extractQid(uri) {
  if (!uri) return ''
  const m = uri.match(/(Q\d+)$/)
  return m ? m[1] : ''
}

export function normalizeCategory(rawLabel, awardUri = '') {
  const qid = extractQid(awardUri)
  if (qid && QID_OVERRIDE[qid]) return QID_OVERRIDE[qid]
  const s = rawLabel.trim()
  if (CATEGORY_NORM[s.toLowerCase()]) return CATEGORY_NORM[s.toLowerCase()]
  let trimmed = s
  for (const prefix of ['Academy Award for Best ', 'Academy Award for ']) {
    if (s.toLowerCase().startsWith(prefix.toLowerCase())) { trimmed = s.slice(prefix.length); break }
  }
  const key = trimmed.toLowerCase()
  if (CATEGORY_NORM[key]) return CATEGORY_NORM[key]
  if (CATEGORY_NORM['best ' + key]) return CATEGORY_NORM['best ' + key]
  return null
}
