import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS_ORDER = [2001, 2007, 2016, 2026]
const PRIOR_YEAR   = { 2001: null, 2007: 2001, 2016: 2007, 2026: 2016 }

const HC = '#d97706'  // gold-600  (Hermz / Matt)
const DC = '#6170f5'  // film-500  (Dust)

// ── helpers ───────────────────────────────────────────────────────────────────

function primaryGenre(film) {
  if (film.custom_genre_1) return film.custom_genre_1
  if (film.omdb_genres) return film.omdb_genres.split(',')[0].trim()
  return null
}

function allGenres(film) {
  const genres = []
  if (film.custom_genre_1) genres.push(film.custom_genre_1)
  if (film.custom_genre_2) genres.push(film.custom_genre_2)
  if (genres.length === 0 && film.omdb_genres) {
    film.omdb_genres.split(',').forEach(g => genres.push(g.trim()))
  }
  return [...new Set(genres)]
}

function decade(year) {
  if (!year) return null
  return Math.floor(year / 10) * 10
}

function decadeLabel(d) {
  return d ? `${d}s` : 'Unknown'
}

function movementIcon(current, priorMap, filmId) {
  if (!priorMap) return null
  const prior = priorMap[filmId]
  if (prior === undefined || prior === null) return { type: 'new' }
  const diff = prior - current
  if (diff > 0)  return { type: 'up',   amount: diff }
  if (diff < 0)  return { type: 'down', amount: -diff }
  return { type: 'same' }
}

function MovementBadge({ mv }) {
  if (!mv) return null
  if (mv.type === 'new')  return <span className="rank-new text-xs font-bold">NEW</span>
  if (mv.type === 'same') return <span className="rank-same text-xs">●</span>
  if (mv.type === 'up')   return <span className="rank-up text-xs font-semibold">↑{mv.amount}</span>
  if (mv.type === 'down') return <span className="rank-down text-xs font-semibold">↓{mv.amount}</span>
  return null
}

function GenreBadge({ genre }) {
  if (!genre) return null
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded-full
                     bg-film-100 text-film-700 border border-film-200
                     dark:bg-film-900/40 dark:text-film-300 dark:border-film-700/40
                     whitespace-nowrap">
      {genre}
    </span>
  )
}

function PosterThumb({ url, title }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div className="w-9 h-12 flex items-center justify-center rounded
                      bg-stone-200 dark:bg-night-600 text-gray-400 dark:text-night-400
                      flex-shrink-0 text-lg">
        🎬
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={title}
      onError={() => setErr(true)}
      className="w-9 h-12 object-cover rounded flex-shrink-0 shadow-sm"
    />
  )
}

// ── chart helpers ──────────────────────────────────────────────────────────────

function DecadeChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      const d = decade(f.release_year)
      if (d) counts[d] = (counts[d] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([d, count]) => ({ decade: decadeLabel(Number(d)), count }))
  }, [films])

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} />
        <YAxis type="category" dataKey="decade" width={46} tick={{ fill: textColor, fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: isDark ? '#1e1e30' : '#fff',
            border: isDark ? '1px solid #26263c' : '1px solid #e7e5e4',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }}
        />
        <Bar dataKey="count" fill={DC} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function GenreChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      const g = primaryGenre(f)
      if (g) counts[g] = (counts[g] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }))
  }, [films])

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={data.length * 28 + 20}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} />
        <YAxis type="category" dataKey="genre" width={120} tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: isDark ? '#1e1e30' : '#fff',
            border: isDark ? '1px solid #26263c' : '1px solid #e7e5e4',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }}
        />
        <Bar dataKey="count" fill={HC} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DirectorChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      if (f.director) {
        const d = f.director.split(',')[0].trim() // first listed director
        counts[d] = (counts[d] || 0) + 1
      }
    })
    return Object.entries(counts)
      .filter(([, n]) => n > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)
      .map(([director, count]) => ({ director, count }))
  }, [films])

  if (data.length === 0) return (
    <p className="text-gray-400 dark:text-gray-600 text-sm text-center py-4">
      No directors with multiple films in this view.
    </p>
  )

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={data.length * 28 + 20}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="director" width={130} tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: isDark ? '#1e1e30' : '#fff',
            border: isDark ? '1px solid #26263c' : '1px solid #e7e5e4',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={i % 2 === 0 ? HC : DC} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isDark } = useTheme()

  // URL-driven state
  const eventYear  = Number(searchParams.get('event')) || 2026
  const view       = searchParams.get('view') || 'combined'   // 'combined'|'dustin'|'matt'

  // Data state
  const [events, setEvents]       = useState([])   // [{id, year, label}]
  const [profiles, setProfiles]   = useState({})   // {dustin: uuid, matt: uuid}
  const [rows, setRows]           = useState([])   // processed list rows
  const [priorMap, setPriorMap]   = useState(null) // film_id -> prior rank
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // Filter / sort state
  const [filterGenre,  setFilterGenre]  = useState('')
  const [filterDecade, setFilterDecade] = useState('')
  const [sortBy,       setSortBy]       = useState('rank')
  const [showCharts,   setShowCharts]   = useState(false)

  // ── fetch ranking events + profiles once ──────────────────────────────────
  useEffect(() => {
    async function loadMeta() {
      const [{ data: evData }, { data: profData }] = await Promise.all([
        supabase.from('ranking_events').select('id,year,label').order('year'),
        supabase.from('profiles').select('id,username'),
      ])
      setEvents(evData || [])
      const profMap = {}
      profData?.forEach(p => { profMap[p.username] = p.id })
      setProfiles(profMap)
    }
    loadMeta()
  }, [])

  // ── fetch list data when event/view/profiles changes ──────────────────────
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return

    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return

    const priorYear    = PRIOR_YEAR[eventYear]
    const priorEvent   = priorYear ? events.find(e => e.year === priorYear) : null

    setLoading(true)
    setError(null)
    setRows([])
    setPriorMap(null)

    async function fetchData() {
      try {
        let mainRows = []

        if (view === 'combined') {
          // ── Combined list ──
          const { data, error: err } = await supabase
            .from('combined_rankings')
            .select(`
              combined_rank, dustin_rank, matt_rank,
              total_score, dustin_score, matt_score, avg_rank,
              film_id,
              films (id, title, release_year, director,
                     omdb_genres, custom_genre_1, custom_genre_2,
                     poster_url, acclaim_score)
            `)
            .eq('event_id', currentEvent.id)
            .order('combined_rank')

          if (err) throw err

          mainRows = (data || []).map(r => ({
            rank:         r.combined_rank,
            dustinRank:   r.dustin_rank,
            mattRank:     r.matt_rank,
            score:        r.total_score,
            dustinScore:  r.dustin_score,
            mattScore:    r.matt_score,
            avgRank:      r.avg_rank,
            film:         r.films,
          }))

          // Prior combined
          if (priorEvent) {
            const { data: pd } = await supabase
              .from('combined_rankings')
              .select('film_id, combined_rank')
              .eq('event_id', priorEvent.id)
            const pm = {}
            pd?.forEach(r => { pm[r.film_id] = r.combined_rank })
            setPriorMap(pm)
          }

        } else {
          // ── Individual list (dustin or matt) ──
          const username = view // 'dustin' or 'matt'
          const userId   = profiles[username]
          if (!userId) throw new Error(`Profile not found for ${username}`)

          const { data, error: err } = await supabase
            .from('individual_rankings')
            .select(`
              rank, total_score, score_personal_impact, film_id,
              films (id, title, release_year, director,
                     omdb_genres, custom_genre_1, custom_genre_2,
                     poster_url, acclaim_score)
            `)
            .eq('event_id', currentEvent.id)
            .eq('user_id', userId)
            .order('rank')

          if (err) throw err

          mainRows = (data || []).map(r => ({
            rank:        r.rank,
            score:       r.total_score,
            impact:      r.score_personal_impact,
            film:        r.films,
          }))

          // Prior individual
          if (priorEvent) {
            const { data: pd } = await supabase
              .from('individual_rankings')
              .select('film_id, rank')
              .eq('event_id', priorEvent.id)
              .eq('user_id', userId)
            const pm = {}
            pd?.forEach(r => { pm[r.film_id] = r.rank })
            setPriorMap(pm)
          }
        }

        setRows(mainRows)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYear, view, profiles, events])

  // ── derived data for filters ───────────────────────────────────────────────
  const allGenreOptions = useMemo(() => {
    const genres = new Set()
    rows.forEach(r => {
      if (r.film) allGenres(r.film).forEach(g => genres.add(g))
    })
    return [...genres].sort()
  }, [rows])

  const allDecadeOptions = useMemo(() => {
    const decades = new Set()
    rows.forEach(r => {
      const d = decade(r.film?.release_year)
      if (d) decades.add(d)
    })
    return [...decades].sort((a, b) => a - b)
  }, [rows])

  // ── filtered + sorted rows ─────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    let filtered = rows

    if (filterGenre) {
      filtered = filtered.filter(r => r.film && allGenres(r.film).includes(filterGenre))
    }
    if (filterDecade) {
      filtered = filtered.filter(r => r.film && decade(r.film.release_year) === Number(filterDecade))
    }

    // Sort (rank is already the default order)
    if (sortBy === 'score') {
      filtered = [...filtered].sort((a, b) => (b.score || 0) - (a.score || 0))
    } else if (sortBy === 'year') {
      filtered = [...filtered].sort((a, b) => (a.film?.release_year || 0) - (b.film?.release_year || 0))
    } else if (sortBy === 'year_desc') {
      filtered = [...filtered].sort((a, b) => (b.film?.release_year || 0) - (a.film?.release_year || 0))
    } else if (sortBy === 'title') {
      filtered = [...filtered].sort((a, b) => (a.film?.title || '').localeCompare(b.film?.title || ''))
    } else if (sortBy === 'dustin_rank' && view === 'combined') {
      filtered = [...filtered].sort((a, b) => (a.dustinRank || 999) - (b.dustinRank || 999))
    } else if (sortBy === 'matt_rank' && view === 'combined') {
      filtered = [...filtered].sort((a, b) => (a.mattRank || 999) - (b.mattRank || 999))
    }

    return filtered
  }, [rows, filterGenre, filterDecade, sortBy, view])

  // Film objects for charts (deduped by film id)
  const chartFilms = useMemo(() => {
    const seen = new Set()
    const films = []
    displayRows.forEach(r => {
      if (r.film && !seen.has(r.film.id)) {
        seen.add(r.film.id)
        films.push(r.film)
      }
    })
    return films
  }, [displayRows])

  // ── event + view helpers ───────────────────────────────────────────────────
  function setEvent(year) {
    setSearchParams({ event: year, view })
    setFilterGenre('')
    setFilterDecade('')
    setSortBy('rank')
  }
  function setView(v) {
    setSearchParams({ event: eventYear, view: v })
    setSortBy('rank')
  }

  const priorLabel = PRIOR_YEAR[eventYear] ? `vs ${PRIOR_YEAR[eventYear]}` : null

  // ── sort options ───────────────────────────────────────────────────────────
  const sortOptions = [
    { value: 'rank',      label: view === 'combined' ? 'Combined Rank' : 'Rank' },
    { value: 'score',     label: 'Score (High → Low)' },
    { value: 'year',      label: 'Release Year (Old → New)' },
    { value: 'year_desc', label: 'Release Year (New → Old)' },
    { value: 'title',     label: 'Title (A–Z)' },
    ...(view === 'combined' ? [
      { value: 'dustin_rank', label: "Dust's Rank" },
      { value: 'matt_rank',   label: "Hermz's Rank" },
    ] : []),
  ]

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/movies" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← Movies
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <h1 className="page-title text-2xl">Rankings</h1>
      </div>

      {/* ── Event selector ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {EVENTS_ORDER.map(yr => (
          <button
            key={yr}
            onClick={() => setEvent(yr)}
            className={`px-5 py-2 rounded-xl font-display font-bold text-sm transition-all ${
              yr === eventYear
                ? 'bg-film-600 text-white shadow-md shadow-film-900/20'
                : 'bg-stone-100 text-gray-500 hover:bg-film-50 hover:text-film-600 dark:bg-night-700 dark:text-gray-400 dark:hover:bg-film-900/40 dark:hover:text-film-400'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>

      {/* ── View toggle: Combined / Dustin / Matt ── */}
      <div className="flex gap-1 mb-6 p-1 bg-stone-100 dark:bg-night-800 rounded-xl w-fit">
        {[
          { value: 'combined', label: 'Combined' },
          { value: 'dustin',   label: "Dust's List" },
          { value: 'matt',     label: "Hermz's List" },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setView(opt.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === opt.value
                ? 'bg-white dark:bg-night-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Filter + sort bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Genre filter */}
        <select
          value={filterGenre}
          onChange={e => setFilterGenre(e.target.value)}
          className="select text-sm pr-8"
        >
          <option value="">All Genres</option>
          {allGenreOptions.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {/* Decade filter */}
        <select
          value={filterDecade}
          onChange={e => setFilterDecade(e.target.value)}
          className="select text-sm pr-8"
        >
          <option value="">All Decades</option>
          {allDecadeOptions.map(d => (
            <option key={d} value={d}>{decadeLabel(d)}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="select text-sm pr-8"
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {(filterGenre || filterDecade || sortBy !== 'rank') && (
          <button
            onClick={() => { setFilterGenre(''); setFilterDecade(''); setSortBy('rank') }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ✕ Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
          {displayRows.length} film{displayRows.length !== 1 ? 's' : ''}
          {(filterGenre || filterDecade) && ` (filtered from ${rows.length})`}
        </span>
      </div>

      {/* ── Loading / error ── */}
      {loading && (
        <div className="py-16 flex items-center justify-center">
          <span className="text-gray-400 animate-pulse">Loading {eventYear} rankings…</span>
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>
      )}

      {/* ── List table ── */}
      {!loading && !error && displayRows.length > 0 && (
        <div className="card overflow-hidden p-0 mb-6">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header w-12 text-center">#</th>
                <th className="table-header">Film</th>
                <th className="table-header hidden sm:table-cell">Genre</th>
                {view === 'combined' ? (
                  <>
                    <th className="table-header text-center hidden md:table-cell" style={{ color: DC }}>Dust</th>
                    <th className="table-header text-center hidden md:table-cell" style={{ color: HC }}>Hermz</th>
                    <th className="table-header text-center">Score</th>
                  </>
                ) : (
                  <>
                    <th className="table-header text-center">Score</th>
                  </>
                )}
                {priorLabel && (
                  <th className="table-header text-center hidden sm:table-cell w-16">{priorLabel}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => {
                const film = row.film
                if (!film) return null
                const mv = movementIcon(row.rank, priorMap, film.id)
                const genre = primaryGenre(film)

                return (
                  <tr key={film.id} className="table-row-hover">

                    {/* Rank */}
                    <td className="table-cell text-center">
                      <span className="font-display font-bold text-gray-900 dark:text-white text-base">
                        {row.rank}
                      </span>
                    </td>

                    {/* Film info */}
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <PosterThumb url={film.poster_url} title={film.title} />
                        <div className="min-w-0">
                          <Link
                            to={`/movies/${film.id}`}
                            className="font-semibold text-gray-900 dark:text-white hover:text-film-600 dark:hover:text-film-400 transition-colors leading-snug block truncate"
                          >
                            {film.title}
                          </Link>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            {film.release_year && <span>{film.release_year}</span>}
                            {film.director && (
                              <>
                                <span className="text-gray-300 dark:text-gray-700">·</span>
                                <span className="truncate">{film.director.split(',')[0].trim()}</span>
                              </>
                            )}
                          </div>
                          {/* Genre shown inline on mobile */}
                          {genre && (
                            <div className="sm:hidden mt-1">
                              <GenreBadge genre={genre} />
                            </div>
                          )}
                          {/* Acclaim badge */}
                          {film.acclaim_score && (
                            <span className="inline-block mt-1 text-xs text-gold-600 dark:text-gold-400 font-medium">
                              ★ {film.acclaim_score}/10
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Genre (desktop) */}
                    <td className="table-cell hidden sm:table-cell">
                      <GenreBadge genre={genre} />
                    </td>

                    {/* Scores */}
                    {view === 'combined' ? (
                      <>
                        <td className="table-cell text-center hidden md:table-cell">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-sm" style={{ color: DC }}>{row.dustinRank ?? '—'}</span>
                            <span className="text-xs text-gray-400">{row.dustinScore ?? '—'} pts</span>
                          </div>
                        </td>
                        <td className="table-cell text-center hidden md:table-cell">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-sm" style={{ color: HC }}>{row.mattRank ?? '—'}</span>
                            <span className="text-xs text-gray-400">{row.mattScore ?? '—'} pts</span>
                          </div>
                        </td>
                        <td className="table-cell text-center">
                          <span className="font-bold text-gray-900 dark:text-white">{row.score ?? '—'}</span>
                        </td>
                      </>
                    ) : (
                      <td className="table-cell text-center">
                        <span className="font-bold text-gray-900 dark:text-white">{row.score ?? '—'}</span>
                        {row.impact != null && (
                          <div className="text-xs text-gold-600 dark:text-gold-400 mt-0.5">
                            PI: {row.impact}
                          </div>
                        )}
                      </td>
                    )}

                    {/* Movement */}
                    {priorLabel && (
                      <td className="table-cell text-center hidden sm:table-cell">
                        <MovementBadge mv={mv} />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && displayRows.length === 0 && rows.length > 0 && (
        <div className="card text-center py-10">
          <p className="text-gray-400">No films match the current filters.</p>
          <button
            onClick={() => { setFilterGenre(''); setFilterDecade('') }}
            className="mt-3 text-sm text-film-600 hover:text-film-500 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Charts toggle ── */}
      {!loading && rows.length > 0 && (
        <div>
          <button
            onClick={() => setShowCharts(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400
                       hover:text-film-600 dark:hover:text-film-400 transition-colors mb-4"
          >
            <span>{showCharts ? '▼' : '▶'}</span>
            Charts & Distributions
          </button>

          {showCharts && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Decade dist */}
              <div className="card">
                <h3 className="section-title text-base mb-1">By Decade</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Films by release decade</p>
                <DecadeChart films={chartFilms} isDark={isDark} />
              </div>

              {/* Genre dist */}
              <div className="card">
                <h3 className="section-title text-base mb-1">By Genre</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Top 10 genres (primary)</p>
                <GenreChart films={chartFilms} isDark={isDark} />
              </div>

              {/* Top directors */}
              <div className="card">
                <h3 className="section-title text-base mb-1">Top Directors</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Directors with 2+ films</p>
                <DirectorChart films={chartFilms} isDark={isDark} />
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  )
}
