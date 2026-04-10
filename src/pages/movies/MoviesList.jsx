import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS_ORDER = [2001, 2007, 2016, 2026]

const HC = '#d97706'  // gold-600  (Hermz / Matt)
const DC = '#6170f5'  // film-500  (Dust)

// ── helpers ───────────────────────────────────────────────────────────────────

function PosterThumb({ url, title }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div className="w-9 h-12 flex items-center justify-center rounded
                      bg-stone-200 dark:bg-night-600 text-gray-400
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

// One "vs YEAR" cell: shows prior rank + movement arrow
function PriorYearCell({ currentRank, filmId, priorMap }) {
  if (!priorMap) return <td className="table-cell hidden md:table-cell" />

  const prior = priorMap[filmId]

  if (prior === undefined || prior === null) {
    return (
      <td className="table-cell text-center hidden md:table-cell">
        <span className="text-xs text-gray-400 dark:text-gray-600 italic">NR</span>
      </td>
    )
  }

  const diff = prior - currentRank  // positive = rank improved (number dropped)
  return (
    <td className="table-cell text-center hidden md:table-cell">
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">#{prior}</span>
      {diff > 0 && <div className="text-xs rank-up">↑{diff}</div>}
      {diff < 0 && <div className="text-xs rank-down">↓{Math.abs(diff)}</div>}
      {diff === 0 && <div className="text-xs rank-same">●</div>}
    </td>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // URL-driven state
  const eventYear = Number(searchParams.get('event')) || 2026
  const view      = searchParams.get('view') || 'combined'  // 'combined'|'dustin'|'matt'

  // Data state
  const [events, setEvents]           = useState([])
  const [profiles, setProfiles]       = useState({})
  const [rows, setRows]               = useState([])
  const [allPriorMaps, setAllPriorMaps] = useState({}) // { year: { film_id: rank } }
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  // Sort state (no filters — filters live on stats page)
  const [sortBy, setSortBy] = useState('rank')

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

  // ── fetch list data when event/view/profiles/events changes ───────────────
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return

    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return

    // All events that come before this one (ascending)
    const priorEventYears = EVENTS_ORDER.filter(y => y < eventYear)
    const priorEvents = priorEventYears
      .map(py => events.find(e => e.year === py))
      .filter(Boolean)

    setLoading(true)
    setError(null)
    setRows([])
    setAllPriorMaps({})

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
              films (id, title, release_year, director, poster_url)
            `)
            .eq('event_id', currentEvent.id)
            .order('combined_rank')

          if (err) throw err

          mainRows = (data || []).map(r => ({
            rank:        r.combined_rank,
            dustinRank:  r.dustin_rank,
            mattRank:    r.matt_rank,
            score:       r.total_score,
            dustinScore: r.dustin_score,
            mattScore:   r.matt_score,
            film:        r.films,
          }))

          // Fetch all prior combined rank maps in parallel
          const priorResults = await Promise.all(
            priorEvents.map(async pe => {
              const { data: pd } = await supabase
                .from('combined_rankings')
                .select('film_id, combined_rank')
                .eq('event_id', pe.id)
              const pm = {}
              pd?.forEach(r => { pm[r.film_id] = r.combined_rank })
              return { year: pe.year, map: pm }
            })
          )
          const maps = {}
          priorResults.forEach(r => { maps[r.year] = r.map })
          setAllPriorMaps(maps)

        } else {
          // ── Individual list (dustin or matt) ──
          const username = view
          const userId   = profiles[username]
          if (!userId) throw new Error(`Profile not found for ${username}`)

          const { data, error: err } = await supabase
            .from('individual_rankings')
            .select(`
              rank, total_score, score_personal_impact, film_id,
              films (id, title, release_year, director, poster_url)
            `)
            .eq('event_id', currentEvent.id)
            .eq('user_id', userId)
            .order('rank')

          if (err) throw err

          mainRows = (data || []).map(r => ({
            rank:   r.rank,
            score:  r.total_score,
            impact: r.score_personal_impact,
            film:   r.films,
          }))

          // Fetch all prior individual rank maps in parallel
          const priorResults = await Promise.all(
            priorEvents.map(async pe => {
              const { data: pd } = await supabase
                .from('individual_rankings')
                .select('film_id, rank')
                .eq('event_id', pe.id)
                .eq('user_id', userId)
              const pm = {}
              pd?.forEach(r => { pm[r.film_id] = r.rank })
              return { year: pe.year, map: pm }
            })
          )
          const maps = {}
          priorResults.forEach(r => { maps[r.year] = r.map })
          setAllPriorMaps(maps)
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

  // ── sorted rows ────────────────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    if (sortBy === 'score') {
      return [...rows].sort((a, b) => (b.score || 0) - (a.score || 0))
    } else if (sortBy === 'year') {
      return [...rows].sort((a, b) => (a.film?.release_year || 0) - (b.film?.release_year || 0))
    } else if (sortBy === 'year_desc') {
      return [...rows].sort((a, b) => (b.film?.release_year || 0) - (a.film?.release_year || 0))
    } else if (sortBy === 'title') {
      return [...rows].sort((a, b) => (a.film?.title || '').localeCompare(b.film?.title || ''))
    } else if (sortBy === 'dustin_rank' && view === 'combined') {
      return [...rows].sort((a, b) => (a.dustinRank || 999) - (b.dustinRank || 999))
    } else if (sortBy === 'matt_rank' && view === 'combined') {
      return [...rows].sort((a, b) => (a.mattRank || 999) - (b.mattRank || 999))
    }
    return rows  // default: rank order
  }, [rows, sortBy, view])

  // ── event + view helpers ───────────────────────────────────────────────────
  function setEvent(year) {
    setSearchParams({ event: year, view })
    setSortBy('rank')
  }
  function setView(v) {
    setSearchParams({ event: eventYear, view: v })
    setSortBy('rank')
  }

  // Prior event years for this event (ascending = oldest first → shown right-to-left in headers)
  const priorYears = EVENTS_ORDER.filter(y => y < eventYear)

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

  // Short year label e.g. 2007 → '07
  function shortYear(y) { return `'${String(y).slice(2)}` }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/movies"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
            ← Movies
          </Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <h1 className="page-title text-2xl">Rankings</h1>
        </div>
        <Link to={`/movies/stats?event=${eventYear}&view=${view}`}
          className="btn-ghost text-sm flex items-center gap-1.5">
          📊 Stats & Charts
        </Link>
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
      <div className="flex gap-1 mb-5 p-1 bg-stone-100 dark:bg-night-800 rounded-xl w-fit">
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

      {/* ── Sort bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="select text-sm pr-8"
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {sortBy !== 'rank' && (
          <button
            onClick={() => setSortBy('rank')}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ✕ Reset sort
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
          {displayRows.length} film{displayRows.length !== 1 ? 's' : ''}
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
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                {/* Rank */}
                <th className="table-header w-14 text-center">#</th>

                {/* Film */}
                <th className="table-header">Film</th>

                {/* Score columns — combined */}
                {view === 'combined' ? (
                  <>
                    <th className="table-header text-center hidden lg:table-cell" style={{ color: DC }}>
                      Dust
                    </th>
                    <th className="table-header text-center hidden lg:table-cell" style={{ color: HC }}>
                      Hermz
                    </th>
                    <th className="table-header text-center">Score</th>
                  </>
                ) : (
                  <th className="table-header text-center">Score</th>
                )}

                {/* Prior year rank columns (most recent → oldest) */}
                {[...priorYears].reverse().map(py => (
                  <th key={py}
                    className="table-header text-center hidden md:table-cell w-20 text-gray-400 dark:text-gray-600">
                    vs {shortYear(py)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayRows.map(row => {
                const film = row.film
                if (!film) return null

                return (
                  <tr key={film.id} className="table-row-hover">

                    {/* Rank — bigger font */}
                    <td className="table-cell text-center">
                      <span className="font-display font-bold text-gray-900 dark:text-white text-xl">
                        {row.rank}
                      </span>
                    </td>

                    {/* Film info — larger title */}
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <PosterThumb url={film.poster_url} title={film.title} />
                        <div className="min-w-0">
                          <Link
                            to={`/movies/${film.id}`}
                            state={{ from: location.pathname + location.search }}
                            className="text-base font-semibold text-gray-900 dark:text-white
                                       hover:text-film-600 dark:hover:text-film-400
                                       transition-colors leading-snug block truncate"
                          >
                            {film.title}
                          </Link>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5
                                          flex items-center gap-2 flex-wrap">
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

                    {/* Score columns */}
                    {view === 'combined' ? (
                      <>
                        <td className="table-cell text-center hidden lg:table-cell">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-sm" style={{ color: DC }}>
                              {row.dustinRank ?? '—'}
                            </span>
                            <span className="text-xs text-gray-400">{row.dustinScore ?? '—'} pts</span>
                          </div>
                        </td>
                        <td className="table-cell text-center hidden lg:table-cell">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-sm" style={{ color: HC }}>
                              {row.mattRank ?? '—'}
                            </span>
                            <span className="text-xs text-gray-400">{row.mattScore ?? '—'} pts</span>
                          </div>
                        </td>
                        <td className="table-cell text-center">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {row.score ?? '—'}
                          </span>
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

                    {/* Prior year rank cells (most recent → oldest) */}
                    {[...priorYears].reverse().map(py => (
                      <PriorYearCell
                        key={py}
                        currentRank={row.rank}
                        filmId={film.id}
                        priorMap={allPriorMaps[py]}
                      />
                    ))}

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
