// acclaimLists.js — SINGLE SOURCE for external-list ("acclaim") membership.
//
// External-list membership lives in ONE place: the `external_list_entries` table
// (also what /movies/lists reads). The `films` table still has legacy denormalized
// columns (afi_top100_rank, national_film_registry, …) but they are DERIVED and must
// not be trusted — they drift the moment a list is edited or re-imported.
//
// Any page that shows which lists a film is on hydrates those fields at read time
// via hydrateAcclaim(), so the UI always reflects external_list_entries and can
// never drift again. Consumers keep their existing render code (which reads the
// column keys) — the values just come from here now.

import { supabase } from './supabase'

// list_name (in external_list_entries) → legacy film column the UI reads
export const LIST_TO_COLUMN = {
  afi_top100:       'afi_top100_rank',
  afi_comedies:     'afi_comedies_rank',
  imdb_top250:      'imdb_top250_rank',
  nyt_2000s:        'nyt_2000s_rank',
  sight_sound:      'sight_sound_2022_rank',
  variety_comedies: 'variety_comedies_rank',
  nfr:              'national_film_registry', // boolean (unranked)
}

const ACCLAIM_COLUMNS = Object.values(LIST_TO_COLUMN)

// Build { [film_id]: { column: value } } from external_list_entries for the given
// film ids. Paged — external_list_entries is ~1,600 rows and Supabase silently caps
// a single read at 1,000 (see reference.md).
async function acclaimFieldsForFilms(filmIds) {
  const out = {}
  if (!filmIds || filmIds.length === 0) return out
  const PAGE = 1000
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('external_list_entries')
      .select('film_id, list_name, rank')
      .in('film_id', filmIds)
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data || []) {
      const col = LIST_TO_COLUMN[r.list_name]
      if (!col || r.film_id == null) continue
      if (!out[r.film_id]) out[r.film_id] = {}
      out[r.film_id][col] = r.list_name === 'nfr' ? true : r.rank
    }
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return out
}

// Overwrite the acclaim/list fields on a film (or array of films) from
// external_list_entries — zeroing first so stale stored values never leak.
// Accepts and returns either a single film object or an array, matching input.
export async function hydrateAcclaim(input) {
  if (!input) return input
  const isArray = Array.isArray(input)
  const films = isArray ? input : [input]
  const ids = films.map(f => f?.id).filter(Boolean)
  const map = await acclaimFieldsForFilms(ids)

  const zero = {}
  for (const c of ACCLAIM_COLUMNS) zero[c] = c === 'national_film_registry' ? false : null

  const hydrated = films.map(f => (f ? { ...f, ...zero, ...(map[f.id] || {}) } : f))
  return isArray ? hydrated : hydrated[0]
}
