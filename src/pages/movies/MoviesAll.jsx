import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS = [2001, 2007, 2016, 2026]

// Colors
const COMBINED_LIGHT = '#111827'   // gray-900  — neutral in light mode
const COMBINED_DARK  = '#ffffff'   // white     — distinct in dark mode
const DUSTIN_COLOR   = '#6170f5'   // film-500
const MATT_COLOR     = '#d97706'   // gold-600

// ── sort helpers ──────────────────────────────────────────────────────────────

// Default sort direction when clicking a new column
function defaultDir(key) {
  if (key === 'lists') return 'desc'
  if (key === 'title') return 'asc'
  return 'asc'  // rank columns: rank 1 first
}

// Compare two rank values — NR (null/undefined) always sorts to bottom
function rankCmp(ra, rb, dir) {
  if (ra == null && rb == null) return 0
  if (ra == null) return 1   // NR → bottom regardless of direction
  if (rb == null) return -1
  return dir === 'asc' ? ra - rb : rb - ra
}

function appearances(filmId, combMap) {
  return Object.keys(combMap[filmId] || {}).length
}

// ── sub-components ────────────────────────────────────────────────────────────

// Clickable sort header
function SortTh({ sortKey: key, currentKey, dir, onSort, children, className = '', style = {} }) {
  const active = currentKey === key
  return (
    <th
      onClick={() => onSort(key)}
      className={`table-header cursor-pointer select-none transition-colors
                  hover:bg-stone-200 dark:hover:bg-night-700/60 ${className}`}
      style={style}
    >
      <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
        {children}
        <span className={`text-xs w-3 ${active ? 'opacity-100' : 'opacity-0'}`}>
          {dir === 'asc' ? '↑' : '↓'}
        </span>
      </div>
    </th>
  )
}

// Film-column sort header (left-aligned)
function FilmSortTh({ sortKey: key, currentKey, dir, onSort }) {
  const active = currentKey === key
  return (
    <th
      onClick={() => onSort(key)}
      className="table-header cursor-pointer select-none transition-colors
                 hover:bg-stone-200 dark:hover:bg-night-700/60
                 sticky left-0 z-10 bg-stone-100 dark:bg-night-900/80 min-w-72 text-left"
    >
      <span className="flex items-center gap-1">
        Film
        <span className={`text-xs ${active ? 'opacity-100' : 'opacity-0'}`}>
          {dir === 'asc' ? '↑' : '↓'}
        </span>
      </span>
    </th>
  )
}

// Rank value cell — combined, dustin, or matt
function RankCell({ rank, variant = 'combined', className = '' }) {
  if (rank == null) {
    return (
      <td className={`table-cell text-center px-3 py-3 ${className}`}>
        <span className="text-xs text-gray-300 dark:text-gray-700">NR</span>
      </td>
    )
  }
  const color = variant === 'combined' ? undefined
              : variant === 'dustin'   ? DUSTIN_COLOR
              :                          MATT_COLOR
  const cls   = variant === 'combined'
    ? 'text-gray-900 dark:text-white'
    : ''
  return (
    <td className={`table-cell text-center px-3 py-3 ${className}`}>
      <span
        className={`text-base font-bold tabular-nums ${cls}`}
        style={color ? { color } : undefined}
      >
        {rank}
      </span>
    </td>
  )
}

// Appearance dot strip
function AppearanceDots({ filmId, combMap }) {
  return (
    <div className="flex gap-1 mt-1">
      {EVENTS.map(yr => {
        const rank = combMap[filmId]?.[yr]
        const on   = rank != null
        return (
          <span
            key={yr}
            title={on ? `#${rank} combined in ${yr}` : `NR in ${yr}`}
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              on ? 'bg-film-500' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          />
        )
      })}
    </div>
  )
}

// Small poster thumbnail
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

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesAll() {
  const [films, setFilms]       = useState([])
  const [combMap, setCombMap]   = useState({})
  const [indivMap, setIndivMap] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [showIndiv, setShowIndiv] = useState(false)
  const [search, setSearch]       = useState('')
  const [sortKey, setSortKey]     = useState('lists')
  const [sortDir, setSortDir]     = useState('desc')

  // ── data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      try {
        const [
          { data: filmsData,    error: fe },
          { data: combinedData, error: ce },
          { data: indivData,    error: ie },
          { data: eventsData,   error: ee },
          { data: profData,     error: pe },
        ] = await Promise.all([
          supabase.from('films')
            .select('id, title, release_year, director, poster_url')
            .order('title'),
          supabase.from('combined_rankings')
            .select('film_id, event_id, combined_rank'),
          supabase.from('individual_rankings')
            .select('film_id, event_id, user_id, rank'),
          supabase.from('ranking_events').select('id, year'),
          supabase.from('profiles').select('id, username'),
        ])
        if (fe || ce || ie || ee || pe) throw fe || ce || ie || ee || pe

        const eventYearMap = {}
        eventsData.forEach(e => { eventYearMap[e.id] = e.year })

        const profileMap = {}
        profData.forEach(p => { profileMap[p.id] = p.username })

        const cm = {}
        combinedData.forEach(r => {
          if (!cm[r.film_id]) cm[r.film_id] = {}
          cm[r.film_id][eventYearMap[r.event_id]] = r.combined_rank
        })

        const im = {}
        indivData.forEach(r => {
          const username = profileMap[r.user_id]
          if (!username) return
          if (!im[r.film_id]) im[r.film_id] = {}
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

  // ── sort handler ───────────────────────────────────────────────────────────
  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(defaultDir(key))
    }
  }

  // ── filter + sort ──────────────────────────────────────────────────────────
  const displayFilms = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? films.filter(f => f.title?.toLowerCase().includes(q))
      : films

    return [...filtered].sort((a, b) => {
      if (sortKey === 'title') {
        const cmp = (a.title || '').localeCompare(b.title || '')
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'lists') {
        const cmp = appearances(b.id, combMap) - appearances(a.id, combMap)
        if (cmp !== 0) return sortDir === 'asc' ? -cmp : cmp
        // Tiebreak: best recent combined rank
        for (const yr of [2026, 2016, 2007, 2001]) {
          const ra = combMap[a.id]?.[yr] ?? 9999
          const rb = combMap[b.id]?.[yr] ?? 9999
          if (ra !== rb) return ra - rb
        }
        return (a.title || '').localeCompare(b.title || '')
      }
      if (sortKey.startsWith('c_')) {
        const yr = Number(sortKey.slice(2))
        return rankCmp(combMap[a.id]?.[yr], combMap[b.id]?.[yr], sortDir)
      }
      if (sortKey.startsWith('d_')) {
        const yr = Number(sortKey.slice(2))
        return rankCmp(indivMap[a.id]?.dustin?.[yr], indivMap[b.id]?.dustin?.[yr], sortDir)
      }
      if (sortKey.startsWith('h_')) {
        const yr = Number(sortKey.slice(2))
        return rankCmp(indivMap[a.id]?.matt?.[yr], indivMap[b.id]?.matt?.[yr], sortDir)
      }
      return 0
    })
  }, [films, combMap, indivMap, search, sortKey, sortDir])

  const sy = yr => `'${String(yr).slice(2)}`

  const totalOnAny = useMemo(
    () => films.filter(f => appearances(f.id, combMap) > 0).length,
    [films, combMap]
  )

  const sharedSortProps = { currentKey: sortKey, dir: sortDir, onSort: handleSort }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/movies"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← Movies
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <h1 className="page-title text-2xl">All Films</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {loading ? '…' : `${films.length} films in the database · ${totalOnAny} on at least one combined list`}
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Search films…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input text-sm w-60"
        />

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
          {' · '}click any column header to sort
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-gray-900 dark:text-white">42</span> Combined
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: DUSTIN_COLOR }}>42</span> Dust
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: MATT_COLOR }}>42</span> Hermz
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {[true, true, false, false].map((on, i) =>
              <span key={i} className={`w-2 h-2 rounded-full inline-block ${on ? 'bg-film-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
            )}
          </span>
          Combined list appearances (01 · 07 · 16 · 26)
        </span>
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="py-16 flex items-center justify-center">
          <span className="text-gray-400 animate-pulse">Loading all films…</span>
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                {/* Film — sticky */}
                <FilmSortTh sortKey="title" {...sharedSortProps} />

                {/* Combined rank columns */}
                {EVENTS.map(yr => (
                  <SortTh key={`c-hdr-${yr}`} sortKey={`c_${yr}`} {...sharedSortProps}
                    className="w-16 text-center"
                    style={{ color: COMBINED_LIGHT }}
                  >
                    <span className="dark:text-white">C{sy(yr)}</span>
                  </SortTh>
                ))}

                {/* Individual rank columns — shown when toggled */}
                {showIndiv && EVENTS.map(yr => (
                  <SortTh key={`d-hdr-${yr}`} sortKey={`d_${yr}`} {...sharedSortProps}
                    className="w-16 text-center border-l border-stone-200 dark:border-night-700"
                    style={{ color: DUSTIN_COLOR }}
                  >
                    D{sy(yr)}
                  </SortTh>
                ))}
                {showIndiv && EVENTS.map(yr => (
                  <SortTh key={`h-hdr-${yr}`} sortKey={`h_${yr}`} {...sharedSortProps}
                    className="w-16 text-center"
                    style={{ color: MATT_COLOR }}
                  >
                    H{sy(yr)}
                  </SortTh>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayFilms.map(film => (
                <tr key={film.id} className="table-row-hover group">

                  {/* Film info — sticky */}
                  <td className="table-cell sticky left-0 z-10
                                 bg-white dark:bg-night-800
                                 group-hover:bg-stone-50 dark:group-hover:bg-night-700/40
                                 min-w-72 max-w-sm">
                    <div className="flex items-center gap-3">
                      <FilmThumb url={film.poster_url} title={film.title} />
                      <div>
                        <Link
                          to={`/movies/${film.id}`}
                          className="text-sm font-semibold text-gray-900 dark:text-white
                                     hover:text-film-600 dark:hover:text-film-400
                                     transition-colors leading-snug"
                        >
                          {film.title}
                        </Link>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {film.release_year}
                          {film.director ? ` · ${film.director.split(',')[0].trim()}` : ''}
                        </div>
                        <AppearanceDots filmId={film.id} combMap={combMap} />
                      </div>
                    </div>
                  </td>

                  {/* Combined rank cells */}
                  {EVENTS.map(yr => (
                    <RankCell key={`c-${yr}`}
                      rank={combMap[film.id]?.[yr]}
                      variant="combined"
                    />
                  ))}

                  {/* Individual rank cells */}
                  {showIndiv && EVENTS.map(yr => (
                    <RankCell key={`d-${yr}`}
                      rank={indivMap[film.id]?.dustin?.[yr]}
                      variant="dustin"
                      className="border-l border-stone-100 dark:border-night-700/50"
                    />
                  ))}
                  {showIndiv && EVENTS.map(yr => (
                    <RankCell key={`h-${yr}`}
                      rank={indivMap[film.id]?.matt?.[yr]}
                      variant="matt"
                    />
                  ))}

                </tr>
              ))}

              {displayFilms.length === 0 && (
                <tr>
                  <td colSpan={99} className="py-12 text-center text-gray-400">
                    No films match &ldquo;{search}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
