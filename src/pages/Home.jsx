import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import OscarIcon from '../components/OscarIcon'
import FilmStill, { StillPoster } from '../components/FilmStill'

function computeLeader(mattWins, dustinWins) {
  if (mattWins > dustinWins) return { who: 'matt',   lead: mattWins - dustinWins }
  if (dustinWins > mattWins) return { who: 'dustin', lead: dustinWins - mattWins }
  return { who: null, lead: 0 }
}

export default function Home() {
  const { isAuthenticated } = useAuth()

  const [oscarData,  setOscarData]  = useState(null)
  const [moviesData, setMoviesData] = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!isAuthenticated) return
    fetchData()
  }, [isAuthenticated])

  async function fetchData() {
    const [
      { data: years },
      { data: events },
      { count: filmCount },
    ] = await Promise.all([
      supabase.from('v_oscar_year_summary').select('*').order('year', { ascending: false }),
      supabase.from('ranking_events').select('id, year, label').eq('status', 'published').order('year', { ascending: false }),
      supabase.from('films').select('*', { count: 'exact', head: true }),
    ])

    const latestEvent = events?.[0]
    let topFilms = []
    if (latestEvent) {
      const { data: tops } = await supabase
        .from('combined_rankings')
        .select('combined_rank, films(id, title, poster_url, release_year, director)')
        .eq('event_id', latestEvent.id)
        .lte('combined_rank', 6)
        .order('combined_rank', { ascending: true })
      topFilms = (tops || []).map(t => ({ rank: t.combined_rank, ...t.films }))
    }

    const complete   = (years || []).filter(y => y.status !== 'upcoming')
    const upcoming   = (years || []).find(y => y.status === 'upcoming')
    const mattWins   = complete.filter(y => y.winner === 'matt').length
    const dustinWins = complete.filter(y => y.winner === 'dustin').length
    const mostRecent = complete[0]
    const mattTotal   = complete.reduce((s, y) => s + (y.matt_correct   || 0), 0)
    const dustinTotal = complete.reduce((s, y) => s + (y.dustin_correct || 0), 0)

    setOscarData({ complete, upcoming, mattWins, dustinWins, mattTotal, dustinTotal, mostRecent })
    setMoviesData({ events: events || [], filmCount: filmCount || 0, latestEvent, topFilms })
    setLoading(false)
  }

  const leader = oscarData ? computeLeader(oscarData.mattWins, oscarData.dustinWins) : null
  const live   = oscarData?.upcoming || (oscarData?.mostRecent?.tiebreaker_used
    ? oscarData.mostRecent : null)

  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative">
        <FilmStill
          title="Hermz and D Home"
          mood="warm"
          hue={28}
          className="w-full h-[300px] sm:h-[340px]"
        >
          <div className="absolute inset-0 scrim-bottom" />

          {live && (
            <div className="absolute top-6 right-6 sm:right-10 px-3 py-2 rounded-xl
                            bg-night-950/55 backdrop-blur-md border border-white/[0.08]
                            flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-cinema-500 shadow-[0_0_12px_var(--tw-shadow-color)] shadow-cinema-500" />
              <span className="font-mono text-[11px] tracking-kicker text-white">
                {live.year} · {live.winner ? `${live.winner === 'matt' ? 'Hermz' : 'Dust'} wins` : 'In progress'}
                {live.tiebreaker_used && ' by tiebreaker'}
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-8 sm:pb-10 z-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="block w-7 h-px bg-gray-400" />
              <span className="font-mono text-[11px] tracking-cinema uppercase text-gray-400">
                Established 1993 · {oscarData?.complete.length ?? '—'} Seasons
              </span>
            </div>
            <h1 className="font-display text-[12vw] sm:text-[8vw] lg:text-[110px] leading-[0.86]
                           text-white tracking-wide">
              HERMZ <span className="text-gray-500">&amp;</span> D
            </h1>
            <p className="font-serif italic text-lg sm:text-xl text-gray-400 mt-3 max-w-3xl leading-snug">
              Two friends, three hundred and five films, one long running Oscar competition.
            </p>
          </div>

          {!loading && oscarData && (
            <div className="hidden md:flex absolute bottom-24 right-10 z-20
                            bg-night-950/70 backdrop-blur-md border border-white/[0.12]
                            rounded-2xl px-6 py-4 gap-5 items-center shadow-still-lg">
              <HeroScore
                who="matt"
                wins={oscarData.mattWins}
                total={oscarData.mattTotal}
                leading={leader?.who === 'matt'}
              />
              <span className="w-px h-12 bg-white/10" />
              <HeroScore
                who="dustin"
                wins={oscarData.dustinWins}
                total={oscarData.dustinTotal}
                leading={leader?.who === 'dustin'}
              />
            </div>
          )}
        </FilmStill>

        {/* Top Six carousel */}
        <div className="bg-night-950 border-t border-white/[0.06] px-6 sm:px-10 py-6
                        grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 sm:gap-8 items-center">
          <div>
            <div className="kicker-dim">The Canon · {moviesData?.latestEvent?.year ?? '—'} Edition</div>
            <div className="font-display text-4xl text-white tracking-wide mt-1">
              TOP <span className="text-gold-500">SIX</span>
            </div>
            <Link to="/movies/list" className="font-mono text-[11px] tracking-kicker text-gray-400
                                                hover:text-gold-400 transition-colors mt-1 block">
              Combined list →
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {loading || !moviesData
              ? Array.from({length: 6}).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-md bg-night-800/60 animate-pulse" />
                ))
              : moviesData.topFilms.map(f => (
                  <Link key={f.id} to={`/movies/${f.id}`} className="block group">
                    <FilmStill
                      src={f.poster_url}
                      title={f.title}
                      className="aspect-[2/3] rounded-md border border-white/10 shadow-still
                                 group-hover:scale-[1.03] transition-transform"
                    />
                  </Link>
                ))
            }
          </div>
        </div>
      </section>

      {/* ── SECTION CARDS ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-10 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">

        <Link to="/oscars"
              className="card-hover group relative overflow-hidden no-underline block">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="kicker">Oscar Picks</div>
              <div className="font-display text-3xl text-white tracking-wide mt-1
                              group-hover:text-gold-400 transition-colors">
                {oscarData?.complete.length ?? '—'} CEREMONIES
              </div>
            </div>
            <span className="font-mono text-[11px] tracking-kicker text-gray-500 group-hover:text-gray-300 transition-colors">
              View all →
            </span>
          </div>

          {oscarData && (
            <div className="mb-5">
              {/* Win streak ribbon — each dot is one ceremony */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {oscarData.complete.slice().reverse().map(y => {
                  const isMatt   = y.winner === 'matt'
                  const isDustin = y.winner === 'dustin'
                  const isTie    = y.tiebreaker_used
                  return (
                    <div key={y.year} className="relative group/dot">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center
                                   text-[11px] font-mono transition-all duration-150
                                   group-hover/dot:scale-110 cursor-default"
                        style={{
                          background: isMatt
                            ? 'rgba(224,162,47,0.18)'
                            : isDustin
                              ? 'rgba(91,108,255,0.18)'
                              : 'rgba(255,255,255,0.06)',
                          border: `1.5px solid ${
                            isMatt   ? 'rgba(224,162,47,0.6)'
                            : isDustin ? 'rgba(91,108,255,0.6)'
                            : 'rgba(255,255,255,0.12)'
                          }`,
                          color: isMatt ? '#E0A22F' : isDustin ? '#6E7FFF' : '#6b7280',
                        }}
                      >
                        {String(y.year).slice(2)}
                        {isTie && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cinema-500 border border-night-800" />}
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1
                                      bg-night-700 border border-night-600 rounded-lg
                                      text-[10px] font-mono text-white whitespace-nowrap
                                      opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none z-10">
                        {y.year} · {isMatt ? 'Hermz' : isDustin ? 'Dust' : '—'}
                        {isTie ? ' (TB)' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
                  <span className="w-3 h-3 rounded-full bg-gold-500/50 border border-gold-500/60" /> Hermz wins
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
                  <span className="w-3 h-3 rounded-full bg-film-500/50 border border-film-500/60" /> Dust wins
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
                  <span className="w-3 h-3 rounded-full bg-cinema-500 border border-cinema-600" /> Tiebreaker
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <PersonScoreLine person="matt"   wins={oscarData?.mattWins   ?? 0} total={oscarData?.mattTotal   ?? 0} />
            <span className="font-mono text-sm tracking-kicker text-gray-500">
              {oscarData?.mattWins ?? '—'} – {oscarData?.dustinWins ?? '—'}
            </span>
            <PersonScoreLine person="dustin" wins={oscarData?.dustinWins ?? 0} total={oscarData?.dustinTotal ?? 0} right />
          </div>
        </Link>

        <Link to="/movies" className="card-hover group block no-underline">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-[11px] tracking-kicker uppercase text-film-400">Canon</div>
              <div className="font-display text-3xl text-white tracking-wide mt-1
                              group-hover:text-film-400 transition-colors">
                {moviesData?.filmCount ?? '—'} FILMS
              </div>
            </div>
            <span className="font-mono text-[11px] tracking-kicker text-gray-500 group-hover:text-gray-300 transition-colors">
              Rankings →
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(moviesData?.topFilms ?? []).slice(0, 4).map(f => (
              <FilmStill key={f.id} src={f.poster_url} title={f.title}
                         className="aspect-[2/3] rounded-md border border-white/10 shadow-still" />
            ))}
          </div>
          <div className="mt-4 font-sans text-xs text-gray-500">
            {moviesData?.events.length ?? '—'} editions · 2001 → {moviesData?.latestEvent?.year ?? '—'}
          </div>
        </Link>
      </section>

      {/* ── EXPLORE STRIP ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pb-12 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link to="/movies/all"        className="pill">All Films</Link>
          <Link to="/movies/lists"      className="pill">External Lists</Link>
          <Link to="/movies/stats"      className="pill">Crossover Stats</Link>
          <Link to="/oscars/stats"      className="pill">Oscar Stats</Link>
        </div>
        <span className="font-mono text-[10px] tracking-cinema text-gray-600">
          EST. 1993 · HERMZ &amp; D
        </span>
      </section>
    </div>
  )
}

function HeroScore({ who, wins, total, leading }) {
  const c = who === 'matt' ? 'text-gold-500' : 'text-film-500'
  const name = who === 'matt' ? 'HERMZ' : 'DUST'
  return (
    <div className="text-center relative px-2">
      <div className={`font-mono text-[9px] tracking-cinema ${c} mb-1`}>
        {name}{leading && ' · LEADING'}
      </div>
      <div className="font-display text-5xl text-white leading-[0.9] tracking-wide">{wins}</div>
      <div className="font-mono text-[9px] tracking-kicker text-gray-500 mt-1">{total} CORRECT</div>
    </div>
  )
}

function PersonScoreLine({ person, wins, total, right }) {
  const c = person === 'matt' ? 'text-gold-500' : 'text-film-500'
  const bg = person === 'matt' ? 'bg-gold-500' : 'bg-film-500'
  const name = person === 'matt' ? 'Hermz' : 'Dust'
  return (
    <div className={`flex items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
      <span className={`block w-2 h-2 rounded-full ${bg} self-center`} />
      <span className="font-sans text-base text-white font-medium">{name}</span>
      <span className={`font-display text-3xl ${c} leading-none tracking-wide`}>{wins}</span>
      <span className="font-mono text-xs text-gray-500">· {total} correct</span>
    </div>
  )
}
