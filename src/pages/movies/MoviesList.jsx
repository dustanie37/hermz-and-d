import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FilmStill from '../../components/FilmStill'
import { DC, HC, CC, sortTitle } from '../../lib/helpers'
import { useEventState } from '../../lib/useEventState'

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

// Edition years come from ranking_events (published) — see `events` state (12g refactor)

// ── Rank Trajectory sparkline ──────────────────────────────────────────────
// Replaces the old per-edition "vs 'YY" columns with ONE column: a sparkline of a
// film's rank across every edition up to the one being viewed. Number rail = the
// exact ranks; gold enlarged dot = current edition; hollow dot = not ranked that
// edition. Hover any dot for that edition's rank + the move into it (no mental math).
const TRAJ_PAD_X = 16
const TRAJ_GAP   = 46
const trajWidth  = n => TRAJ_PAD_X * 2 + Math.max(n - 1, 0) * TRAJ_GAP
const trajX      = (i, n, w) => (n <= 1 ? w / 2 : TRAJ_PAD_X + (w - TRAJ_PAD_X * 2) * i / (n - 1))

// Move INTO edition i, measured against the previous edition the film was ranked in.
function rankMove(ranks, i) {
  const r = ranks[i]
  if (r == null) return { kind: 'nr' }
  let prev = null
  for (let j = i - 1; j >= 0; j--) { if (ranks[j] != null) { prev = ranks[j]; break } }
  if (prev == null) return { kind: 'new' }
  const diff = prev - r                       // + = climbed toward #1
  return { kind: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same', diff }
}

// Current-edition move, shown as a compact tag beside the sparkline.
function MoveTag({ ranks }) {
  const m = rankMove(ranks, ranks.length - 1)
  if (m.kind === 'nr')   return <span className="font-mono text-xs rank-same">—</span>
  if (m.kind === 'new')  return <span className="font-mono text-xs" style={{ color: '#fcd34d' }}>★</span>
  if (m.kind === 'up')   return <span className="font-mono text-xs rank-up">▴{m.diff}</span>
  if (m.kind === 'down') return <span className="font-mono text-xs rank-down">▾{Math.abs(m.diff)}</span>
  return <span className="font-mono text-xs rank-same">●</span>
}

function TrajectorySparkline({ ranks, years, color }) {
  const [active, setActive] = useState(null)   // { i, x, y }
  const n = ranks.length
  const w = trajWidth(n)
  const H = 56, PAD_TOP = 8, LINE_H = 22, BASE_Y = 36, RAIL_Y = 50
  const present = ranks.filter(r => r != null)
  const maxR = Math.max(...present, 2)
  const X = i => trajX(i, n, w)
  const Y = r => PAD_TOP + LINE_H * ((r - 1) / Math.max(maxR - 1, 1))
  const linePts = ranks.map((r, i) => (r == null ? null : `${X(i)},${Y(r)}`)).filter(Boolean)

  let tip = null
  if (active != null) {
    const i = active.i, r = ranks[i], m = rankMove(ranks, i)
    const moveEl =
      m.kind === 'nr'   ? <span className="rank-same">not ranked</span> :
      m.kind === 'new'  ? <span style={{ color: '#fcd34d' }}>★ first ranked</span> :
      m.kind === 'up'   ? <span className="rank-up">▴ {m.diff} · climbed</span> :
      m.kind === 'down' ? <span className="rank-down">▾ {Math.abs(m.diff)} · fell</span> :
                          <span className="rank-same">● held</span>
    const left = Math.min(active.x + 14, window.innerWidth - 150)
    const top  = Math.min(active.y + 14, window.innerHeight - 96)
    tip = createPortal(
      <div style={{ position: 'fixed', left, top, zIndex: 80, pointerEvents: 'none', borderLeft: `3px solid ${color}` }}
           className="bg-night-900 border border-night-600 rounded-lg shadow-2xl px-3 py-2 min-w-[110px]">
        <div className="font-mono text-xs tracking-kicker text-gray-400 uppercase">{years[i]} Edition</div>
        <div className="font-display text-2xl leading-none text-white my-1">
          {r == null ? <span className="text-gray-500">NR</span> : `#${r}`}
        </div>
        <div className="font-mono text-xs font-semibold">{moveEl}</div>
      </div>, document.body)
  }

  return (
    <div className="relative inline-flex">
      <svg width={w} height={H} className="overflow-visible"
           onMouseMove={e => active != null && setActive(a => (a ? { ...a, x: e.clientX, y: e.clientY } : a))}
           onMouseLeave={() => setActive(null)}>
        <line x1={TRAJ_PAD_X} y1={BASE_Y} x2={w - TRAJ_PAD_X} y2={BASE_Y} stroke="#26263c" strokeWidth="1" />
        {linePts.length > 1 && (
          <polyline points={linePts.join(' ')} fill="none" stroke={color} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
        )}
        {ranks.map((r, i) => {
          const cur = i === n - 1
          if (r == null) return <circle key={`d${i}`} cx={X(i)} cy={BASE_Y} r="3" fill="none" stroke="#3a3a55" strokeWidth="1.5" />
          if (cur)       return <circle key={`d${i}`} cx={X(i)} cy={Y(r)} r="4.5" fill="#fbbf24" stroke="#0a0a0f" strokeWidth="1" />
          return <circle key={`d${i}`} cx={X(i)} cy={Y(r)} r="2.6" fill={color} />
        })}
        {ranks.map((r, i) => {
          const cur = i === n - 1
          const fill = r == null ? '#9ca3af' : cur ? '#fbbf24' : '#e5e7eb'
          return (
            <text key={`t${i}`} x={X(i)} y={RAIL_Y} textAnchor="middle"
                  fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="600" fill={fill}>
              {r == null ? '—' : r}
            </text>
          )
        })}
        {ranks.map((r, i) => (
          <circle key={`h${i}`} cx={X(i)} cy={r == null ? BASE_Y : Y(r)} r="12" fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => setActive({ i, x: e.clientX, y: e.clientY })}
                  onClick={e => setActive(a => (a && a.i === i ? null : { i, x: e.clientX, y: e.clientY }))} />
        ))}
      </svg>
      {tip}
    </div>
  )
}

// ── main component ──────────────────────────────────────────────────────────
export default function MoviesList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { blackout } = useEventState()

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
        supabase.from('ranking_events').select('id,year,label').eq('status', 'published').order('year'),
        supabase.from('profiles').select('id,username'),
      ])
      setEvents(evData || [])
      const profMap = {}
      profData?.forEach(p => { profMap[p.username] = p.id })
      setProfiles(profMap)
    }
    loadMeta()
  }, [])

  // ── edition years derived from the DB (12g) ──────────────────────────────
  const eventYears = events.map(e => e.year)                      // ascending
  const latestYear = eventYears[eventYears.length - 1] ?? null
  const eventYear  = Number(searchParams.get('event')) || latestYear

  // ── list data load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return
    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return
    const priorEventYears = eventYears.filter(y => y < eventYear)
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

  const priorYears = eventYears.filter(y => y < eventYear)
  const trajYears  = eventYears.filter(y => y <= eventYear)   // ascending, includes current edition
  const showTraj   = priorYears.length > 0                    // nothing to trace on the earliest edition
  const lineColor  = view === 'combined' ? CC : view === 'matt' ? HC : DC

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

  // ── blackout (Phase 12d): while THIS player is scoring, prior-edition
  // rankings stay dark for them — no anchoring, no peeking ─────────────────
  if (blackout) {
    return (
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-24 text-center space-y-5">
        <p className="font-display text-6xl text-gray-700 leading-none">🎬</p>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none">THE VAULT IS SEALED</h1>
        <p className="font-sans text-base text-gray-300 max-w-md mx-auto">
          You're mid-scoring — past rankings stay hidden so every film gets judged fresh.
          They return the moment your list is locked.
        </p>
        <Link to="/movies/score" className="btn-gold text-sm inline-block">Back to Scoring →</Link>
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      {(() => {
        const heroHue    = view === 'combined' ? 178 : view === 'matt' ? 36 : 234
        const accentText = view === 'combined' ? 'text-cinema-400' : view === 'matt' ? 'text-gold-500' : 'text-film-400'
        const accentBg   = view === 'combined' ? 'bg-cinema-400'   : view === 'matt' ? 'bg-gold-500'   : 'bg-film-400'
        // Beam colors keyed to view accent
        return (
          <FilmStill title={`Hermz and D Films ${eventYear} ${view}`} hue={heroHue}
                     className="w-full h-[300px] sm:h-[340px]">

            {/* ── Film projector photo (Jason Dent / Unsplash) — desktop only ── */}
            <div className="absolute pointer-events-none hidden sm:block"
                 style={{ right: 0, top: 0, width: '52%', height: '100%', overflow: 'hidden' }}>
              <img
                src="https://images.unsplash.com/photo-1568876694728-451bbf694b83?fm=jpg&q=85&w=900&auto=format&fit=crop"
                alt=""
                style={{
                  position: 'absolute',
                  right: '-5%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '100%',
                  height: '130%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  mixBlendMode: 'screen',
                  opacity: 0.52,
                  filter: 'grayscale(1) contrast(1.3) brightness(0.85)',
                }}
              />
            </div>

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
              <div className={`flex items-center gap-2.5 mb-3 font-mono text-[12px] tracking-cinema uppercase ${accentText}`}>
                <span className={`w-7 h-px ${accentBg}`} />
                The Canon
              </div>
              <div className="flex items-baseline gap-4 sm:gap-5">
                <h1 className={`font-display text-6xl sm:text-7xl lg:text-8xl tracking-wide leading-[0.9] ${accentText}`}>
                  {eventYear}
                </h1>
                <span className="font-display text-6xl sm:text-7xl lg:text-8xl text-white tracking-wide leading-[0.9]">
                  EDITION
                </span>
              </div>
              <p className="font-sans text-base sm:text-lg text-gray-400 mt-3">
                {view === 'combined' ? 'Combined' : view === 'matt' ? "Hermz's" : "Dust's"} list ·
                {rows.length} films · sortable, searchable, with rank movement.
              </p>
            </div>
          </FilmStill>
        )
      })()}

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {/* Event + view selectors */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {eventYears.map(yr => (
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
                    {/* Score overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-3 pointer-events-none"
                         style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.85) 100%)' }}>
                      <div className="flex items-center gap-2">
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
                    {showTraj && (
                      <th className="table-header">
                        <div className="flex flex-col items-start gap-1">
                          <span>Trajectory</span>
                          <svg width={trajWidth(trajYears.length)} height="14" className="overflow-visible">
                            {trajYears.map((y, i) => (
                              <text key={y} x={trajX(i, trajYears.length, trajWidth(trajYears.length))} y="11"
                                    textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12"
                                    fill="#9ca3af" letterSpacing="0.5">&apos;{String(y).slice(2)}</text>
                            ))}
                          </svg>
                        </div>
                      </th>
                    )}
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
                        {showTraj && (() => {
                          const trajRanks = trajYears.map(y =>
                            y === eventYear ? row.rank : (allPriorMaps[y]?.[f.id] ?? null))
                          return (
                            <td className="table-cell">
                              <div className="inline-flex items-center gap-2">
                                <TrajectorySparkline ranks={trajRanks} years={trajYears} color={lineColor} />
                                <MoveTag ranks={trajRanks} />
                              </div>
                            </td>
                          )
                        })()}
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
