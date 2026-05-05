import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import OscarIcon from '../components/OscarIcon'

// ── helpers ───────────────────────────────────────────────────────────────────

function computeLeader(mattWins, dustinWins) {
  if (mattWins > dustinWins) return { name: 'Hermz', lead: mattWins - dustinWins, color: 'text-gold-500' }
  if (dustinWins > mattWins) return { name: 'Dust',  lead: dustinWins - mattWins, color: 'text-film-500' }
  return { name: null, lead: 0, color: 'text-gray-400' }
}

// ── skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRows({ count = 3 }) {
  return (
    <div className="space-y-2 mb-5">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="h-10 bg-stone-100 dark:bg-night-700 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

// ── stat row ─────────────────────────────────────────────────────────────────

function StatRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-stone-50 dark:bg-night-900/60 rounded-lg">
      <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">{label}</span>
      <div className="text-sm font-semibold">{children}</div>
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { displayName, isAuthenticated } = useAuth()

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
      supabase.from('ranking_events').select('id, year, label').order('year', { ascending: false }),
      supabase.from('films').select('*', { count: 'exact', head: true }),
    ])

    // #1 combined film from the most recent event
    const latestEvent = events?.[0]
    let topFilm = null
    if (latestEvent) {
      const { data: top } = await supabase
        .from('combined_rankings')
        .select('combined_rank, films(id, title, poster_url)')
        .eq('event_id', latestEvent.id)
        .eq('combined_rank', 1)
        .maybeSingle()
      topFilm = top?.films || null
    }

    const complete = (years || []).filter(y => y.status !== 'upcoming')
    const mattWins   = complete.filter(y => y.winner === 'matt').length
    const dustinWins = complete.filter(y => y.winner === 'dustin').length
    const mostRecent = complete[0]

    setOscarData({ complete, mattWins, dustinWins, mostRecent })
    setMoviesData({ events: events || [], filmCount: filmCount || 0, latestEvent, topFilm })
    setLoading(false)
  }

  const leader = oscarData ? computeLeader(oscarData.mattWins, oscarData.dustinWins) : null

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      {/* ── Hero ── */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-5xl md:text-6xl font-display font-bold text-gold-400">Hermz</span>
          <span className="text-4xl md:text-5xl font-display font-bold text-gray-500">&amp;</span>
          <span className="text-5xl md:text-6xl font-display font-bold text-film-400">D</span>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg max-w-md mx-auto leading-relaxed">
          A lifetime of great movies. A friendly war for Oscar glory.
        </p>
        {isAuthenticated && displayName && (
          <p className="mt-3 text-sm">
            Welcome back,{' '}
            <span className="text-gold-400 font-medium">{displayName}</span>.
          </p>
        )}
      </div>

      {/* ── Quick stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="card py-5 animate-pulse">
              <div className="h-7 bg-stone-200 dark:bg-night-700 rounded-md w-10 mx-auto mb-2" />
              <div className="h-3 bg-stone-100 dark:bg-night-600 rounded w-20 mx-auto" />
            </div>
          ))
        ) : (
          <>
            <div className="card text-center py-5">
              <div className="stat-value text-2xl">{oscarData?.complete.length ?? '—'}</div>
              <div className="stat-label mt-1">Oscar Ceremonies</div>
            </div>
            <div className="card text-center py-5">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="font-bold text-xl text-gold-500">{oscarData?.mattWins ?? '—'}</span>
                <span className="text-gray-400 text-xs">vs</span>
                <span className="font-bold text-xl text-film-500">{oscarData?.dustinWins ?? '—'}</span>
              </div>
              <div className="stat-label">Hermz – Dust</div>
            </div>
            <div className="card text-center py-5">
              <div className="stat-value text-2xl">{moviesData?.events.length ?? '—'}</div>
              <div className="stat-label mt-1">Ranking Events</div>
            </div>
            <div className="card text-center py-5">
              <div className="stat-value text-2xl">{moviesData?.filmCount ?? '—'}</div>
              <div className="stat-label mt-1">Films Ranked</div>
            </div>
          </>
        )}
      </div>

      {/* ── Section cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        {/* ── Oscars ── */}
        <Link to="/oscars" className="card-hover group relative overflow-hidden block no-underline">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700 rounded-t-xl" />

          <div className="pt-5">
            <div className="flex items-center gap-2 mb-5">
              <OscarIcon className="w-5 h-5 text-gold-500 flex-shrink-0" />
              <h2 className="font-display text-xl font-bold text-gold-400 group-hover:text-gold-300 transition-colors">
                Oscar Picks
              </h2>
            </div>

            {loading || !oscarData ? (
              <SkeletonRows count={3} />
            ) : (
              <div className="space-y-2 mb-5">
                {/* All-time record */}
                <StatRow label="All-time Record">
                  <span className="text-gold-500">{oscarData.mattWins} Hermz</span>
                  <span className="text-gray-400 font-normal text-xs mx-1.5">vs</span>
                  <span className="text-film-500">{oscarData.dustinWins} Dust</span>
                </StatRow>

                {/* Current leader */}
                {leader?.name ? (
                  <StatRow label="Leading by">
                    <span className={leader.color}>
                      {leader.name} +{leader.lead}
                    </span>
                  </StatRow>
                ) : (
                  <StatRow label="Standing">
                    <span className="text-amber-500">Dead Heat 🤝</span>
                  </StatRow>
                )}

                {/* Most recent winner */}
                {oscarData.mostRecent && (
                  <StatRow label={`${oscarData.mostRecent.year} Winner`}>
                    <span className={oscarData.mostRecent.winner === 'matt' ? 'text-gold-500' : 'text-film-500'}>
                      {oscarData.mostRecent.winner === 'matt' ? 'Hermz' : 'Dust'}
                      {oscarData.mostRecent.tiebreaker_used && (
                        <span className="text-amber-400 text-xs font-normal ml-1">(TB)</span>
                      )}
                    </span>
                  </StatRow>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gold-500 group-hover:text-gold-400 transition-colors uppercase tracking-wider">
                View Ceremonies →
              </span>
              <span
                onClick={e => { e.preventDefault(); window.location.href = '/oscars/stats' }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                Stats
              </span>
            </div>
          </div>
        </Link>

        {/* ── Movies ── */}
        <Link to="/movies" className="card-hover group relative overflow-hidden block no-underline">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-film-800 via-film-500 to-film-800 rounded-t-xl" />

          <div className="pt-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl leading-none">🎬</span>
              <h2 className="font-display text-xl font-bold text-film-400 group-hover:text-film-300 transition-colors">
                Movie Rankings
              </h2>
            </div>

            {loading || !moviesData ? (
              <SkeletonRows count={3} />
            ) : (
              <div className="space-y-2 mb-5">
                {/* Latest event */}
                <StatRow label="Latest Event">
                  <span className="text-film-500">{moviesData.latestEvent?.year ?? '—'}</span>
                </StatRow>

                {/* #1 combined film */}
                {moviesData.topFilm ? (
                  <div className="flex items-center gap-3 py-2 px-3 bg-stone-50 dark:bg-night-900/60 rounded-lg">
                    {moviesData.topFilm.poster_url ? (
                      <img
                        src={moviesData.topFilm.poster_url}
                        alt={moviesData.topFilm.title}
                        className="w-8 h-11 object-cover rounded flex-shrink-0 shadow-md"
                      />
                    ) : (
                      <div className="w-8 h-11 bg-stone-200 dark:bg-night-700 rounded flex-shrink-0 flex items-center justify-center text-xs">
                        🎬
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-gray-500 font-medium leading-none mb-0.5">
                        #1 Combined {moviesData.latestEvent?.year}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {moviesData.topFilm.title}
                      </div>
                    </div>
                  </div>
                ) : (
                  <StatRow label="# 1 Combined">
                    <span className="text-gray-400">—</span>
                  </StatRow>
                )}

                {/* Events */}
                <StatRow label="Events">
                  <div className="flex items-center gap-1">
                    {moviesData.events.map((ev, i) => (
                      <span key={ev.id} className="text-gray-500 text-xs">
                        {ev.year}{i < moviesData.events.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>
                </StatRow>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-film-500 group-hover:text-film-400 transition-colors uppercase tracking-wider">
                View Rankings →
              </span>
              <span
                onClick={e => { e.preventDefault(); window.location.href = '/movies/stats' }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                Stats
              </span>
            </div>
          </div>
        </Link>

      </div>

      {/* ── Bottom explore strip ── */}
      <div className="card py-4 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Explore more
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/movies/all"        className="btn-ghost text-xs py-1.5 px-3">All Films</Link>
            <Link to="/movies/lists"      className="btn-ghost text-xs py-1.5 px-3">External Lists</Link>
            <Link to="/movies/stats?tab=crossover" className="btn-ghost text-xs py-1.5 px-3">🔀 Crossover Stats</Link>
            <Link to="/oscars/stats"      className="btn-ghost text-xs py-1.5 px-3">Oscar Stats</Link>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
        Est. 1993 · Hermz &amp; D
      </p>

    </div>
  )
}
