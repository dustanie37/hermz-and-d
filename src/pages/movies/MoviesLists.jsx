import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── list definitions ──────────────────────────────────────────────────────────

const LISTS = [
  { key: 'afi_top100',       label: 'AFI Top 100',       published: '2007',             ranked: true  },
  { key: 'afi_comedies',     label: 'AFI Comedies',      published: '2000',             ranked: true  },
  { key: 'imdb_top250',      label: 'IMDB Top 250',      published: 'December 31, 2025',ranked: true  },
  { key: 'nyt_2000s',        label: 'NYT Best of 2000s', published: 'June 23, 2025',    ranked: true  },
  { key: 'sight_sound',      label: 'Sight & Sound',     published: '2022',             ranked: true  },
  { key: 'variety_comedies', label: 'Variety Comedies',  published: '2026',             ranked: true  },
  { key: 'nfr',              label: 'National Film Registry', published: 'January 29, 2026', ranked: false },
]

const EVENTS = [2001, 2007, 2016, 2026]

// ── sub-components ────────────────────────────────────────────────────────────

function PosterThumb({ url, title }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div className="w-9 h-12 flex-shrink-0 rounded flex items-center justify-center
                      bg-stone-200 dark:bg-night-600 text-gray-400 text-lg">
        🎬
      </div>
    )
  }
  return (
    <img src={url} alt={title} onError={() => setErr(true)}
      className="w-9 h-12 object-cover rounded flex-shrink-0 shadow-sm" />
  )
}

function EventDots({ filmId, combMap }) {
  return (
    <div className="flex gap-1.5 items-center justify-center">
      {EVENTS.map(yr => {
        const rank = filmId != null ? combMap[filmId]?.[yr] : undefined
        const on   = rank != null
        return (
          <span
            key={yr}
            title={on ? `#${rank} combined in ${yr}` : `Not on ${yr} combined list`}
            className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
              on ? 'bg-film-500' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        )
      })}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesLists() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeKey = searchParams.get('list') || 'afi_top100'

  // All-list state (fetched once)
  const [combMap, setCombMap]       = useState({})
  const [combLoading, setCombLoading] = useState(true)

  // Per-tab state (re-fetched on tab change)
  const [entries, setEntries]       = useState([])
  const [tabLoading, setTabLoading] = useState(true)
  const [error, setError]           = useState(null)

  const [search, setSearch]       = useState('')
  const [inDbOnly, setInDbOnly]   = useState(false)

  // ── fetch combined rankings once (for dots) ──────────────────────────────
  useEffect(() => {
    async function fetchCombined() {
      const [
        { data: combinedData },
        { data: eventsData },
      ] = await Promise.all([
        supabase.from('combined_rankings').select('film_id, event_id, combined_rank'),
        supabase.from('ranking_events').select('id, year'),
      ])
      const eventYearMap = {}
      eventsData?.forEach(e => { eventYearMap[e.id] = e.year })
      const cm = {}
      combinedData?.forEach(r => {
        if (!cm[r.film_id]) cm[r.film_id] = {}
        cm[r.film_id][eventYearMap[r.event_id]] = r.combined_rank
      })
      setCombMap(cm)
      setCombLoading(false)
    }
    fetchCombined()
  }, [])

  // ── fetch entries for active tab ─────────────────────────────────────────
  useEffect(() => {
    setTabLoading(true)
    setError(null)
    setEntries([])

    async function fetchEntries() {
      const listConfig = LISTS.find(l => l.key === activeKey)
      const { data, error: err } = await supabase
        .from('external_list_entries')
        .select(`
          id, rank, title, year, imdb_id, film_id,
          films (id, title, release_year, director, poster_url, acclaim_score)
        `)
        .eq('list_name', activeKey)
        .order('rank', { ascending: true, nullsFirst: false })

      if (err) { setError(err.message); setTabLoading(false); return }

      // For unranked lists, sort alphabetically by title
      const sorted = listConfig?.ranked
        ? (data || [])
        : (data || []).sort((a, b) =>
            (a.films?.title || a.title).localeCompare(b.films?.title || b.title)
          )

      setEntries(sorted)
      setTabLoading(false)
    }
    fetchEntries()
  }, [activeKey])

  // ── search filter ─────────────────────────────────────────────────────────
  const displayEntries = useMemo(() => {
    let result = entries
    if (inDbOnly) result = result.filter(e => e.film_id != null)
    const q = search.trim().toLowerCase()
    if (!q) return result
    return result.filter(e => {
      const title    = (e.films?.title    || e.title    || '').toLowerCase()
      const director = (e.films?.director || '').toLowerCase()
      return title.includes(q) || director.includes(q)
    })
  }, [entries, search, inDbOnly])

  // ── header counts ─────────────────────────────────────────────────────────
  const inDbCount  = useMemo(() => entries.filter(e => e.film_id != null).length, [entries])
  const totalCount = entries.length

  const loading = combLoading || tabLoading

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/movies"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← Movies
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <h1 className="page-title text-2xl">External Lists</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Browse acclaimed external rankings and see how they overlap with our lists
      </p>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-stone-100 dark:bg-night-800 rounded-xl w-fit">
        {LISTS.map(l => (
          <button
            key={l.key}
            onClick={() => { setSearchParams({ list: l.key }); setSearch(''); setInDbOnly(false) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              l.key === activeKey
                ? 'bg-white dark:bg-night-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* List header + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="section-title text-lg mb-0">
            {LISTS.find(l => l.key === activeKey)?.label}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-0.5">
            Published {LISTS.find(l => l.key === activeKey)?.published}
          </p>
          {!loading && (
            <p className="text-sm text-gray-400">
              {search
                ? `${displayEntries.length} of ${totalCount} matching "${search}"`
                : (
                  <>
                    {totalCount} film{totalCount !== 1 ? 's' : ''}
                    <span className="mx-1.5 text-gray-300 dark:text-gray-700">·</span>
                    <span className="text-film-500 dark:text-film-400">{inDbCount} in our database</span>
                    {totalCount - inDbCount > 0 && (
                      <span className="text-gray-400 ml-1">
                        · {totalCount - inDbCount} not yet added
                      </span>
                    )}
                  </>
                )
              }
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInDbOnly(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex-shrink-0 ${
              inDbOnly
                ? 'bg-film-600 text-white border-film-600'
                : 'border-stone-300 text-gray-500 hover:border-gray-400 dark:border-night-600 dark:text-gray-400 dark:hover:border-gray-500'
            }`}
          >
            In our DB
          </button>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by title or director…"
              className="input text-sm py-1.5 pl-3 pr-8 w-52"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400
                           hover:text-gray-600 dark:hover:text-gray-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dot legend */}
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
        <div className="flex gap-1.5">
          {EVENTS.map(yr => (
            <span key={yr} className="w-2 h-2 rounded-full bg-film-500 inline-block" />
          ))}
        </div>
        <span>On our combined list: {EVENTS.map(yr => `'${String(yr).slice(2)}`).join(' · ')}</span>
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="py-16 flex items-center justify-center">
          <span className="text-gray-400 animate-pulse">Loading…</span>
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="card overflow-hidden p-0">
          {displayEntries.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {search ? `No films match "${search}".` : 'No entries for this list yet.'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-12 text-center">#</th>
                  <th className="table-header">Film</th>
                  <th className="table-header text-center w-16">Acclaim</th>
                  <th className="table-header text-center w-28">Our Lists</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, i) => {
                  const film    = entry.films   // null if not in our DB
                  const inDb    = film != null
                  const title   = film?.title    || entry.title
                  const year    = film?.release_year || entry.year
                  const director = film?.director || null

                  return (
                    <tr key={entry.id}
                      className={`table-row-hover ${!inDb ? 'opacity-70' : ''}`}
                    >
                      {/* Rank */}
                      <td className="table-cell text-center">
                        <span className="font-display font-bold text-gray-400 dark:text-gray-500 tabular-nums">
                          {entry.rank ?? i + 1}
                        </span>
                      </td>

                      {/* Film info */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <PosterThumb url={inDb ? film.poster_url : null} title={title} />
                          <div className="min-w-0">
                            {inDb ? (
                              <Link
                                to={`/movies/${film.id}`}
                                className="text-sm font-semibold text-gray-900 dark:text-white
                                           hover:text-film-600 dark:hover:text-film-400
                                           transition-colors leading-snug block truncate"
                              >
                                {title}
                              </Link>
                            ) : (
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-snug block truncate">
                                {title}
                              </span>
                            )}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {year}
                                {director && (
                                  <> · {director.split(',')[0].trim()}</>
                                )}
                              </span>
                              {!inDb && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full
                                                 bg-stone-200 dark:bg-night-700
                                                 text-gray-500 dark:text-gray-400
                                                 border border-stone-300 dark:border-night-600
                                                 leading-none">
                                  Not in our database
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Acclaim */}
                      <td className="table-cell text-center">
                        {inDb && film.acclaim_score != null ? (
                          <span className="font-bold text-gold-600 dark:text-gold-400 tabular-nums">
                            {film.acclaim_score}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                        )}
                      </td>

                      {/* Combined list dots */}
                      <td className="table-cell">
                        <EventDots filmId={inDb ? film.id : null} combMap={combMap} />
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  )
}
