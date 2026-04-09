import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── helpers ───────────────────────────────────────────────────────────────────

const EVENT_DESCRIPTIONS = {
  2001: 'The inaugural ranking — 42 films agreed upon by both Hermz & Dust.',
  2007: 'Six years later, the list grew to 55 films and a shared canon formed.',
  2016: 'A decade of new classics brought 48 films to the combined list.',
  2026: 'The most recent ranking — 46 films, debated and scored over months.',
}

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
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      // Fetch all ranking events
      const { data: eventsData } = await supabase
        .from('ranking_events')
        .select('id, year, label')
        .order('year', { ascending: false })

      // Fetch combined rankings counts
      const { data: combined } = await supabase
        .from('combined_rankings')
        .select('event_id')

      // Fetch individual rankings counts (with event and user info)
      const { data: individual } = await supabase
        .from('individual_rankings')
        .select('event_id, user_id')

      // Build count maps
      const combCounts = {}
      combined?.forEach(r => {
        combCounts[r.event_id] = (combCounts[r.event_id] || 0) + 1
      })

      // Individual: count unique films per event per user
      const indivByEventUser = {}
      individual?.forEach(r => {
        const key = `${r.event_id}:${r.user_id}`
        if (!indivByEventUser[key]) indivByEventUser[key] = 0
        indivByEventUser[key]++
      })
      // Aggregate to per-event (max of two user counts)
      const indivCounts = {}
      Object.entries(indivByEventUser).forEach(([key, count]) => {
        const [eventId] = key.split(':')
        indivCounts[eventId] = Math.max(indivCounts[eventId] || 0, count)
      })

      setEvents(eventsData || [])
      setCombinedCounts(combCounts)
      setIndividualCounts(indivCounts)
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
        <div>
          <h1 className="page-title flex items-center gap-3">
            🎬 Movies
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Four ranking events across {events.length > 0 ? `${events[events.length - 1]?.year}–${events[0]?.year}` : '…'} · {totalFilms} combined list appearances
          </p>
        </div>
        <Link to="/movies/stats"
          className="btn-ghost flex items-center gap-2 text-sm self-start mt-1">
          📊 Movie Stats
        </Link>
      </div>

      {/* ── All-time quick stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Ranking Events', value: events.length, icon: '📅' },
          { label: 'Combined Films', value: totalFilms, icon: '🎞️' },
          { label: 'Years of Lists', value: events.length > 0 ? events[0]?.year - events[events.length - 1]?.year : 0, icon: '⏳' },
          { label: 'Most Recent', value: events[0]?.year || '—', icon: '🏆' },
        ].map(stat => (
          <div key={stat.label} className="card text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="stat-value text-xl">{stat.value}</div>
            <div className="stat-label mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Event cards ── */}
      <h2 className="section-title mb-4">Ranking Events</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
        {events.map(ev => {
          const combCount = combinedCounts[ev.id] || 0
          const indivCount = individualCounts[ev.id] || 0
          const grad = EVENT_GRADIENTS[ev.year] || 'from-night-800 to-night-600'
          const accent = EVENT_ACCENT[ev.year] || 'text-gray-300'

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
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`font-display text-4xl font-bold text-white`}>{ev.year}</span>
                    <p className={`text-sm mt-0.5 ${accent}`}>{ev.label}</p>
                  </div>
                  <span className="text-white/40 text-3xl group-hover:text-white/60 transition-colors">→</span>
                </div>

                <p className="text-white/70 text-sm mb-4 leading-relaxed">
                  {EVENT_DESCRIPTIONS[ev.year] || ev.label}
                </p>

                {/* Film counts */}
                <div className="flex gap-3">
                  <div className="bg-black/20 rounded-lg px-3 py-1.5 text-center">
                    <div className="text-white font-bold text-lg leading-none">{combCount}</div>
                    <div className="text-white/50 text-xs mt-0.5">Combined</div>
                  </div>
                  {indivCount > 0 && (
                    <div className="bg-black/20 rounded-lg px-3 py-1.5 text-center">
                      <div className="text-white font-bold text-lg leading-none">{indivCount}</div>
                      <div className="text-white/50 text-xs mt-0.5">Per List</div>
                    </div>
                  )}
                </div>

                {/* View buttons */}
                <div className="flex gap-2 mt-4 flex-wrap">
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
