import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS = [2001, 2007, 2016, 2026]

// ── helpers ───────────────────────────────────────────────────────────────────

// Appearances count: how many combined lists a film is on (0–4)
function appearances(filmId, combMap) {
  return Object.keys(combMap[filmId] || {}).length
}

// Rank cell for combined or individual list
function RankCell({ rank, type = 'combined' }) {
  if (!rank) {
    return (
      <td className="table-cell text-center px-2">
        <span className="text-gray-300 dark:text-gray-700 text-xs">NR</span>
      </td>
    )
  }

  const colorClass = type === 'combined'
    ? 'text-film-600 dark:text-film-400'
    : type === 'dustin'
    ? 'text-film-500 dark:text-film-400'
    : 'text-gold-600 dark:text-gold-400'

  return (
    <td className="table-cell text-center px-2">
      <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>
        {rank}
      </span>
    </td>
  )
}

// Appearance dot strip: shows which events a film was on (combined)
function AppearanceDots({ filmId, combMap }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {EVENTS.map(yr => {
        const on = combMap[filmId]?.[yr] != null
        return (
          <span key={yr}
            title={on ? `#${combMap[filmId][yr]} in ${yr}` : `NR in ${yr}`}
            className={`w-1.5 h-1.5 rounded-full ${
              on ? 'bg-film-500' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          />
        )
      })}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesAll() {
  const [films, setFilms]       = useState([])
  const [combMap, setCombMap]   = useState({})  // film_id -> { year: combined_rank }
  const [indivMap, setIndivMap] = useState({})  // film_id -> { 'dustin'|'matt': { year: rank } }
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // UI state
  const [showIndiv, setShowIndiv] = useState(false)
  const [search, setSearch]       = useState('')
  const [sortBy, setSortBy]       = useState('appearances')

  useEffect(() => {
    async function fetchAll() {
      try {
        const [
          { data: filmsData, error: fe },
          { data: combinedData, error: ce },
          { data: indivData, error: ie },
          { data: eventsData, error: ee },
          { data: profData, error: pe },
        ] = await Promise.all([
          supabase.from('films')
            .select('id, title, release_year, director, poster_url')
            .order('title'),
          supabase.from('combined_rankings')
            .select('film_id, event_id, combined_rank'),
          supabase.from('individual_rankings')
            .select('film_id, event_id, user_id, rank'),
          supabase.from('ranking_events')
            .select('id, year'),
          supabase.from('profiles')
            .select('id, username'),
        ])

        if (fe || ce || ie || ee || pe) throw fe || ce || ie || ee || pe

        // event_id -> year
        const eventYearMap = {}
        eventsData.forEach(e => { eventYearMap[e.id] = e.year })

        // user_id -> username
        const profileMap = {}
        profData.forEach(p => { profileMap[p.id] = p.username })

        // Build combined map: film_id -> { year: combined_rank }
        const cm = {}
        combinedData.forEach(r => {
          if (!cm[r.film_id]) cm[r.film_id] = {}
          cm[r.film_id][eventYearMap[r.event_id]] = r.combined_rank
        })

        // Build individual map: film_id -> { username: { year: rank } }
        const im = {}
        indivData.forEach(r => {
          if (!im[r.film_id]) im[r.film_id] = {}
          const username = profileMap[r.user_id]
          if (!username) return
          if (!im[r.film_id][username]) im[r.film_id][username] = {}
          im[r.film_id][username][eventYearMap[r.event_id]] = r.rank
        })

        setFilms(filmsData || [])
        setCombMap(cm)
        setIndivMap(im)
      } catch (e) {
        setError(e?.message || 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // ── filter + sort ──────────────────────────────────────────────────────────
  const displayFilms = useMemo(() => {
    let filtered = films
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = films.filter(f => f.title?.toLowerCase().includes(q))
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'appearances') {
        const diff = appearances(b.id, combMap) - appearances(a.id, combMap)
        if (diff !== 0) return diff
        // Tiebreak: best 2026 rank → 2016 → 2007 → 2001
        for (const yr of [2026, 2016, 2007, 2001]) {
          const ra = combMap[a.id]?.[yr] ?? 9999
          const rb = combMap[b.id]?.[yr] ?? 9999
          if (ra !== rb) return ra - rb
        }
        return (a.title || '').localeCompare(b.title || '')
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '')
      }
      if (sortBy === 'year') {
        return (a.release_year || 0) - (b.release_year || 0)
      }
      if (sortBy === 'year_desc') {
        return (b.release_year || 0) - (a.release_year || 0)
      }
      // Sort by a specific event's combined rank
      if (sortBy.startsWith('rank_')) {
        const yr = Number(sortBy.replace('rank_', ''))
        const ra = combMap[a.id]?.[yr] ?? 9999
        const rb = combMap[b.id]?.[yr] ?? 9999
        return ra - rb
      }
      return 0
    })
  }, [films, combMap, search, sortBy])

  // Short year label
  const sy = yr => `'${String(yr).slice(2)}`

  const totalOnAny = useMemo(() =>
    films.filter(f => appearances(f.id, combMap) > 0).length,
    [films, combMap]
  )

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/movies"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← Movies
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <h1 className="page-title text-2xl">All Films</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Every film ever ranked by Hermz or Dust — {films.length} in the database,{' '}
        {totalOnAny} on at least one combined list.
      </p>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">

        {/* Search */}
        <input
          type="text"
          placeholder="Search films…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input text-sm w-56"
        />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="select text-sm pr-8"
        >
          <option value="appearances">Most Combined Appearances</option>
          <option value="rank_2026">2026 Combined Rank</option>
          <option value="rank_2016">2016 Combined Rank</option>
          <option value="rank_2007">2007 Combined Rank</option>
          <option value="rank_2001">2001 Combined Rank</option>
          <option value="title">Title A–Z</option>
          <option value="year">Release Year (Old → New)</option>
          <option value="year_desc">Release Year (New → Old)</option>
        </select>

        {/* Individual ranks toggle */}
        <button
          onClick={() => setShowIndiv(v => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
            showIndiv
              ? 'bg-film-600 text-white border-film-600'
              : 'border-stone-300 text-gray-500 hover:border-film-400 hover:text-film-600 dark:border-night-600 dark:text-gray-400 dark:hover:border-film-500 dark:hover:text-film-400'
          }`}
        >
          {showIndiv ? '✓ ' : ''}Individual Ranks
        </button>

        <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
          {displayFilms.length} film{displayFilms.length !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </span>
      </div>

      {/* ── Loading / error ── */}
      {loading && (
        <div className="py-16 flex items-center justify-center">
          <span className="text-gray-400 animate-pulse">Loading all films…</span>
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>
      )}

      {/* ── Table ── */}
      {!loading && !error && (
        <div className="card overflow-x-auto overflow-y-visible p-0">
          <table className="w-full min-w-max">
            <thead>
              <tr>
                {/* Film */}
                <th className="table-header sticky left-0 z-10
                               bg-stone-100 dark:bg-night-900/50 min-w-56">
                  Film
                </th>

                {/* Combined rank columns — grouped by event */}
                {EVENTS.map(yr => (
                  <th key={`c-${yr}`}
                    className="table-header text-center px-2 w-14"
                    style={{ color: '#6170f5' }}>
                    C{sy(yr)}
                  </th>
                ))}

                {/* Individual rank columns — shown when toggled */}
                {showIndiv && EVENTS.map(yr => (
                  <>
                    <th key={`d-${yr}`}
                      className="table-header text-center px-2 w-14 border-l border-stone-200 dark:border-night-700">
                      <span style={{ color: '#6170f5' }}>D{sy(yr)}</span>
                    </th>
                    <th key={`h-${yr}`}
                      className="table-header text-center px-2 w-14">
                      <span style={{ color: '#d97706' }}>H{sy(yr)}</span>
                    </th>
                  </>
                ))}
              </tr>

              {/* Sub-header: year labels */}
              <tr className="border-b border-stone-200 dark:border-night-700">
                <td className="sticky left-0 z-10 bg-stone-50 dark:bg-night-900/30 px-4 py-1">
                  <span className="text-xs text-gray-400 dark:text-gray-600">
                    C = Combined · {showIndiv ? 'D = Dust · H = Hermz' : 'toggle Individual Ranks to see D & H'}
                  </span>
                </td>
                {EVENTS.map(yr => (
                  <td key={yr} className="text-center px-2 py-1">
                    <span className="text-xs text-gray-400 dark:text-gray-600">{yr}</span>
                  </td>
                ))}
                {showIndiv && EVENTS.map(yr => (
                  <>
                    <td key={`d-${yr}`} className="text-center px-2 py-1 border-l border-stone-200 dark:border-night-700">
                      <span className="text-xs text-gray-400 dark:text-gray-600">{yr}</span>
                    </td>
                    <td key={`h-${yr}`} className="text-center px-2 py-1">
                      <span className="text-xs text-gray-400 dark:text-gray-600">{yr}</span>
                    </td>
                  </>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayFilms.map(film => {
                const apCount = appearances(film.id, combMap)
                return (
                  <tr key={film.id} className="table-row-hover">

                    {/* Film info — sticky on scroll */}
                    <td className="table-cell sticky left-0 z-10
                                   bg-white dark:bg-night-800
                                   group-hover:bg-stone-50 dark:group-hover:bg-night-700/40">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Poster */}
                        <FilmThumb url={film.poster_url} title={film.title} />

                        {/* Info */}
                        <div className="min-w-0">
                          <Link
                            to={`/movies/${film.id}`}
                            className="text-sm font-semibold text-gray-900 dark:text-white
                                       hover:text-film-600 dark:hover:text-film-400
                                       transition-colors block truncate max-w-[220px]"
                          >
                            {film.title}
                          </Link>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {film.release_year}{film.director ? ` · ${film.director.split(',')[0].trim()}` : ''}
                          </div>
                          {/* Combined appearance dots */}
                          <AppearanceDots filmId={film.id} combMap={combMap} />
                        </div>
                      </div>
                    </td>

                    {/* Combined rank cells */}
                    {EVENTS.map(yr => (
                      <RankCell key={`c-${yr}`}
                        rank={combMap[film.id]?.[yr]}
                        type="combined"
                      />
                    ))}

                    {/* Individual rank cells */}
                    {showIndiv && EVENTS.map(yr => (
                      <>
                        <td key={`d-${yr}`}
                          className="table-cell text-center px-2 border-l border-stone-100 dark:border-night-700/50">
                          {indivMap[film.id]?.dustin?.[yr]
                            ? <span className="text-sm font-semibold tabular-nums text-film-500 dark:text-film-400">
                                {indivMap[film.id].dustin[yr]}
                              </span>
                            : <span className="text-xs text-gray-300 dark:text-gray-700">NR</span>
                          }
                        </td>
                        <td key={`h-${yr}`} className="table-cell text-center px-2">
                          {indivMap[film.id]?.matt?.[yr]
                            ? <span className="text-sm font-semibold tabular-nums text-gold-600 dark:text-gold-400">
                                {indivMap[film.id].matt[yr]}
                              </span>
                            : <span className="text-xs text-gray-300 dark:text-gray-700">NR</span>
                          }
                        </td>
                      </>
                    ))}

                  </tr>
                )
              })}
            </tbody>
          </table>

          {displayFilms.length === 0 && !loading && (
            <div className="py-12 text-center text-gray-400">
              No films match "{search}".
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── small poster thumbnail ─────────────────────────────────────────────────────

function FilmThumb({ url, title }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div className="w-8 h-11 flex-shrink-0 rounded flex items-center justify-center
                      bg-stone-200 dark:bg-night-600 text-base">
        🎬
      </div>
    )
  }
  return (
    <img src={url} alt={title} onError={() => setErr(true)}
      className="w-8 h-11 object-cover rounded flex-shrink-0 shadow-sm" />
  )
}
