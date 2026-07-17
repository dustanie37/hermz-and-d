// eventScoring.js — Phase 12e: SINGLE SOURCE for event-score math
//
// Extracted from MoviesScore.jsx so the personal-stats page (12e), the reveal
// ceremony (12f), and publish (12g) all rank with identical rules.
// Canon tiebreakers: total → Personal Impact → most 10s → most 9s → … → most 1s.

import { sortTitle } from './helpers'

// Display order (2026-07-16): Lead → Supporting → Direction → Screenplay →
// Cinematography → Production Design → Influence. (Acclaim + Personal Impact
// render after these.) Order is display-only; totals/completeness are unaffected.
export const MANUAL_CATS = [
  { key: 'score_lead_performance',  label: 'Lead Performance',       max: 10 },
  { key: 'score_supp_performance',  label: 'Supporting Performance', max: 10 },
  { key: 'score_direction',         label: 'Direction',              max: 10 },
  { key: 'score_screenplay',        label: 'Screenplay',             max: 10 },
  { key: 'score_cinematography',    label: 'Cinematography',         max: 10 },
  { key: 'score_production_design', label: 'Production Design',      max: 10 },
  { key: 'score_influence',         label: 'Influence',              max: 10 },
]
export const IMPACT = { key: 'score_personal_impact', label: 'Personal Impact', max: 20 }
export const TEN_FIELDS = [...MANUAL_CATS.map(c => c.key), 'score_acclaim']
export const ALL_REQUIRED = [...MANUAL_CATS.map(c => c.key), IMPACT.key]

export function totalOf(row) {
  return TEN_FIELDS.reduce((s, k) => s + (row[k] ?? 0), 0) + (row[IMPACT.key] ?? 0)
}

export function isComplete(row) {
  return ALL_REQUIRED.every(k => row[k] != null)
}

export function countOf(row, value) {
  return TEN_FIELDS.filter(k => row[k] === value).length
}

export function rankCompare(a, b) {
  const ta = totalOf(a), tb = totalOf(b)
  if (tb !== ta) return tb - ta
  if ((b[IMPACT.key] ?? 0) !== (a[IMPACT.key] ?? 0)) return (b[IMPACT.key] ?? 0) - (a[IMPACT.key] ?? 0)
  for (let v = 10; v >= 1; v--) {
    const ca = countOf(a, v), cb = countOf(b, v)
    if (cb !== ca) return cb - ca
  }
  return sortTitle(a.films?.title ?? '').localeCompare(sortTitle(b.films?.title ?? ''))
}

// Deterministic shuffle (mulberry32) — used once at queue generation;
// the stored queue_pos is what actually guarantees stability.
export function seededShuffle(arr, seed) {
  let a = seed >>> 0
  const rand = () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
