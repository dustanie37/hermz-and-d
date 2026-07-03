import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FilmStill from '../../components/FilmStill'
import { DC, HC, CC } from '../../lib/helpers'

// ── list definitions ──────────────────────────────────────────────────────────

const LISTS = [
  { key: 'afi_top100',       label: 'AFI Top 100',            published: '2007',              ranked: true,  hue: 14  },
  { key: 'afi_comedies',     label: 'AFI Comedies',           published: '2000',              ranked: true,  hue: 44  },
  { key: 'imdb_top250',      label: 'IMDB Top 250',           published: 'December 31, 2025', ranked: true,  hue: 48  },
  { key: 'nyt_2000s',        label: 'NYT Best of 2000s',      published: 'June 23, 2025',     ranked: true,  hue: 8   },
  { key: 'sight_sound',      label: 'Sight & Sound',          published: '2022',              ranked: true,  hue: 220 },
  { key: 'variety_comedies', label: 'Variety Comedies',       published: '2026',              ranked: true,  hue: 280 },
  { key: 'nfr',              label: 'National Film Registry', published: 'January 29, 2026',  ranked: false, hue: 200 },
]

const EVENTS = [2001, 2007, 2016, 2026]

// ── sub-components ────────────────────────────────────────────────────────────

function EventDots({ rankMap = {} }) {
  return (
    <div className="flex gap-1.5 items-center justify-center">
      {EVENTS.map(yr => {
        const rank = rankMap[yr]
        const on   = rank != null
        return (
          <span
            key={yr}
            title={on ? `#${rank} in ${yr}` : `Not on ${yr} list`}
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
              on ? 'bg-film-500' : 'bg-night-600'
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
  const activeList = LISTS.find(l => l.key === activeKey) || LISTS[0]

  const [combMap,     setCombMap]     = useState({})
  const [indivMap,    setIndivMap]    = useState({})
  const [combLoading, setCombLoading] = useState(true)

  const [entries,    setEntries]    = useState([])
  const [tabLoading, setTabLoading] = useState(true)
  const [error,      setError]      = useState(null)

  const [search,   setSearch]   = useState('')
  const [inDbOnly, setInDbOnly] = useState(false)

  useEffect(() => {
    async function fetchRankings() {
      const [
        { data: combinedData },
        { data: indivData },
        { data: eventsData },
        { data: profData },
      ] = await Promise.all([
        supabase.from('combined_rankings').select('film_id, event_id, combined_rank'),
        supabase.from('individual_rankings').select('film_id, event_id, user_id, rank'),
        supabase.from('ranking_events').select('id, year'),
        supabase.from('profiles').select('id, username'),
      ])
      const eventYearMap = {}
      eventsData?.forEach(e => { eventYearMap[e.id] = e.year })
      const profileMap = {}
      profData?.forEach(p => { profileMap[p.id] = p.username })

      const cm = {}
      combinedData?.forEach(r => {
        if (!cm[r.film_id]) cm[r.film_id] = {}
        cm[r.film_id][eventYearMap[r.event_id]] = r.combined_rank
      })
      const im = {}
      indivData?.forEach(r => {
        const username = profileMap[r.user_id]
        if (!username) return
        if (!im[r.film_id]) im[r.film_id] = {}
        if (!im[r.film_id][username]) im[r.film_id][username] = {}
        im[r.film_id][username][eventYearMap[r.event_id]] = r.rank
      })

      setCombMap(cm); setIndivMap(im); setCombLoading(false)
    }
    fetchRankings()
  }, [])

  useEffect(() => {
    setTabLoading(true); setError(null); setEntries([])
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
      const sorted = listConfig?.ranked
        ? (data || [])
        : (data || []).sort((a, b) =>
            (a.films?.title || a.title).localeCompare(b.films?.title || b.title))
      setEntries(sorted); setTabLoading(false)
    }
    fetchEntries()
  }, [activeKey])

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

  const inDbCount  = useMemo(() => entries.filter(e => e.film_id != null).length, [entries])
  const totalCount = entries.length
  const loading = combLoading || tabLoading

  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <FilmStill
        title={`Hermz and D External List ${activeList.label}`}
        hue={activeList.hue}
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
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase">External Lists</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            CRITICS' CANONS
          </h1>
          <p className="font-serif italic text-base text-gray-400 mt-3">
            Acclaimed external rankings and how they overlap with ours.
          </p>
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {LISTS.map(l => (
            <button
              key={l.key}
              onClick={() => { setSearchParams({ list: l.key }); setSearch(''); setInDbOnly(false) }}
              className={l.key === activeKey ? 'pill-active' : 'pill'}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* List header + search */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-3xl text-white tracking-wide leading-none">
              {activeList.label.toUpperCase()}
            </h2>
            <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">
              Published {activeList.published}
            </p>
            {!loading && (
              <p className="font-sans text-sm text-gray-400 mt-1.5">
                {search
                  ? `${displayEntries.length} of ${totalCount} matching "${search}"`
                  : (
                    <>
                      {totalCount} film{totalCount !== 1 ? 's' : ''}
                      <span className="mx-1.5 text-gray-700">·</span>
                      <span className="text-film-400">{inDbCount} in our database</span>
                      {totalCount - inDbCount > 0 && (
                        <span className="text-gray-500 ml-1.5">· {totalCount - inDbCount} not yet added</span>
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
              className={inDbOnly ? 'pill-film' : 'pill'}
            >
              In our DB
            </button>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by title or director…"
                className="input text-sm py-1.5 pl-3 pr-8 w-56"
              />
              {search && (
                <button onClick={() => setSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dot legend */}
        <div className="flex items-center gap-2 mb-4 font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
          <span className="flex gap-1.5">
            {EVENTS.map(yr => <span key={yr} className="w-1.5 h-1.5 rounded-full bg-film-500 inline-block" />)}
          </span>
          Each dot = one edition · {EVENTS.map(yr => `'${String(yr).slice(2)}`).join(' · ')}
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="py-16 flex items-center justify-center">
            <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING LIST…</span>
          </div>
        )}
        {error && <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>}

        {/* Table */}
        {!loading && !error && (
          <div className="card p-0 overflow-hidden">
            {displayEntries.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                {search ? `No films match "${search}".` : 'No entries for this list yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr>
                      <th className="table-header w-12 text-center">#</th>
                      <th className="table-header">Film</th>
                      <th className="table-header text-center w-16">Acclaim</th>
                      <th className="table-header text-center w-20" style={{ color: CC }}>Combined</th>
                      <th className="table-header text-center w-20" style={{ color: DC }}>Dust</th>
                      <th className="table-header text-center w-20" style={{ color: HC }}>Hermz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayEntries.map((entry, i) => {
                      const film    = entry.films
                      const inDb    = film != null
                      const title   = film?.title || entry.title
                      const year    = film?.release_year || entry.year
                      const director = film?.director || null
                      return (
                        <tr key={entry.id} className={`table-row-hover ${!inDb ? 'opacity-60' : ''}`}>
                          <td className="table-cell text-center">
                            <span className="font-display text-xl text-gray-500 tracking-wide tabular-nums leading-none">
                              {entry.rank ?? i + 1}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <FilmStill src={inDb ? film.poster_url : null} title={title}
                                         className="w-10 h-14 rounded border border-white/10 flex-shrink-0" />
                              <div className="min-w-0">
                                {inDb ? (
                                  <Link to={`/movies/${film.id}`}
                                    className="text-sm font-semibold text-white hover:text-film-400 transition-colors leading-snug block truncate">
                                    {title}
                                  </Link>
                                ) : (
                                  <span className="text-sm font-semibold text-gray-300 leading-snug block truncate">{title}</span>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
                                    {year}
                                    {director && <> · {director.split(',')[0].trim()}</>}
                                  </span>
                                  {!inDb && (
                                    <span className="font-mono text-[9px] tracking-cinema px-1.5 py-px rounded
                                                     bg-night-700 text-gray-400 border border-night-600 uppercase">
                                      Not in DB
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            {inDb && film.acclaim_score != null ? (
                              <span className="font-display text-xl text-gold-400 tracking-wide tabular-nums leading-none">
                                {film.acclaim_score}
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-gray-700">—</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <EventDots rankMap={inDb ? (combMap[film.id] || {}) : {}} />
                          </td>
                          <td className="table-cell">
                            <EventDots rankMap={inDb ? (indivMap[film.id]?.dustin || {}) : {}} />
                          </td>
                          <td className="table-cell">
                            <EventDots rankMap={inDb ? (indivMap[film.id]?.matt || {}) : {}} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
