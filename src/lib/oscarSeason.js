// src/lib/oscarSeason.js
// SINGLE SOURCE for the Oscar-season workflow (Phase 13):
// year status machine, category grouping, and interval (runtime/monologue) helpers.
// Consumers: OscarsBallot, OscarsYear, OscarsHome, Navbar. Edit HERE, never inline.

// ── Year lifecycle ───────────────────────────────────────────────────────────
// upcoming → ballots → locked → revealed → complete
export const OSCAR_STATUS_META = {
  upcoming: { label: 'Setting Up',     chip: 'text-gray-400 bg-gray-500/10 border-gray-500/40' },
  ballots:  { label: 'Ballots Open',   chip: 'text-cinema-400 bg-cinema-500/10 border-cinema-500/40' },
  locked:   { label: 'Ballots Locked', chip: 'text-gold-400 bg-gold-500/10 border-gold-500/40' },
  revealed: { label: 'Revealed',       chip: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40' },
  complete: { label: 'Complete',       chip: 'text-gray-400 bg-gray-500/10 border-gray-500/40' },
}

/** Guesses are public (visible to both players + logged-out) once revealed. */
export function isRevealed(status) {
  return status === 'revealed' || status === 'complete'
}

// ── Category groups (moved from OscarsYear 2026-07-11 — OscarsStats still has
//    a local copy; consolidate when MoviesStats-style split happens) ──────────
export const CAT_GROUP = {
  'Best Picture':                    'Major',
  'Best Director':                   'Major',
  'Best Animated Feature Film':      'Major',
  'Best International Feature Film': 'Major',
  'Best Documentary Feature Film':   'Major',
  'Best Actor':                      'Acting',
  'Best Actress':                    'Acting',
  'Best Supporting Actor':           'Acting',
  'Best Supporting Actress':         'Acting',
  'Best Original Screenplay':        'Writing',
  'Best Adapted Screenplay':         'Writing',
  'Best Production Design':          'Craft',
  'Best Cinematography':             'Craft',
  'Best Costume Design':             'Craft',
  'Best Film Editing':               'Craft',
  'Best Makeup and Hairstyling':     'Craft',
  'Best Visual Effects':             'Craft',
  'Best Casting':                    'Craft',
  'Best Original Score':             'Music',
  'Best Original Song':              'Music',
  'Best Sound':                      'Music',
  'Best Animated Short Film':        'Shorts',
  'Best Documentary Short Film':     'Shorts',
  'Best Live Action Short Film':     'Shorts',
  'Best Sound Editing':              'Sound',
  'Best Sound Mixing':               'Sound',
}
export const GROUP_META = {
  Major:   'Major Awards',
  Acting:  'Acting',
  Writing: 'Writing',
  Craft:   'Craft',
  Music:   'Music & Sound',
  Shorts:  'Short Films',
  Sound:   'Discontinued',
}
export const GROUP_ORDER = ['Major', 'Acting', 'Writing', 'Craft', 'Music', 'Shorts', 'Sound']
export function groupOf(name) { return CAT_GROUP[name] || 'Craft' }

// ── Reveal ceremony order (Phase 13d — approved 2026-07-11) ──────────────────
// "Build to Best Picture": shorts/craft first, prestige last. Within a group,
// reverse display_order. Director is always second-to-last, Best Picture last.
const REVEAL_GROUP_ORDER = ['Sound', 'Shorts', 'Music', 'Craft', 'Writing', 'Acting', 'Major']
export function revealSequence(categories) {
  const special = { 'Best Picture': 2, 'Best Director': 1 }
  return [...categories].sort((a, b) => {
    const nameA = a.name ?? a.category?.name
    const nameB = b.name ?? b.category?.name
    const sA = special[nameA] || 0
    const sB = special[nameB] || 0
    if (sA !== sB) return sA - sB
    const gA = REVEAL_GROUP_ORDER.indexOf(groupOf(nameA))
    const gB = REVEAL_GROUP_ORDER.indexOf(groupOf(nameB))
    if (gA !== gB) return gA - gB
    const oA = a.display_order ?? a.category?.display_order ?? 0
    const oB = b.display_order ?? b.category?.display_order ?? 0
    return oB - oA
  })
}

// ── Interval helpers (Postgres interval strings ↔ display/input) ────────────
export function parseInterval(str) {
  if (!str) return null
  const parts = String(str).split(':')
  if (parts.length < 2) return null
  return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10), s: parseInt(parts[2] || 0, 10) }
}
export function fmtRuntime(str)   { const t = parseInterval(str); return t ? `${t.h}h ${t.m}m` : '—' }
export function fmtMonologue(str) {
  const t = parseInterval(str); if (!t) return '—'
  return t.h > 0 ? `${t.h}h ${t.m}m ${t.s}s` : `${t.m}m ${t.s}s`
}
/** "3:22" (H:MM) → "3:22:00" interval; passthrough otherwise */
export function toRuntimeInterval(s) {
  if (!s || !s.trim()) return null
  const p = s.trim().split(':')
  return p.length === 2 ? `${p[0]}:${p[1]}:00` : s.trim()
}
/** "12:30" (M:SS) → "0:12:30" interval; passthrough otherwise */
export function toMonologueInterval(s) {
  if (!s || !s.trim()) return null
  const p = s.trim().split(':')
  return p.length === 2 ? `0:${p[0]}:${p[1]}` : s.trim()
}
/** interval → "H:MM" input value */
export function runtimeInputValue(str) {
  const t = parseInterval(str)
  return t ? `${t.h}:${String(t.m).padStart(2, '0')}` : ''
}
/** interval → "M:SS" input value */
export function monologueInputValue(str) {
  const t = parseInterval(str)
  return t ? `${t.h * 60 + t.m}:${String(t.s).padStart(2, '0')}` : ''
}
