import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const EVENT_GRADIENTS = {
  2001: 'from-stone-600 to-stone-800',
  2007: 'from-film-800 to-film-600',
  2016: 'from-night-800 to-film-700',
  2026: 'from-film-700 to-gold-700',
}

const EVENT_ACCENT = {
  2001: 'text-stone-300',
  2007: 'text-film-300',
  2016: 'text-film-300',
  2026: 'text-gold-300',
}

// ── component ─────────────────────────────────────────────────────────────────

export default function MoviesHome() {
  const [events, setEvents] = useState([])
  const [combinedCounts, setCombinedCounts] = useState({})
  const [individualCounts, setIndividualCounts] = useState({})
  const [totalDbFilms, setTotalDbFilms] = useState(0)
  const [topFilms, setTopFilms] = useState({}) // { eventId: { combined, dustin, hermz } }
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const [
        { data: eventsData },
        { data: combined },
        { data: individual },
        { count: filmCount },
        { data: profiles },
        { data: topCombined },
        { data: topIndividual },
      ] = await Promise.all([
        supabase.from('ranking_events').select('id, year, label').order('year', { ascending: false }),
        supabase.from('combined_rankings').select('event_id'),
        supabase.from('individual_rankings').select('event_id, user_id'),
        supabase.from('films').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('id, username'),
        supabase.from('combined_rankings')
          .select('event_id, combined_rank, films(id, title, poster_url)')
          .eq('combined_rank', 1),
        supabase.from('individual_rankings')
          .select('event_id, rank, user_id, films(id, title, poster_url), profiles(username)')
          .eq('rank', 1),
      ])

      // Build count maps
      const combCounts = {}
      combined?.forEach(r => {
        combCounts[r.event_id] = (combCounts[r.event_id] || 0) + 1
      })

      const indivByEventUser = {}
      individual?.forEach(r => {
        const key = `${r.event_id}:${r.user_id}`
        if (!indivByEventUser[key]) indivByEventUser[key] = 0
        indivByEventUser[key]++
      })
      const indivCounts = {}
      Object.entries(indivByEventUser).forEach(([key, count]) => {
        const [eventId] = key.split(':')
        indivCounts[eventId] = Math.max(indivCounts[eventId] || 0, count)
      })

      // Build top films map keyed by event_id
      const tops = {}
      topCombined?.forEach(r => {
        if (!tops[r.event_id]) tops[r.event_id] = {}
        tops[r.event_id].combined       = r.films?.title
        tops[r.event_id].combinedPoster = r.films?.poster_url
        tops[r.event_id].combinedId     = r.films?.id
      })
      topIndividual?.forEach(r => {
        if (!tops[r.event_id]) tops[r.event_id] = {}
        const uname = r.profiles?.username
        if (uname === 'dustin') {
          tops[r.event_id].dustin       = r.films?.title
          tops[r.event_id].dustinPoster = r.films?.poster_url
          tops[r.event_id].dustinId     = r.films?.id
        }
        if (uname === 'matt') {
          tops[r.event_id].hermz        = r.films?.title
          tops[r.event_id].hermzPoster  = r.films?.poster_url
          tops[r.event_id].hermzId      = r.films?.id
        }
      })

      setEvents(eventsData || [])
      setCombinedCounts(combCounts)
      setIndividualCounts(indivCounts)
      setTotalDbFilms(filmCount || 0)
      setTopFilms(tops)
      setLoading(false)
    }
    fetchData()
  }, [])

  const totalFilms = Object.values(combinedCounts).reduce((s, n) => s + n, 0)

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="text-gray-500 animate-pulse">Loading rankings…</span>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <h1 className="page-title flex items-center gap-3">
          🎬 Movies
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Link to="/movies/stats"
            className="btn-ghost flex items-center gap-2 text-sm self-start mt-1">
            📊 Movie Stats
          </Link>
          <Link to="/movies/acclaim"
            className="btn-ghost flex items-center gap-2 text-sm self-start mt-1">
            ⭐ Acclaim Scores
          </Link>
        </div>
      </div>

      {/* ── All-time quick stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {/* Ranking Events */}
        <div className="card text-center">
          <div className="text-2xl mb-1">📅</div>
          <div className="stat-value text-xl">{events.length}</div>
          <div className="stat-label mt-0.5">Ranking Events</div>
        </div>

        {/* Combined Films */}
        <div className="card text-center">
          <div className="text-2xl mb-1">🎞️</div>
          <div className="stat-value text-xl">{totalFilms}</div>
          <div className="stat-label mt-0.5">Combined Appearances</div>
        </div>

        {/* Films in Database — clickable */}
        <Link to="/movies/all"
          className="card text-center cursor-pointer transition-all
                     hover:border-film-400/60 hover:shadow-md hover:shadow-film-100/40
                     dark:hover:border-film-600/60 dark:hover:shadow-lg dark:hover:shadow-film-900/20
                     group">
          <div className="text-2xl mb-1">🗄️</div>
          <div className="stat-value text-xl group-hover:text-film-600 dark:group-hover:text-film-400 transition-colors">
            {totalDbFilms}
          </div>
          <div className="stat-label mt-0.5">Films in Database</div>
          <div className="text-xs text-film-500 dark:text-film-400 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            View all →
          </div>
        </Link>

        {/* Most Recent */}
        <div className="card text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="stat-value text-xl">{events[0]?.year || '—'}</div>
          <div className="stat-label mt-0.5">Most Recent</div>
        </div>
      </div>

      {/* ── Event cards ── */}
      <h2 className="section-title mb-4">Ranking Events</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
        {events.map(ev => {
          const combCount = combinedCounts[ev.id] || 0
          const indivCount = individualCounts[ev.id] || 0
          const grad = EVENT_GRADIENTS[ev.year] || 'from-night-800 to-night-600'
          const tops = topFilms[ev.id] || {}

          return (
            <div key={ev.id}
              className={`relative rounded-2xl bg-gradient-to-br ${grad} p-6 shadow-lg overflow-hidden group cursor-pointer`}
              onClick={() => navigate(`/movies/list?event=${ev.year}`)}
            >
              {/* Background texture */}
              <div className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)',
                  backgroundSize: '8px 8px',
                }} />

              {/* Content */}
              <div className="relative z-10">
                {/* Year + arrow */}
                <div className="flex items-start justify-between mb-4">
                  <span className="font-display text-4xl font-bold text-white">{ev.year}</span>
                  <span className="text-white/40 text-3xl group-hover:text-white/60 transition-colors">→</span>
                </div>

                {/* #1 films with posters */}
                <div className="space-y-2.5 mb-5">
                  {[
                    { label: 'Combined', title: tops.combined, poster: tops.combinedPoster, filmId: tops.combinedId, view: 'combined' },
                    { label: 'Dust',     title: tops.dustin,   poster: tops.dustinPoster,   filmId: tops.dustinId,   view: 'dustin'   },
                    { label: 'Hermz',    title: tops.hermz,    poster: tops.hermzPoster,    filmId: tops.hermzId,    view: 'matt'     },
                  ].filter(r => r.title).map(row => (
                    <div key={row.label}
                      className="flex items-center gap-2.5"
                      onClick={e => { e.stopPropagation(); navigate(`/movies/${row.filmId}`) }}
                    >
                      {/* Poster thumbnail */}
                      <div className="w-8 h-11 flex-shrink-0 rounded overflow-hidden bg-black/30 shadow-md">
                        {row.poster
                          ? <img src={row.poster} alt={row.title}
                              className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">🎬</div>
                        }
                      </div>
                      {/* Label + title */}
                      <div className="min-w-0">
                        <div className="text-white/50 text-xs uppercase tracking-wider leading-none mb-0.5">{row.label}</div>
                        <div className={`text-sm truncate leading-snug ${row.label === 'Combined' ? 'text-white font-semibold' : 'text-white/85'}`}>
                          {row.title}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* View buttons */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/movies/list?event=${ev.year}&view=combined`) }}
                    className="bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Combined List
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/movies/list?event=${ev.year}&view=dustin`) }}
                    className="bg-white/10 hover:bg-white/20 text-white/80 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Dust's List
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/movies/list?event=${ev.year}&view=matt`) }}
                    className="bg-white/10 hover:bg-white/20 text-white/80 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Hermz's List
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Bottom link to stats ── */}
      <div className="card text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
          Deep-dive charts and analysis across all four events
        </p>
        <Link to="/movies/stats" className="btn-film inline-flex items-center gap-2">
          📊 View Movie Stats
        </Link>
      </div>

    </div>
  )
}
