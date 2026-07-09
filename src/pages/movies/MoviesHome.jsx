import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FilmStill from '../../components/FilmStill'

const EVENTS_ORDER = [2026, 2016, 2007, 2001]

// Hue per event year — gives each year card its own cinematographic tint
const EVENT_HUE = {
  2026: 210,
  2016: 234,
  2007: 32,
  2001: 20,
}

export default function MoviesHome() {
  const [events,           setEvents]           = useState([])
  const [combinedCounts,   setCombinedCounts]   = useState({})
  const [totalDbFilms,     setTotalDbFilms]     = useState(0)
  const [topFilms,         setTopFilms]         = useState({})
  const [loading,          setLoading]          = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [
        { data: eventsData },
        { data: combined },
        { count: filmCount },
        { data: topCombined },
        { data: topIndividual },
      ] = await Promise.all([
        supabase.from('ranking_events').select('id, year, label').eq('status', 'published').order('year', { ascending: false }),
        supabase.from('combined_rankings').select('event_id'),
        supabase.from('films').select('*', { count: 'exact', head: true }),
        supabase.from('combined_rankings')
          .select('event_id, combined_rank, films(id, title, poster_url, release_year)')
          .eq('combined_rank', 1),
        supabase.from('individual_rankings')
          .select('event_id, rank, user_id, films(id, title, poster_url, release_year), profiles(username)')
          .eq('rank', 1),
      ])

      const combCounts = {}
      combined?.forEach(r => { combCounts[r.event_id] = (combCounts[r.event_id] || 0) + 1 })

      const tops = {}
      topCombined?.forEach(r => {
        if (!tops[r.event_id]) tops[r.event_id] = {}
        tops[r.event_id].combined = r.films
      })
      topIndividual?.forEach(r => {
        if (!tops[r.event_id]) tops[r.event_id] = {}
        const u = r.profiles?.username
        if (u === 'dustin') tops[r.event_id].dustin = r.films
        if (u === 'matt')   tops[r.event_id].matt   = r.films
      })

      setEvents(eventsData || [])
      setCombinedCounts(combCounts)
      setTotalDbFilms(filmCount || 0)
      setTopFilms(tops)
      setLoading(false)
    }
    fetchData()
  }, [])

  const totalFilms = Object.values(combinedCounts).reduce((s, n) => s + n, 0)
  const eventByYear = {}
  events.forEach(ev => { eventByYear[ev.year] = ev })
  const latestYear = events[0]?.year
  const latestEvent = events[0]
  const heroFilm = latestEvent ? topFilms[latestEvent.id]?.combined : null

  if (loading) return (
    <div className="py-24 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING THE CANON…</span>
    </div>
  )

  return (
    <div>
      {/* ── HERO — full-bleed cinematography keyed to current #1 ──────────── */}
      <FilmStill
        title="Hermz and D Movie Rankings"
        hue={hueForYear(latestYear)}
        className="w-full h-[300px] sm:h-[340px]"
      >
        <div className="absolute inset-0 scrim-bottom" />

        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-8 z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="block w-7 h-px bg-film-500" />
            <span className="font-mono text-[11px] tracking-cinema uppercase text-film-400">
              The Canon · {totalDbFilms} films · {events.length} editions
            </span>
          </div>
          <h1 className="font-display text-6xl sm:text-7xl lg:text-8xl text-white tracking-wide leading-none">
            MOVIE RANKINGS
          </h1>
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <Link to="/movies/stats" className="btn-ghost text-sm">Stats &amp; Charts →</Link>
            <Link to="/movies/all" className="btn-ghost text-sm">All Films →</Link>
          </div>
        </div>
      </FilmStill>

      {/* ── EVENT GRID ───────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {EVENTS_ORDER.map(year => {
            const ev = eventByYear[year]
            if (!ev) return null
            const tops = topFilms[ev.id] || {}
            return (
              <div key={ev.id} className="card overflow-hidden">
                <div className="flex items-baseline justify-between mb-5">
                  <h2 className="font-display text-4xl text-white tracking-wide leading-none">
                    {year}
                  </h2>
                  <span className="font-mono text-[10px] tracking-kicker text-gray-500">
                    {combinedCounts[ev.id] || 0} ON BOTH LISTS
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <PosterTile film={tops.combined} label="Combined" labelColor="text-cinema-400" listUrl={`/movies/list?event=${year}&view=combined`} />
                  <PosterTile film={tops.dustin}   label="Dust"     labelColor="text-film-400" listUrl={`/movies/list?event=${year}&view=dustin`} />
                  <PosterTile film={tops.matt}     label="Hermz"    labelColor="text-gold-400" listUrl={`/movies/list?event=${year}&view=matt`} />
                </div>
              </div>
            )
          })}
        </div>

      </section>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
function hueForYear(y) { return EVENT_HUE[y] ?? 30 }

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl text-white leading-none tracking-wide">{value}</div>
      <div className="font-mono text-[9px] tracking-kicker text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function PosterTile({ film, label, labelColor, listUrl }) {
  return (
    <Link to={listUrl} className="group flex flex-col gap-2">
      <FilmStill
        src={film?.poster_url}
        title={film?.title}
        className="aspect-[2/3] rounded-md border border-white/10 shadow-still
                   group-hover:border-gold-500/50 group-hover:-translate-y-0.5 transition-all"
      >
        {/* Bottom gradient with title */}
        <div
          className="absolute inset-x-0 bottom-0 p-2"
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)' }}
        >
          <span className="font-display text-xs text-white leading-none tracking-wide line-clamp-2 block">
            {film?.title?.toUpperCase()}
          </span>
        </div>
      </FilmStill>
      <span className={`font-mono text-[13px] tracking-cinema uppercase text-center ${labelColor}`}>
        {label}
      </span>
    </Link>
  )
}
