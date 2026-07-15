// src/lib/oscarSeason.js
// SINGLE SOURCE for the Oscar-season workflow (Phase 13):
// year status machine, category grouping, and interval (runtime/monologue) helpers.
// Consumers: OscarsBallot, OscarsYear, OscarsHome, OscarsStats, OscarsReveal,
// OscarsCategories, Navbar. Edit HERE, never inline.

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

// ── Category groups (2026-07-15 — now DATA, not a hardcoded map) ─────────────
// The group lives on the `oscar_categories` row (`group_name` + `group_order`,
// migration `oscar_category_groups`), NOT in a name→group object here. The old
// map was duplicated in this file and OscarsStats.jsx, and fell back to 'Craft'
// for anything unmapped — so a new category got grouped by accident.
//
//   1 Major Awards       (8) Picture · Director · 4 acting · 2 screenplay
//   2 Specialty Features (3) Animated · International · Documentary Feature
//   3 Craft              (7) Prod Design · Cinematography · Costume · Editing
//                            · Makeup & Hair · VFX · Casting
//   4 Music & Sound      (5) Score · Song · Sound (+ retired Sound Editing/Mixing)
//   5 Shorts             (3) Animated · Documentary · Live Action
//
// ⚠️ ERA IS NOT A GROUPING AXIS. Retired categories keep their real group; the
// "retired" state is read off active_until. (The old scheme had a 'Discontinued'
// group holding Sound Editing/Mixing while Best Sound sat under Music — the same
// craft split in two by date, which made sound unanalysable across the 19 years.)
//
// Adding a category? Set its group in the /oscars/categories admin. The DB has a
// NOT NULL + CHECK constraint, so there is no silent fallback any more.

/** The five groups, in display order. Mirrors the CHECK on oscar_categories. */
export const GROUP_ORDER = [
  'Major Awards',
  'Specialty Features',
  'Craft',
  'Music & Sound',
  'Shorts',
]

/** Accent colour per group — stats heatmap, ownership grid, legends. */
export const GROUP_COLOR = {
  'Major Awards':       '#a78bfa',
  'Specialty Features': '#4ade80',
  'Craft':              '#60a5fa',
  'Music & Sound':      '#fb923c',
  'Shorts':             '#94a3b8',
}

/** Group of a category ROW (accepts a raw row or a `{ category }` wrapper). */
export function groupOf(cat) {
  const c = cat?.group_name ? cat : cat?.category
  return c?.group_name ?? null
}

/** True once a category has been retired (Sound Editing/Mixing after 2020). */
export function isRetired(cat, year) {
  const c = cat?.category ?? cat
  if (!c?.active_until) return false
  return year == null ? true : year > c.active_until
}

/**
 * Bucket category rows into ordered groups, dropping empties.
 * `pick` maps an item to its category row when items are wrappers.
 * Returns [{ name, order, cats }] sorted by group_order.
 */
export function groupCategories(items, pick = x => x) {
  const buckets = new Map()
  for (const item of items) {
    const cat = pick(item)
    const name = groupOf(cat)
    if (!name) continue
    if (!buckets.has(name)) {
      buckets.set(name, { name, order: cat.group_order ?? 99, cats: [] })
    }
    buckets.get(name).cats.push(item)
  }
  return [...buckets.values()].sort((a, b) => a.order - b.order)
}

// ── Reveal ceremony order (Phase 13d — approved 2026-07-11) ──────────────────
// "Build to Best Picture": shorts/craft first, prestige last. Groups run in
// REVERSE group_order; within a group, reverse display_order. Director is always
// second-to-last, Best Picture last. With the 5-group scheme the build reads:
// Shorts → Music & Sound → Craft → Specialty Features → Major Awards,
// and inside Major: Adapted → Original → Supp Actress → Supp Actor → Actress
// → Actor → Director → Picture.
export function revealSequence(categories) {
  const special = { 'Best Picture': 2, 'Best Director': 1 }
  return [...categories].sort((a, b) => {
    const catA = a.category ?? a
    const catB = b.category ?? b
    const sA = special[catA.name] || 0
    const sB = special[catB.name] || 0
    if (sA !== sB) return sA - sB
    const gA = catA.group_order ?? 99
    const gB = catB.group_order ?? 99
    if (gA !== gB) return gB - gA          // reverse group order
    return (catB.display_order ?? 0) - (catA.display_order ?? 0)
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
