import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── list definitions ──────────────────────────────────────────────────────────

const LISTS = [
  { key: 'afi_top100',       label: 'AFI Top 100',        col: 'afi_top100_rank',        ranked: true  },
  { key: 'afi_comedies',     label: 'AFI Comedies',       col: 'afi_comedies_rank',      ranked: true  },
  { key: 'imdb_top250',      label: 'IMDB Top 250',       col: 'imdb_top250_rank',       ranked: true  },
  { key: 'nyt_2000s',        label: 'NYT Best of 2000s',  col: 'nyt_2000s_rank',         ranked: true  },
  { key: 'sight_sound',      label: 'Sight & Sound 2022', col: 'sight_sound_2022_rank',  ranked: true  },
  { key: 'variety_comedies', label: 'Variety Comedies',   col: 'variety_comedies_rank',  ranked: true  },
  { key: 'nfr',              label: 'Film Registry',      col: 'national_film_registry', ranked: false },
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
    <div className="flex gap-1.5 items-center">
      {EVENTS.map(yr => {
        const rank = combMap[filmId]?.[yr]
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

  const [films, setFilms]     = useState([])
  const [combMap, setCombMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')

  // ── data fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      try {
        const [
          { data: filmsData,    error: fe },
          { data: combinedData, error: ce },
          { data: eventsData,   error: ee },
        ] = await Promise.all([
          supabase.from('films').select(`
            id, title, release_year, director, poster_url, acclaim_score,
            afi_top100_rank, afi_comedies_rank, imdb_top250_rank,
            nyt_2000s_rank, sight_sound_2022_rank, variety_comedies_rank,
            national_film_registry
          `),
          supabase.from('combined_rankings').select('film_id, event_id, combined_rank'),
          supabase.from('ranking_events').select('id, year'),
        ])
        if (fe || ce || ee) throw fe || ce || ee

        const eventYearMap = {}
        eventsData?.forEach(e => { eventYearMap[e.id] = e.year })

        const cm = {}
        combinedData?.forEach(r => {
          if (!cm[r.film_id]) cm[r.film_id] = {}
          cm[r.film_id][eventYearMap[r.event_id]] = r.combined_rank
        })

        setFilms(filmsData || [])
        setCombMap(cm)
      } catch (e) {
        setError(e?.message || 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // ── active list config ──────────────────────────────────────────────────────
  const listConfig = LISTS.find(l => l.key === activeKey) || LISTS[0]

  // ── filtered + sorted films for active list ─────────────────────────────────
  const displayFilms = useMemo(() => {
    const col = listConfig.col
    const base = listConfig.ranked
      ? films.filter(f => f[col] != null).sort((a, b) => a[col] - b[col])
      : films.filter(f => f[col] === true).sort((a, b) => (a.title || '').localeCompare(b.title || ''))

    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(f =>
      f.title?.toLowerCase().includes(q) ||
      f.director?.toLowerCase().includes(q)
    )
  }, [films, listConfig, search])

  // ── on-our-lists count for header ───────────────────────────────────────────
  const onOurListsCount = useMemo(() => {
    return displayFilms.filter(f => Object.keys(combMap[f.id] || {}).length > 0).length
  }, [displayFilms, combMap])

  // ── render ──────────────────────────────────────────────────────────────────
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
            onClick={() => { setSearchParams({ list: l.key }); setSearch('') }}
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
          <h2 className="section-title text-lg mb-0.5">{listConfig.label}</h2>
          {!loading && (
            <p className="text-sm text-gray-400">
              {displayFilms.length} film{displayFilms.length !== 1 ? 's' : ''}
              {search ? ` matching "${search}"` : ''}
              {!search && onOurListsCount > 0 && (
                <span className="ml-2 text-film-500 dark:text-film-400">
                  · {onOurListsCount} on our combined lists
                </span>
              )}
            </p>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by title or director…"
            className="input text-sm py-1.5 pl-3 pr-8 w-56"
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

      {/* Dot legend */}
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
        <div className="flex gap-1.5">
          {EVENTS.map(yr => (
            <span key={yr} className="w-2 h-2 rounded-full bg-film-500 inline-block" />
          ))}
        </div>
        <span>On combined list: {EVENTS.map(yr => `'${String(yr).slice(2)}`).join(' · ')}</span>
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="py-16 flex items-center justify-center">
          <span className="text-gray-400 animate-pulse">Loading lists…</span>
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="card overflow-hidden p-0">
          {displayFilms.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {search ? `No films match "${search}".` : 'No films on this list.'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-12 text-center">
                    {listConfig.ranked ? '#' : ''}
                  </th>
                  <th className="table-header">Film</th>
                  <th className="table-header text-center w-16">Acclaim</th>
                  <th className="table-header text-center w-28">Our Lists</th>
                </tr>
              </thead>
              <tbody>
                {displayFilms.map((film, i) => (
                  <tr key={film.id} className="table-row-hover">

                    {/* Rank or index */}
                    <td className="table-cell text-center">
                      <span className="font-display font-bold text-gray-400 dark:text-gray-500 text-base tabular-nums">
                        {listConfig.ranked ? film[listConfig.col] : i + 1}
                      </span>
                    </td>

                    {/* Film info */}
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <PosterThumb url={film.poster_url} title={film.title} />
                        <div className="min-w-0">
                          <Link
                            to={`/movies/${film.id}`}
                            className="text-sm font-semibold text-gray-900 dark:text-white
                                       hover:text-film-600 dark:hover:text-film-400
                                       transition-colors leading-snug block truncate"
                          >
                            {film.title}
                          </Link>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex gap-2 flex-wrap">
                            {film.release_year && <span>{film.release_year}</span>}
                            {film.director && (
                              <>
                                <span className="text-gray-300 dark:text-gray-700">·</span>
                                <span className="truncate">{film.director.split(',')[0].trim()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Acclaim score */}
                    <td className="table-cell text-center">
                      {film.acclaim_score != null ? (
                        <span className="font-bold text-gold-600 dark:text-gold-400 tabular-nums">
                          {film.acclaim_score}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                      )}
                    </td>

                    {/* Combined list dots */}
                    <td className="table-cell">
                      <div className="flex justify-center">
                        <EventDots filmId={film.id} combMap={combMap} />
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  )
}
