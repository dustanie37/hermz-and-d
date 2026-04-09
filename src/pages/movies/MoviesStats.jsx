import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS_ORDER = [2001, 2007, 2016, 2026]
const HC = '#d97706'  // gold-600  (Hermz / Matt)
const DC = '#6170f5'  // film-500  (Dust)

// ── helpers ───────────────────────────────────────────────────────────────────

function primaryGenre(film) {
  if (film.custom_genre_1) return film.custom_genre_1
  if (film.omdb_genres) return film.omdb_genres.split(',')[0].trim()
  return null
}

function decade(year) {
  if (!year) return null
  return Math.floor(year / 10) * 10
}

function decadeLabel(d) {
  return d ? `${d}s` : 'Unknown'
}

// ── chart components ──────────────────────────────────────────────────────────

function DecadeChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      const d = decade(f.release_year)
      if (d) counts[d] = (counts[d] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([d, count]) => ({ decade: decadeLabel(Number(d)), count }))
  }, [films])

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="decade" width={48}
               tick={{ fill: textColor, fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: isDark ? '#1e1e30' : '#fff',
            border: isDark ? '1px solid #26263c' : '1px solid #e7e5e4',
            borderRadius: 8, fontSize: 12,
          }}
          labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }}
        />
        <Bar dataKey="count" fill={DC} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function GenreChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      const g = primaryGenre(f)
      if (g) counts[g] = (counts[g] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)
      .map(([genre, count]) => ({ genre, count }))
  }, [films])

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="genre" width={128}
               tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: isDark ? '#1e1e30' : '#fff',
            border: isDark ? '1px solid #26263c' : '1px solid #e7e5e4',
            borderRadius: 8, fontSize: 12,
          }}
          labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }}
        />
        <Bar dataKey="count" fill={HC} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DirectorChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      if (f.director) {
        const d = f.director.split(',')[0].trim()
        counts[d] = (counts[d] || 0) + 1
      }
    })
    return Object.entries(counts)
      .filter(([, n]) => n > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([director, count]) => ({ director, count }))
  }, [films])

  if (data.length === 0) return (
    <p className="text-gray-400 dark:text-gray-600 text-sm text-center py-6">
      No directors with multiple films in this view.
    </p>
  )

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="director" width={140}
               tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: isDark ? '#1e1e30' : '#fff',
            border: isDark ? '1px solid #26263c' : '1px solid #e7e5e4',
            borderRadius: 8, fontSize: 12,
          }}
          labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i % 2 === 0 ? HC : DC} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── quick-stats strip ─────────────────────────────────────────────────────────

function QuickStats({ films }) {
  const decades   = {}
  const genres    = {}
  const directors = {}

  films.forEach(f => {
    const d = decade(f.release_year)
    if (d) decades[d] = (decades[d] || 0) + 1
    const g = primaryGenre(f)
    if (g) genres[g] = (genres[g] || 0) + 1
    if (f.director) {
      const dir = f.director.split(',')[0].trim()
      directors[dir] = (directors[dir] || 0) + 1
    }
  })

  const topDecade   = Object.entries(decades).sort(([,a],[,b])   => b - a)[0]
  const topGenre    = Object.entries(genres).sort(([,a],[,b])    => b - a)[0]
  const topDirector = Object.entries(directors).sort(([,a],[,b]) => b - a)[0]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {[
        { label: 'Total Films',    value: films.length,                             icon: '🎞️' },
        { label: 'Top Decade',     value: topDecade   ? decadeLabel(Number(topDecade[0]))   : '—', icon: '📅' },
        { label: 'Top Genre',      value: topGenre    ? topGenre[0]    : '—',       icon: '🎭' },
        { label: 'Top Director',   value: topDirector ? topDirector[0] : '—',       icon: '🎬' },
      ].map(s => (
        <div key={s.label} className="card text-center py-4">
          <div className="text-xl mb-1">{s.icon}</div>
          <div className="font-bold text-gray-900 dark:text-white text-sm mt-0.5 truncate px-2"
               title={String(s.value)}>{s.value}</div>
          <div className="stat-label mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesStats() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isDark } = useTheme()

  const eventYear = Number(searchParams.get('event')) || 2026
  const view      = searchParams.get('view') || 'combined'

  const [events, setEvents]     = useState([])
  const [profiles, setProfiles] = useState({})
  const [films, setFilms]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // ── fetch meta once ────────────────────────────────────────────────────────
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

  // ── fetch films for charts ─────────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return

    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return

    setLoading(true)
    setError(null)
    setFilms([])

    async function fetchFilms() {
      try {
        let filmList = []

        if (view === 'combined') {
          const { data, error: err } = await supabase
            .from('combined_rankings')
            .select(`films (id, title, release_year, director, omdb_genres, custom_genre_1, custom_genre_2)`)
            .eq('event_id', currentEvent.id)
          if (err) throw err
          filmList = (data || []).map(r => r.films).filter(Boolean)

        } else {
          const userId = profiles[view]
          if (!userId) throw new Error(`Profile not found for ${view}`)

          const { data, error: err } = await supabase
            .from('individual_rankings')
            .select(`films (id, title, release_year, director, omdb_genres, custom_genre_1, custom_genre_2)`)
            .eq('event_id', currentEvent.id)
            .eq('user_id', userId)
          if (err) throw err
          filmList = (data || []).map(r => r.films).filter(Boolean)
        }

        setFilms(filmList)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFilms()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYear, view, profiles, events])

  function setEvent(year) { setSearchParams({ event: year, view }) }
  function setView(v)     { setSearchParams({ event: eventYear, view: v }) }

  const viewLabel = view === 'combined' ? 'Combined List'
                  : view === 'dustin'   ? "Dust's List"
                  :                       "Hermz's List"

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/movies"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
            ← Movies
          </Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <h1 className="page-title text-2xl">Stats &amp; Charts</h1>
        </div>
        <Link to={`/movies/list?event=${eventYear}&view=${view}`}
          className="btn-ghost text-sm flex items-center gap-1.5">
          📋 View Rankings
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

      {/* ── View toggle ── */}
      <div className="flex gap-1 mb-8 p-1 bg-stone-100 dark:bg-night-800 rounded-xl w-fit">
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

      {/* ── Loading / error ── */}
      {loading && (
        <div className="py-16 flex items-center justify-center">
          <span className="text-gray-400 animate-pulse">Loading {eventYear} stats…</span>
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>
      )}

      {/* ── Charts ── */}
      {!loading && !error && films.length > 0 && (
        <>
          <QuickStats films={films} />

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {eventYear} — <span className="font-semibold text-gray-700 dark:text-gray-200">{viewLabel}</span>
            <span className="ml-2 text-gray-400">({films.length} films)</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            <div className="card">
              <h2 className="section-title text-lg mb-1">By Decade</h2>
              <p className="section-subtitle">Films grouped by release decade</p>
              <DecadeChart films={films} isDark={isDark} />
            </div>

            <div className="card">
              <h2 className="section-title text-lg mb-1">By Genre</h2>
              <p className="section-subtitle">Primary genre — top 12</p>
              <GenreChart films={films} isDark={isDark} />
            </div>

          </div>

          <div className="card">
            <h2 className="section-title text-lg mb-1">Top Directors</h2>
            <p className="section-subtitle">Directors with 2 or more films on this list</p>
            <DirectorChart films={films} isDark={isDark} />
          </div>
        </>
      )}

    </div>
  )
}
