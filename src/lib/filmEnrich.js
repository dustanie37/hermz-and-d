// filmEnrich.js — Shared film creation + enrichment pipeline (Phase 12a, 2026-07-09)
//
// Single source of truth for:
//   • Wikidata SPARQL fetch + film-page query + row dedup (processRows) —
//     MOVED here from MoviesOscarBackfill.jsx, which now imports them.
//     The dedup logic carries the 2026-07 phantom-nomination bug fix — edit it
//     HERE only, never inline in a page.
//   • createAndEnrichFilm(imdbId) — the "no backfill debt" add-film path used by
//     pool building (12a): OMDB core fields → TMDb full cast → Wikidata Oscar noms
//     (+ competitive counts and won_* flags on films).

import { supabase } from './supabase'
import { fetchFilmById } from './omdb'
import { enrichFilmCast } from './tmdb'
import { ACTING_CATEGORIES, normalizeCategory } from './oscarCategories'

const WIKIDATA_URL = 'https://query.wikidata.org/sparql'

// ── Wikidata: film-page query ─────────────────────────────────────────────────

export function buildFilmPageQuery(imdbIds) {
  const values = imdbIds.map(id => `"${id}"`).join(' ')
  return `
SELECT ?imdbId ?awardUri ?awardLabel ?won ?year ?nomineeName WHERE {
  VALUES ?imdbId { ${values} }
  ?film wdt:P345 ?imdbId .
  {
    ?film p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    BIND(true AS ?won)
  } UNION {
    ?film p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    BIND(false AS ?won)
  }
  ?award wdt:P31 wd:Q19020 .
  BIND(str(?award) AS ?awardUri)
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
  }
  OPTIONAL {
    ?stmt pq:P585 ?date .
    BIND(YEAR(?date) AS ?year)
  }
  OPTIONAL {
    ?stmt pq:P1706 ?nomineeEntity .
    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "en" .
      ?nomineeEntity rdfs:label ?nomineeName .
    }
  }
}
`
}

export async function queryWikidata(sparql) {
  const url  = `${WIKIDATA_URL}?query=${encodeURIComponent(sparql)}&format=json`
  const resp = await fetch(url, {
    headers: {
      'Accept':     'application/sparql-results+json',
      'User-Agent': 'HermzAndDMoviesApp/2.0 (film ranking app; contact: bard37@gmail.com)',
    },
  })
  if (!resp.ok) throw new Error(`Wikidata ${resp.status} — ${resp.statusText}`)
  const data = await resp.json()
  return data?.results?.bindings || []
}

export function parseFilmPageBindings(bindings) {
  return bindings.map(b => ({
    imdbId:      b.imdbId?.value      || '',
    awardUri:    b.awardUri?.value    || '',
    awardLabel:  b.awardLabel?.value  || '',
    won:         b.won?.value === 'true',
    year:        b.year ? parseInt(b.year.value) : null,
    nomineeName: b.nomineeName?.value || null,
  }))
}

// ── Row dedup (phantom-nomination fix lives here) ─────────────────────────────

export function processRows(rows, imdbIdKey = 'imdbId', nomineeKey = 'nomineeName') {
  const seenActing = new Set()
  const seenOther  = new Set()
  const result     = []

  for (const row of rows) {
    const rawLabel    = row.awardLabel   || ''
    const awardUri    = row.awardUri     || ''
    const nomineeName = row[nomineeKey]  || null
    const canon       = normalizeCategory(rawLabel, awardUri)
    if (!canon) continue
    const won  = row.won === true || row.won === 'true'
    const year = row.year != null ? parseInt(row.year) : null

    if (ACTING_CATEGORIES.has(canon) && nomineeName) {
      // Named acting rows: different people may hold a win and a nomination in the
      // same category (e.g. Amadeus — Abraham won, Hulce nominated). Keep separately.
      const key = `${canon}|${year}|${nomineeName}|${won}`
      if (!seenActing.has(key)) { seenActing.add(key); result.push({ category_name: canon, is_winner: won, ceremony_year: year, nominee_name: nomineeName }) }
    } else {
      // Unnamed rows (acting included): Wikidata film pages often carry BOTH a
      // "nominated for" and an "award received" statement for the SAME winner.
      // Keeping both created phantom extra nominations (2026-07 bug fix) —
      // collapse to a single row where a win beats a nomination.
      const key = `${canon}|${year}|${nomineeName}`
      if (seenOther.has(key)) {
        if (won) {
          const idx = result.findIndex(r => r.category_name === canon && r.ceremony_year === year && r.nominee_name === nomineeName)
          if (idx >= 0) result[idx].is_winner = true
        }
      } else {
        seenOther.add(key)
        result.push({ category_name: canon, is_winner: won, ceremony_year: year, nominee_name: nomineeName })
      }
    }
  }
  return result
}

// ── Full add-film pipeline ────────────────────────────────────────────────────

// Convention (reference.md): films.oscar_nominations / oscar_wins count
// COMPETITIVE categories only — Special Achievement + Honorary rows are
// display-only in film_oscar_noms.
const NON_COMPETITIVE = new Set(['Special Achievement Award', 'Honorary Award'])

const WON_FLAG_COLUMNS = {
  'Best Picture':             'won_best_picture',
  'Best Director':            'won_best_director',
  'Best Actor':               'won_best_actor',
  'Best Actress':             'won_best_actress',
  'Best Supporting Actor':    'won_best_supp_actor',
  'Best Supporting Actress':  'won_best_supp_actress',
  'Best Original Screenplay': 'won_screenplay',
  'Best Adapted Screenplay':  'won_screenplay',
  'Best Cinematography':      'won_cinematography',
  'Best Production Design':   'won_production_design',
}

/**
 * Create a film from an IMDb ID and enrich it fully, so pool adds carry no
 * backfill debt. Steps: OMDB (required) → TMDb cast (best-effort) → Wikidata
 * Oscar noms + counts (best-effort). Returns
 * { filmId, created, castEnriched, oscarNoms, warnings[] }.
 * If the film already exists (by omdb_id), returns it untouched.
 */
export async function createAndEnrichFilm(imdbId) {
  // 0. Already in the database?
  const { data: existing } = await supabase
    .from('films').select('id').eq('omdb_id', imdbId).maybeSingle()
  if (existing) return { filmId: existing.id, created: false, castEnriched: false, oscarNoms: 0, warnings: [] }

  // 1. OMDB core fields — required; throws on failure
  const omdb = await fetchFilmById(imdbId)
  const row = {
    title:           omdb.title,
    release_year:    omdb.year,
    director:        omdb.director,
    omdb_id:         omdb.omdbId,
    poster_url:      omdb.posterUrl,
    omdb_genres:     omdb.genres,
    omdb_fetched_at: new Date().toISOString(),
  }
  omdb.actors.forEach((a, i) => { row[`actor_${i + 1}`] = a })

  const { data: inserted, error: insertErr } = await supabase
    .from('films').insert(row).select('id').single()
  if (insertErr) throw new Error(`Could not save film: ${insertErr.message}`)
  const filmId = inserted.id
  const result = { filmId, created: true, castEnriched: false, oscarNoms: 0, warnings: [] }

  // 2. TMDb full cast — best-effort
  try {
    const { cast } = await enrichFilmCast({ omdb_id: imdbId, title: omdb.title, release_year: omdb.year })
    if (cast.length) {
      const update = {}
      cast.forEach((a, i) => { update[`actor_${i + 1}`] = a })
      const { error } = await supabase.from('films').update(update).eq('id', filmId)
      if (error) throw error
      result.castEnriched = true
    }
  } catch (err) {
    result.warnings.push(`TMDb cast: ${err.message}`)
  }

  // 3. Wikidata Oscar noms — best-effort
  try {
    const bindings = await queryWikidata(buildFilmPageQuery([imdbId]))
    const noms = processRows(parseFilmPageBindings(bindings))
    if (noms.length) {
      const { error: nomErr } = await supabase.from('film_oscar_noms').upsert(
        noms.map(n => ({ film_id: filmId, ...n })),
        { ignoreDuplicates: true },
      )
      if (nomErr) throw nomErr

      const competitive = noms.filter(n => !NON_COMPETITIVE.has(n.category_name))
      const update = {
        oscar_nominations: competitive.length,
        oscar_wins:        competitive.filter(n => n.is_winner).length,
      }
      for (const n of competitive) {
        if (n.is_winner && WON_FLAG_COLUMNS[n.category_name]) update[WON_FLAG_COLUMNS[n.category_name]] = true
      }
      const { error: cntErr } = await supabase.from('films').update(update).eq('id', filmId)
      if (cntErr) throw cntErr
      result.oscarNoms = noms.length
    }
  } catch (err) {
    result.warnings.push(`Oscar noms: ${err.message}`)
  }

  return result
}
