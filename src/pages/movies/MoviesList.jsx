import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FilmStill from '../../components/FilmStill'

// ── view-mode icons ─────────────────────────────────────────────────────────
function ListViewIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="currentColor" className="w-4 h-4">
      <rect x="2" y="3" width="14" height="2" rx="1" />
      <rect x="2" y="8" width="14" height="2" rx="1" />
      <rect x="2" y="13" width="14" height="2" rx="1" />
    </svg>
  )
}
function GridViewIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="currentColor" className="w-4 h-4">
      <rect x="2" y="2" width="6" height="6" rx="1.5" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" />
      <rect x="2" y="10" width="6" height="6" rx="1.5" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" />
    </svg>
  )
}

const EVENTS_ORDER = [2001, 2007, 2016, 2026]
const HC = '#E0A22F'   // gold-500   — Hermz
const DC = '#5B6CFF'   // film-500   — Dust
const CC = '#00E0D9'   // cinema-500 — Combined

// One prior-year cell — shows prior rank + movement
function PriorYearCell({ currentRank, filmId, priorMap }) {
  if (!priorMap) return <td className="table-cell hidden md:table-cell" />
  const prior = priorMap[filmId]
  if (prior === undefined || prior === null) {
    return (
      <td className="table-cell text-center hidden md:table-cell">
        <span className="text-xs text-gray-600 italic">NR</span>
      </td>
    )
  }
  const diff = prior - currentRank
  return (
    <td className="table-cell text-center hidden md:table-cell">
      <span className="font-mono text-base font-semibold text-white">#{prior}</span>
      {diff > 0 && <div className="text-sm rank-up font-mono">↑{diff}</div>}
      {diff < 0 && <div className="text-sm rank-down font-mono">↓{Math.abs(diff)}</div>}
      {diff === 0 && <div className="text-sm rank-same font-mono">●</div>}
    </td>
  )
}

// ── main component ──────────────────────────────────────────────────────────
export default function MoviesList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const eventYear = Number(searchParams.get('event')) || 2026
  const view      = searchParams.get('view') || 'combined'

  const [events,      setEvents]      = useState([])
  const [profiles,    setProfiles]    = useState({})
  const [rows,        setRows]        = useState([])
  const [allPriorMaps, setAllPriorMaps] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [sortBy,      setSortBy]      = useState('rank')
  const [searchTerm,  setSearchTerm]  = useState('')
  const [displayMode, setDisplayMode] = useState('list')

  // ── meta load ────────────────────────────────────────────────────────────
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

  // ── list data load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return
    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return
    const priorEventYears = EVENTS_ORDER.filter(y => y < eventYear)
    const priorEvents = priorEventYears.map(py => events.find(e => e.year === py)).filter(Boolean)

    setLoading(true); setError(null); setRows([]); setAllPriorMaps({})

    async function fetchData() {
      try {
        let mainRows = []
        if (view === 'combined') {
          const { data, error: err } = await supabase
            .from('combined_rankings')
            .select(`
              combined_rank, dustin_rank, matt_rank,
              total_score, dustin_score, matt_score, avg_rank,
              film_id,
              films (id, title, release_year, director, writer, actor_1, actor_2, actor_3, actor_4, actor_5, poster_url)
            `)
            .eq('event_id', currentEvent.id)
            .order('combined_rank')
          if (err) throw err
          mainRows = (data || []).map(r => ({
            rank: r.combined_rank, dustinRank: r.dustin_rank, mattRank: r.matt_rank,
            score: r.total_score, dustinScore: r.dustin_score, mattScore: r.matt_score, film: r.films,
          }))
          const priorResults = await Promise.all(
            priorEvents.map(async pe => {
              const { data: pd } = await supabase.from('combined_rankings')
                .select('film_id, combined_rank').eq('event_id', pe.id)
              const pm = {}
              pd?.forEach(r => { pm[r.film_id] = r.combined_rank })
              return { year: pe.year, map: pm }
            })
          )
          const maps = {}
          priorResults.forEach(r => { maps[r.year] = r.map })
          setAllPriorMaps(maps)
        } else {
          const userId = profiles[view]
          if (!userId) throw new Error(`Profile not found for ${view}`)
          const { data, error: err } = await supabase
            .from('individual_rankings')
            .select(`
              rank, total_score, score_personal_impact, film_id,
              films (id, title, release_year, director, writer, actor_1, actor_2, actor_3, actor_4, actor_5, poster_url)
            `)
            .eq('event_id', currentEvent.id)
            .eq('user_id', userId)
            .order('rank')
          if (err) throw err
          mainRows = (data || []).map(r => ({
            rank: r.rank, score: r.total_score, impact: r.score_personal_impact, film: r.films,
          }))
          const priorResults = await Promise.all(
            priorEvents.map(async pe => {
              const { data: pd } = await supabase.from('individual_rankings')
                .select('film_id, rank').eq('event_id', pe.id).eq('user_id', userId)
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

  // ── sort + search derived ───────────────────────────────────────────────
  function sortTitle(t) { return (t || '').replace(/^(the|a|an)\s+/i, '').trim() }
  const displayRows = useMemo(() => {
    if (sortBy === 'score')       return [...rows].sort((a,b) => (b.score||0) - (a.score||0))
    if (sortBy === 'year')        return [...rows].sort((a,b) => (a.film?.release_year||0) - (b.film?.release_year||0))
    if (sortBy === 'year_desc')   return [...rows].sort((a,b) => (b.film?.release_year||0) - (a.film?.release_year||0))
    if (sortBy === 'title')       return [...rows].sort((a,b) => sortTitle(a.film?.title).localeCompare(sortTitle(b.film?.title)))
    if (sortBy === 'dustin_rank' && view === 'combined') return [...rows].sort((a,b) => (a.dustinRank||999) - (b.dustinRank||999))
    if (sortBy === 'matt_rank'   && view === 'combined') return [...rows].sort((a,b) => (a.mattRank||999) - (b.mattRank||999))
    return rows
  }, [rows, sortBy, view])

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return displayRows
    return displayRows.filter(row => {
      const f = row.film
      if (!f) return false
      if (f.title?.toLowerCase().includes(term)) return true
      if (f.director?.toLowerCase().includes(term)) return true
      if (f.writer?.replace(/\s*\(.*?\)/g, '').toLowerCase().includes(term)) return true
      for (let i = 1; i <= 5; i++) if (f[`actor_${i}`]?.toLowerCase().includes(term)) return true
      return false
    })
  }, [displayRows, searchTerm])

  function setEvent(year) { setSearchParams({ event: year, view }); setSortBy('rank') }
  function setView(v)    { setSearchParams({ event: eventYear, view: v }); setSortBy('rank') }

  const priorYears = EVENTS_ORDER.filter(y => y < eventYear)
  const shortYear = y => `'${String(y).slice(2)}`

  const sortOptions = [
    { value: 'rank',      label: view === 'combined' ? 'Combined Rank' : 'Rank' },
    { value: 'year',      label: 'Release Year (Old → New)' },
    { value: 'year_desc', label: 'Release Year (New → Old)' },
    { value: 'title',     label: 'Title (A–Z)' },
    ...(view === 'combined' ? [
      { value: 'dustin_rank', label: "Dust's Rank" },
      { value: 'matt_rank',   label: "Hermz's Rank" },
    ] : []),
  ]

  const VOL = ['I', 'II', 'III', 'IV', 'V', 'VI']
  const volume = VOL[EVENTS_ORDER.indexOf(eventYear)] || ''

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <FilmStill title={`Hermz and D Films ${eventYear} ${view}`} hue={view === 'combined' ? 220 : view === 'matt' ? 36 : 234}
                 className="w-full h-[300px] sm:h-[340px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-[11px] tracking-kicker text-film-400 hover:text-film-300 transition-colors">
              ← FILMS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase">
              {eventYear} · {view === 'combined' ? 'Combined' : view === 'matt' ? 'Hermz' : 'Dust'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 mb-2.5 font-mono text-[12px] tracking-cinema uppercase text-gold-500">
            <span className="w-7 h-px bg-gold-500" />
            The Canon{volume && ` · Volume ${volume}`} · {eventYear}
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white tracking-wide leading-[0.92]">
            {rows.length} FILMS, RANKED.
          </h1>
          <p className="font-serif italic text-base sm:text-lg text-gray-400 mt-3">
            {view === 'combined' ? 'Combined' : view === 'matt' ? "Hermz's" : "Dust's"} list ·
            sortable, searchable, with rank movement.
          </p>
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {/* Event + view selectors */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {EVENTS_ORDER.map(yr => (
              <button key={yr} onClick={() => setEvent(yr)}
                className={yr === eventYear ? 'pill-film' : 'pill'}>
                {yr}
              </button>
            ))}
          </div>
          <span className="hidden sm:block w-px h-6 bg-night-700" />
          <div className="flex gap-1 p-1 bg-night-800/80 rounded-full">
            {[
              { value: 'combined', label: 'Combined' },
              { value: 'dustin',   label: "Dust's List" },
              { value: 'matt',     label: "Hermz's List" },
            ].map(opt => (
              <button key={opt.value} onClick={() => setView(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  view === opt.value
                    ? (opt.value === 'matt' ? 'bg-gold-500 text-night-950' :
                       opt.value === 'dustin' ? 'bg-film-500 text-night-950' :
                       'bg-cinema-500 text-night-950')
                    : 'text-gray-400 hover:text-white'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          <Link to={`/movies/stats?event=${eventYear}&view=${view}`} className="btn-ghost text-xs ml-auto">
            📊 Stats &amp; Charts
          </Link>
        </div>

        {/* Sort + search + display toggle */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {displayMode === 'list' && (
            <>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select text-sm pr-8">
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-night-900">{opt.label}</option>
                ))}
              </select>
              {sortBy !== 'rank' && (
                <button onClick={() => setSortBy('rank')} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  ✕ Reset sort
                </button>
              )}
            </>
          )}

          <div className={`relative ${displayMode === 'list' ? 'ml-auto' : ''}`}>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                   placeholder="Search title, director, actor…"
                   className="input text-sm py-1.5 pl-3 pr-8 w-64" />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">
                ✕
              </button>
            )}
          </div>

          <span className="font-mono text-[11px] tracking-kicker text-gray-500 flex-shrink-0">
            {searchTerm
              ? `${filteredRows.length} OF ${displayRows.length}`
              : `${displayRows.length} FILM${displayRows.length !== 1 ? 'S' : ''}`}
          </span>

          <div className={`flex gap-0.5 p-0.5 bg-night-800/80 rounded-lg ${displayMode === 'list' ? '' : 'ml-auto'}`}>
            <button onClick={() => setDisplayMode('list')} title="List view"
              className={`p-1.5 rounded-md transition-all ${
                displayMode === 'list' ? 'bg-white text-night-950' : 'text-gray-400 hover:text-gray-200'
              }`}>
              <ListViewIcon />
            </button>
            <button onClick={() => setDisplayMode('grid')} title="Grid view"
              className={`p-1.5 rounded-md transition-all ${
                displayMode === 'grid' ? 'bg-white text-night-950' : 'text-gray-400 hover:text-gray-200'
              }`}>
              <GridViewIcon />
            </button>
          </div>
        </div>

        {loading && (
          <div className="py-16 flex items-center justify-center">
            <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">
              LOADING {eventYear} RANKINGS…
            </span>
          </div>
        )}
        {error && <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>}

        {!loading && !error && displayRows.length > 0 && filteredRows.length === 0 && (
          <div className="py-16 text-center text-gray-500 text-sm">
            No films match <span className="font-semibold text-gray-300">"{searchTerm}"</span>
            <button onClick={() => setSearchTerm('')} className="ml-2 underline hover:text-gray-300">Clear</button>
          </div>
        )}

        {/* GRID VIEW */}
        {!loading && !error && filteredRows.length > 0 && displayMode === 'grid' && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {filteredRows.map(row => {
              const f = row.film
              if (!f) return null
              const latestPrior = priorYears[priorYears.length - 1]
              const priorRank   = latestPrior ? allPriorMaps[latestPrior]?.[f.id] : undefined
              const move        = (priorRank == null) ? null : priorRank - row.rank
              return (
                <Link key={f.id} to={`/movies/${f.id}`} state={{ from: location.pathname + location.search }}
                      className="group block">
                  <FilmStill src={f.poster_url} title={f.title}
                             className="aspect-[2/3] rounded-lg border border-white/10 shadow-still
                                        group-hover:border-gold-500/60 group-hover:scale-[1.02] transition-all">
                    {/* Rank badge */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className="inline-flex items-center justify-center min-w-[34px] h-[34px] px-1.5 rounded-full
                                       bg-night-950/85 backdrop-blur-sm font-display text-xl leading-none tracking-wide"
                            style={{ color: view === 'combined' ? '#00E0D9' : 'white' }}>
                        {row.rank}
                      </span>
                    </div>
                    {/* Movement badge */}
                    {move != null && move !== 0 && (
                      <div className="absolute top-2.5 right-2.5 z-10 font-mono text-[12px] font-semibold px-1.5 py-0.5
                                      rounded bg-night-950/80 backdrop-blur-sm"
                           style={{ color: move > 0 ? '#5fd66b' : '#f87171' }}>
                        {move > 0 ? `↑${move}` : `↓${Math.abs(move)}`}
                      </div>
                    )}
                    {/* Title + score overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-3 pointer-events-none"
                         style={{ background: 'linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.92) 100%)' }}>
                      <div className="font-display text-[17px] text-white tracking-wide leading-tight line-clamp-2">
                        {f.title?.toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {f.release_year && (
                          <span className="font-mono text-[11px] tracking-kicker text-white/55">{f.release_year}</span>
                        )}
                        {row.score != null && (
                          <span className="font-mono text-[12px] tracking-kicker text-gold-400 ml-auto">{row.score} PTS</span>
                        )}
                      </div>
                    </div>
                  </FilmStill>
                </Link>
              )
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && !error && filteredRows.length > 0 && displayMode === 'list' && (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="table-header w-14 text-center">#</th>
                    <th className="table-header">Film</th>
                    {view === 'combined' ? (
                      <>
                        <th className="table-header text-center hidden lg:table-cell" style={{ color: DC }}>Dust</th>
                        <th className="table-header text-center hidden lg:table-cell" style={{ color: HC }}>Hermz</th>
                        <th className="table-header text-center">Score</th>
                      </>
                    ) : (
                      <th className="table-header text-center">Score</th>
                    )}
                    {[...priorYears].reverse().map(py => (
                      <th key={py} className="table-header text-center hidden md:table-cell w-20">
                        vs {shortYear(py)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => {
                    const f = row.film
                    if (!f) return null
                    return (
                      <tr key={f.id} className="table-row-hover">
                        <td className="table-cell text-center">
                          <span className="font-display text-3xl leading-none tracking-wide"
                                style={{ color: view === 'combined' ? CC : 'white' }}>{row.rank}</span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <FilmStill src={f.poster_url} title={f.title}
                                       className="w-14 h-20 rounded border border-white/10 flex-shrink-0" />
                            <div className="min-w-0">
                              <Link to={`/movies/${f.id}`} state={{ from: location.pathname + location.search }}
                                    className="text-lg font-semibold text-white hover:text-film-400 transition-colors leading-snug block truncate">
                                {f.title}
                              </Link>
                              <div className="font-mono text-xs tracking-kicker text-gray-500 mt-1 flex items-center gap-2 flex-wrap uppercase">
                                {f.release_year && <span>{f.release_year}</span>}
                                {f.director && (
                                  <>
                                    <span className="text-gray-700">·</span>
                                    <span className="truncate">{f.director.split(',')[0].trim()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        {view === 'combined' ? (
                          <>
                            <td className="table-cell text-center hidden lg:table-cell">
                              <div className="flex flex-col items-center">
                                <span className="font-mono text-base font-semibold" style={{ color: DC }}>
                                  #{row.dustinRank ?? '—'}
                                </span>
                                <span className="text-sm text-gray-500">{row.dustinScore ?? '—'} pts</span>
                              </div>
                            </td>
                            <td className="table-cell text-center hidden lg:table-cell">
                              <div className="flex flex-col items-center">
                                <span className="font-mono text-base font-semibold" style={{ color: HC }}>
                                  #{row.mattRank ?? '—'}
                                </span>
                                <span className="text-sm text-gray-500">{row.mattScore ?? '—'} pts</span>
                              </div>
                            </td>
                            <td className="table-cell text-center">
                              <span className="font-display text-2xl text-white tracking-wide">{row.score ?? '—'}</span>
                            </td>
                          </>
                        ) : (
                          <td className="table-cell text-center">
                            <span className="font-display text-xl text-white tracking-wide">{row.score ?? '—'}</span>
                          </td>
                        )}
                        {[...priorYears].reverse().map(py => (
                          <PriorYearCell key={py} currentRank={row.rank} filmId={f.id} priorMap={allPriorMaps[py]} />
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
