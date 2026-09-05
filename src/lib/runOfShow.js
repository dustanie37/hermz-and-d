// ── Run of Show — SINGLE SOURCE for the episode prep structure ──────────────
// Every film episode follows the same six segments. Notes, questions and the
// chosen recurring features live in `podcast_episodes.run_of_show` (jsonb);
// free-text film context lives in `podcast_episodes.snapshot` (jsonb).
// Shape is documented in `emptyRunOfShow()` below — change it here only.

import { DC, HC } from './helpers'

export const SEGMENTS = [
  {
    key: 'cold_open', n: 1, name: 'Cold Open',
    aim:  'Energetic, personable opening',
    hint: 'A bold opinion, a memory, a playful disagreement, or a provocative question.',
  },
  {
    key: 'intro', n: 2, name: 'Show Intro',
    aim:  'Restate the premise for new ears',
    hint: 'Show name, the shared list premise in a sentence, and today\'s film.',
  },
  {
    key: 'snapshot', n: 3, name: 'Film Snapshot',
    aim:  'Essential context, not a plot-summary show',
    hint: 'Year, director, writer, cast, plot in a breath, place in film history, superlatives, behind-the-scenes. Short audio clip.',
  },
  {
    key: 'discussion', n: 4, name: 'Main Discussion',
    aim:  'Why it works, why it matters, why this rank',
    hint: 'Strongest qualities, signature scenes, emotional pull. Scores, where you align and split, standout categories. First viewing, how it aged.',
  },
  {
    key: 'feature', n: 5, name: 'Recurring Feature',
    aim:  'A repeatable segment that gives the show identity',
    hint: 'Pick one or more from the library for this episode.',
  },
  {
    key: 'outro', n: 6, name: 'Outro',
    aim:  'Wrap cleanly, point forward',
    hint: 'One-sentence takeaway, a tease for next week, the subscribe/review call.',
  },
]

export const SEGMENT_BY_KEY = Object.fromEntries(SEGMENTS.map(s => [s.key, s]))

// Who carries a note. `both` is the default — most beats are shared.
export const OWNERS = {
  D:    { label: 'D',   title: 'Dust',   color: DC },
  M:    { label: 'M',   title: 'Hermz',  color: HC },
  both: { label: 'D+M', title: 'Both',   color: '#9ca3af' },
}
export const OWNER_CYCLE = ['both', 'D', 'M']

// Free-text film context. Facts that live in the database (year, director,
// writer, cast, Oscars, lists) are shown automatically and are NOT repeated here.
export const SNAPSHOT_FIELDS = [
  { key: 'plot',         label: 'Plot snapshot',          rows: 4, placeholder: 'The story in a breath — what happens, what it\'s really about.' },
  { key: 'history',      label: 'Place in film history',  rows: 3, placeholder: 'Why it matters to the medium. Debut? Milestone? Turning point?' },
  { key: 'superlatives', label: 'Superlatives',           rows: 3, placeholder: 'AFI ranks, registry, "best of" placements, records.' },
  { key: 'bts',          label: 'Behind the scenes',      rows: 4, placeholder: 'Production facts, budget, deferred salaries, casting stories.' },
  { key: 'clip',         label: 'Audio clip',             rows: 1, placeholder: 'Which moment to play, and where it sits in the film.' },
]

function uid(prefix) {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** A note or a question inside a segment. kind: 'note' | 'question'. */
export function newNote(text, { owner = 'both', kind = 'note', source = 'manual' } = {}) {
  return { id: uid('n'), text, owner, kind, done: false, source }
}

/** Blank run of show. Keys here are the contract for every reader. */
export function emptyRunOfShow() {
  return {
    hook: '',
    target_runtime: 45,
    segments: Object.fromEntries(SEGMENTS.map(s => [s.key, { notes: [] }])),
    features: [],   // [{ feature_id, notes: [] }]
  }
}

/**
 * Read a stored run_of_show defensively. A null row (episode prepped before
 * this existed) is built fresh; any legacy talking points land in Main
 * Discussion so nothing typed is lost.
 */
export function normalizeRunOfShow(stored, talkingPoints) {
  const base = emptyRunOfShow()
  if (!stored || typeof stored !== 'object') {
    const pts = Array.isArray(talkingPoints) ? talkingPoints : []
    base.segments.discussion.notes = pts.map(p => ({
      ...newNote(p.text, { source: p.source || 'manual' }), done: !!p.done,
    }))
    return base
  }
  const ros = { ...base, ...stored }
  ros.segments = { ...base.segments }
  for (const s of SEGMENTS) {
    const seg = stored.segments?.[s.key]
    ros.segments[s.key] = { notes: Array.isArray(seg?.notes) ? seg.notes : [] }
  }
  ros.features = Array.isArray(stored.features)
    ? stored.features.map(f => ({ feature_id: f.feature_id, notes: Array.isArray(f.notes) ? f.notes : [] }))
    : []
  return ros
}

/** Every note in the episode, flattened — used for progress + dedup. */
export function allNotes(ros) {
  if (!ros) return []
  const seg = SEGMENTS.flatMap(s => ros.segments?.[s.key]?.notes || [])
  const feat = (ros.features || []).flatMap(f => f.notes || [])
  return [...seg, ...feat]
}
