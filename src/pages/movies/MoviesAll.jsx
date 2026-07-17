import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FilmStill from '../../components/FilmStill'
import { DC, HC, CC, sortTitle } from '../../lib/helpers'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS = [2001, 2007, 2016, 2026]

// ── sort helpers ──────────────────────────────────────────────────────────────

function defaultDir(_key) { return 'asc' }

function rankCmp(ra, rb, dir) {
  if (ra == null && rb == null) return 0
  if (ra == null) return 1
  if (rb == null) return -1
  return dir === 'asc' ? ra - rb : rb - ra
}

function appearances(filmId, combMap) {
  return Object.keys(combMap[filmId] || {}).length
}

// ── sub-components ────────────────────────────────────────────────────────────

function SortTh({ sortKey: key, currentKey, dir, onSort, children, className = '', style = {} }) {
  const active = currentKey === key
  return (
    <th
      onClick={() => onSort(key)}
      className={`table-header cursor-pointer select-none transition-colors relative
                  hover:bg-night-700/60 ${className}`}
      style={style}
    >
      <div className="flex items-center justify-center whitespace-nowrap">{children}</div>
      {active && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-cinema-400">
          {dir === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </th>
  )
}

function FilmSortTh({ sortKey: key, currentKey, dir, onSort }) {
  const active = currentKey === key
  return (
    <th
      onClick={() => onSort(key)}
      className="table-header cursor-pointer select-none transition-colors
                 hover:bg-night-700/60
                 sticky left-0 z-10 bg-night-900/90 backdrop-blur-sm min-w-56 text-left"
    >
      <span className="flex items-center gap-1.5">
        Film
        {active && (
          <span className="text-[10px] text-cinema-400">{dir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )
}

function RankCell({ rank, variant = 'combined', className = '' }) {
  if (rank == null) {
    return (
      <td className={`table-cell text-center px-1 py-3 ${className}`}>
        <span className="font-mono text-[10px] tracking-kicker text-gray-700">NR</span>
      </td>
    )
  }
  const color = variant === 'combined' ? CC
              : variant === 'dustin'   ? DC
              :                          HC
  return (
    <td className={`table-cell text-center px-1 py-3 ${className}`}>
      <span
        className="font-display text-lg leading-none tracking-wide tabular-nums text-white"
        style={color ? { color } : undefined}
      >
        {rank}
      </span>
    </td>
  )
}

function AppearanceDots({ filmId, combMap }) {
  return (
    <div className="flex gap-1 mt-1.5">
      {EVENTS.map(yr => {
        const rank = combMap[filmId]?.[yr]
        const on   = rank != null
        return (
          <span
            key={yr}
            title={on ? `#${rank} combined in ${yr}` : `NR in ${yr}`}
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on ? 'bg-film-500' : 'bg-night-600'}`}
          />
        )
      })}
    </div>
  )
}

function ToggleBtn({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? 'text-night-950 border-transparent'
          : 'border-night-600 text-gray-400 hover:border-gray-500 hover:text-gray-200'
      }`}
      style={active ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesAll() {
  const [films, setFilms]       = useState([])
  const [combMap, setCombMap]   = useState({})
  const [indivMap, setIndivMap] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [showCombined, setShowCombined] = useState(true)
  const [showDust,     setShowDust]     = useState(true)
  const [showMatt,     setShowMatt]     = useState(true)

  const [search,  setSearch]  = useState('')
  const [sortKey, setSortKey] = useState('title')
  const [sortDir, setSortDir] = useState('asc')

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
            .select('id, title, release_year, director, writer, actor_1, actor_2, actor_3, actor_4, actor_5, actor_6, actor_7, actor_8, actor_9, actor_10, poster_url')
            .order('title'),
          supabase.from('combined_rankings').select('film_id, event_id, combined_rank'),
          supabase.from('individual_rankings').select('film_id, event_id, user_id, rank'),
          supabase.from('ranking_events').select('id, year').eq('status', 'published'),
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

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(defaultDir(key)) }
  }

  const displayFilms = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? films.filter(f => {
          if (f.title?.toLowerCase().includes(q)) return true
          if (f.director?.toLowerCase().includes(q)) return true
          if (f.writer?.replace(/\s*\(.*?\)/g, '').toLowerCase().includes(q)) return true
          for (let i = 1; i <= 5; i++) if (f[`actor_${i}`]?.toLowerCase().includes(q)) return true
          return false
        })
      : films

    return [...filtered].sort((a, b) => {
      if (sortKey === 'title') {
        const cmp = sortTitle(a.title).localeCompare(sortTitle(b.title))
        return sortDir === 'asc' ? cmp : -cmp
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

  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <FilmStill
        title="Hermz and D All Films"
        hue={220}
        mood="cool"
        className="w-full h-[300px] sm:h-[340px]"
      >
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-[11px] tracking-kicker text-film-400 hover:text-film-300 transition-colors">
              ← FILMS
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase">All Films</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            THE ARCHIVE
          </h1>
          <p className="font-sans text-base text-gray-300 mt-3">
            {loading
              ? 'Cataloguing the canon…'
              : `${films.length} films in the database · ${totalOnAny} on at least one combined list`}
          </p>
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative">
            <input
              type="text"
              placeholder="Search title, director, actor, writer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input text-sm w-72 pr-8"
            />
            {search && (
              <button onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-kicker text-gray-500 mr-1">SHOW</span>
            <ToggleBtn active={showCombined} color="#fff"   onClick={() => setShowCombined(v => !v)}>Combined</ToggleBtn>
            <ToggleBtn active={showDust}     color={DC}     onClick={() => setShowDust(v => !v)}>Dust</ToggleBtn>
            <ToggleBtn active={showMatt}     color={HC}     onClick={() => setShowMatt(v => !v)}>Hermz</ToggleBtn>
          </div>

          <span className="ml-auto font-mono text-[10px] tracking-kicker text-gray-500">
            {displayFilms.length} FILM{displayFilms.length !== 1 ? 'S' : ''}
            {search && ` · MATCHING "${search.toUpperCase()}"`}
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mb-4 font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
          <span className="flex gap-1">
            {[true, true, false, false].map((on, i) =>
              <span key={i} className={`w-1.5 h-1.5 rounded-full inline-block ${on ? 'bg-film-500' : 'bg-night-600'}`} />
            )}
          </span>
          Combined list appearances · '01 · '07 · '16 · '26
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="py-16 flex items-center justify-center">
            <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING ARCHIVE…</span>
          </div>
        )}
        {error && <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>}

        {/* Table */}
        {!loading && !error && (
          <div className="card p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <FilmSortTh sortKey="title" {...sharedSortProps} />
                  {showCombined && EVENTS.map(yr => (
                    <SortTh key={`c-hdr-${yr}`} sortKey={`c_${yr}`} {...sharedSortProps}
                      className="w-12 text-center text-white">
                      C{sy(yr)}
                    </SortTh>
                  ))}
                  {showDust && EVENTS.map((yr, i) => (
                    <SortTh key={`d-hdr-${yr}`} sortKey={`d_${yr}`} {...sharedSortProps}
                      className={`w-12 text-center ${i === 0 ? 'border-l border-night-700' : ''}`}
                      style={{ color: DC }}>
                      D{sy(yr)}
                    </SortTh>
                  ))}
                  {showMatt && EVENTS.map((yr, i) => (
                    <SortTh key={`h-hdr-${yr}`} sortKey={`h_${yr}`} {...sharedSortProps}
                      className={`w-12 text-center ${i === 0 ? 'border-l border-night-700' : ''}`}
                      style={{ color: HC }}>
                      H{sy(yr)}
                    </SortTh>
                  ))}
                </tr>
              </thead>

              <tbody>
                {displayFilms.map(film => (
                  <tr key={film.id} className="table-row-hover group">
                    <td className="table-cell sticky left-0 z-10
                                   bg-night-800 group-hover:bg-night-700/70 transition-colors
                                   min-w-56 max-w-sm">
                      <div className="flex items-center gap-3">
                        <FilmStill src={film.poster_url} title={film.title}
                                   className="w-10 h-14 rounded border border-white/10 flex-shrink-0" />
                        <div className="min-w-0">
                          <Link
                            to={`/movies/${film.id}`}
                            className="text-sm font-semibold text-white hover:text-film-400
                                       transition-colors leading-snug block truncate"
                          >
                            {film.title}
                          </Link>
                          <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1 uppercase flex items-center gap-2">
                            {film.release_year && <span>{film.release_year}</span>}
                            {film.director && (
                              <>
                                <span className="text-gray-700">·</span>
                                <span className="truncate">{film.director.split(',')[0].trim()}</span>
                              </>
                            )}
                          </div>
                          <AppearanceDots filmId={film.id} combMap={combMap} />
                        </div>
                      </div>
                    </td>
                    {showCombined && EVENTS.map(yr => (
                      <RankCell key={`c-${yr}`} rank={combMap[film.id]?.[yr]} variant="combined" />
                    ))}
                    {showDust && EVENTS.map((yr, i) => (
                      <RankCell key={`d-${yr}`} rank={indivMap[film.id]?.dustin?.[yr]} variant="dustin"
                        className={i === 0 ? 'border-l border-night-700/50' : ''} />
                    ))}
                    {showMatt && EVENTS.map((yr, i) => (
                      <RankCell key={`h-${yr}`} rank={indivMap[film.id]?.matt?.[yr]} variant="matt"
                        className={i === 0 ? 'border-l border-night-700/50' : ''} />
                    ))}
                  </tr>
                ))}

                {displayFilms.length === 0 && (
                  <tr>
                    <td colSpan={99} className="py-12 text-center text-gray-500 text-sm">
                      No films match <span className="text-gray-300">&ldquo;{search}&rdquo;</span>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
