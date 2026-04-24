import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS_ORDER = [2001, 2007, 2016, 2026]
const HC = '#d97706'   // gold-600  (Hermz / Matt)
const DC = '#6170f5'   // film-500  (Dust)

const BUMP_COLORS = [
  '#d97706','#6170f5','#10b981','#f43f5e','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#f59e0b','#3b82f6','#a855f7','#22c55e','#ef4444',
  '#0ea5e9','#d946ef','#65a30d','#dc2626','#7c3aed',
  '#2563eb','#db2777','#16a34a','#ca8a04','#0891b2',
]

// Score categories for analysis. personal_impact is /20, rest are /10.
const SCORE_CATS = [
  { key: 'score_lead_performance',  label: 'Lead Perf.',    max: 10 },
  { key: 'score_supp_performance',  label: 'Supp. Perf.',   max: 10 },
  { key: 'score_direction',         label: 'Direction',     max: 10 },
  { key: 'score_cinematography',    label: 'Cinematography',max: 10 },
  { key: 'score_influence',         label: 'Influence',     max: 10 },
  { key: 'score_acclaim',           label: 'Acclaim',       max: 10 },
  { key: 'score_screenplay',        label: 'Screenplay',    max: 10, since: 2007 },
  { key: 'score_production_design', label: 'Prod. Design',  max: 10, since: 2007 },
  { key: 'score_plot',              label: 'Plot',          max: 10, until: 2001 },
  { key: 'score_dialogue',          label: 'Dialogue',      max: 10, until: 2001 },
  { key: 'score_personal_impact',   label: 'Personal Impact (norm.)', max: 20, normalize: true },
]

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

function decadeLabel(d) { return d ? `${d}s` : 'Unknown' }

function shortYear(y) { return `'${String(y).slice(2)}` }

function tooltipStyle(isDark) {
  return {
    background: isDark ? '#1e1e30' : '#fff',
    border: isDark ? '1px solid #26263c' : '1px solid #e7e5e4',
    borderRadius: 8,
    fontSize: 12,
  }
}

// ── CHARTS TAB COMPONENTS ─────────────────────────────────────────────────────

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
        <YAxis type="category" dataKey="decade" width={48} tick={{ fill: textColor, fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle(isDark)} labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} itemStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} />
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
        <YAxis type="category" dataKey="genre" width={128} tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle(isDark)} labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} itemStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} />
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
    <p className="text-gray-400 text-sm text-center py-6">No directors with multiple films in this view.</p>
  )

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="director" width={140} tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle(isDark)} labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} itemStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? HC : DC} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ActorChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      ['actor_1','actor_2','actor_3','actor_4','actor_5'].forEach(key => {
        const actor = f[key]
        if (actor) counts[actor] = (counts[actor] || 0) + 1
      })
    })
    return Object.entries(counts)
      .filter(([, n]) => n > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([actor, count]) => ({ actor, count }))
  }, [films])

  if (data.length === 0) return (
    <p className="text-gray-400 text-sm text-center py-6">No actors with multiple films in this view.</p>
  )

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="actor" width={140} tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle(isDark)} labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} itemStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? DC : HC} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function WriterChart({ films, isDark }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      if (f.writer) {
        f.writer.split(',').forEach(w => {
          const trimmed = w.trim()
          // Check for parenthetical qualifier, e.g. "George Lucas (characters)"
          const match = trimmed.match(/^(.+?)\s*\((.+?)\)\s*$/)
          if (match) {
            const qualifier = match[2].toLowerCase()
            // Skip source-material credits — not actual screenwriters
            if (/character|novel|story|book|play|based|comic|series|creator/.test(qualifier) &&
                !/screenplay|screen story/.test(qualifier)) return
            const name = match[1].trim()
            if (name) counts[name] = (counts[name] || 0) + 1
          } else {
            // No qualifier — count as writer
            if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1
          }
        })
      }
    })
    return Object.entries(counts)
      .filter(([, n]) => n > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([writer, count]) => ({ writer, count }))
  }, [films])

  if (data.length === 0) return (
    <p className="text-gray-400 text-sm text-center py-6">No screenwriters with multiple films in this view.</p>
  )

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="writer" width={160} tick={{ fill: textColor, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle(isDark)} labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} itemStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? HC : DC} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

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
        { label: 'Total Films',  value: films.length,                                    icon: '🎞️' },
        { label: 'Top Decade',   value: topDecade   ? decadeLabel(Number(topDecade[0]))  : '—', icon: '📅' },
        { label: 'Top Genre',    value: topGenre    ? topGenre[0]    : '—',              icon: '🎭' },
        { label: 'Top Director', value: topDirector ? topDirector[0] : '—',             icon: '🎬' },
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

// ── ALL EVENTS TAB COMPONENTS ─────────────────────────────────────────────────

function BumpChart({ allTimeData, isDark }) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [showCount, setShowCount]   = useState(25)

  const { filmMap, byFilm } = allTimeData

  // Films in 2+ events, sorted by most-recent-event rank
  const eligibleFilms = useMemo(() => {
    return Object.entries(byFilm)
      .filter(([, ranks]) => Object.keys(ranks).length >= 2)
      .map(([filmId, ranks]) => ({
        filmId: Number(filmId),
        title: filmMap[filmId]?.title || '?',
        ranks,
        sortKey: ranks[2026] ?? ranks[2016] ?? ranks[2007] ?? ranks[2001] ?? 999,
      }))
      .sort((a, b) => a.sortKey - b.sortKey)
  }, [filmMap, byFilm])

  const filteredFilms = useMemo(() => {
    if (!searchTerm) return eligibleFilms.slice(0, showCount)
    const term = searchTerm.toLowerCase()
    return eligibleFilms
      .filter(f => f.title.toLowerCase().includes(term))
      .slice(0, showCount)
  }, [eligibleFilms, searchTerm, showCount])

  const chartData = useMemo(() => {
    return EVENTS_ORDER.map(year => {
      const entry = { year: String(year) }
      filteredFilms.forEach(f => {
        const rank = f.ranks[year]
        if (rank != null) entry[String(f.filmId)] = rank
      })
      return entry
    })
  }, [filteredFilms])

  const maxRank = useMemo(() => {
    let max = 25
    filteredFilms.forEach(f => {
      Object.values(f.ranks).forEach(r => { if (r > max) max = r })
    })
    return max + 2
  }, [filteredFilms])

  const textColor = isDark ? '#9ca3af' : '#6b7280'

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const sorted = [...payload]
      .filter(p => p.value != null)
      .sort((a, b) => a.value - b.value)
    if (!sorted.length) return null
    return (
      <div style={{
        ...tooltipStyle(isDark),
        padding: '8px 12px',
        maxHeight: 220,
        overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: isDark ? '#f3f4f6' : '#111827' }}>
          {label}
        </div>
        {sorted.map(p => (
          <div key={p.dataKey} style={{ color: p.stroke, marginBottom: 2 }}>
            #{p.value} — {filmMap[Number(p.dataKey)]?.title || p.dataKey}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Highlight a film…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input text-sm py-1.5 w-52"
        />
        <select
          value={showCount}
          onChange={e => setShowCount(Number(e.target.value))}
          className="select text-sm py-1.5"
        >
          <option value={15}>Top 15</option>
          <option value={25}>Top 25</option>
          <option value={40}>Top 40</option>
          <option value={9999}>All films</option>
        </select>
        <span className="text-xs text-gray-400">{filteredFilms.length} films</span>
      </div>

      {filteredFilms.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No films match.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.min(650, Math.max(320, filteredFilms.length * 14 + 80))}>
          <LineChart data={chartData} margin={{ left: 12, right: 24, top: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#26263c' : '#f0ede8'} />
            <XAxis dataKey="year" tick={{ fill: textColor, fontSize: 13, fontWeight: 600 }} />
            <YAxis
              reversed
              domain={[1, maxRank]}
              tick={{ fill: textColor, fontSize: 11 }}
              tickCount={Math.min(maxRank, 10)}
              label={{ value: 'Rank', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 11, dy: 24 }}
            />
            <Tooltip content={<CustomTooltip />} />
            {filteredFilms.map((f, i) => {
              const isHighlighted = searchTerm && f.title.toLowerCase().includes(searchTerm.toLowerCase())
              return (
                <Line
                  key={f.filmId}
                  type="monotone"
                  dataKey={String(f.filmId)}
                  stroke={BUMP_COLORS[i % BUMP_COLORS.length]}
                  strokeWidth={isHighlighted ? 3.5 : 1.5}
                  strokeOpacity={searchTerm && !isHighlighted ? 0.2 : 0.85}
                  dot={{ r: isHighlighted ? 5 : 3 }}
                  activeDot={{ r: 6, cursor: 'pointer' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-gray-400 mt-2 text-center">
        Combined list only · rank 1 at top · gap = not on that event's combined list
      </p>
    </div>
  )
}

function RankMovementsSection({ allTimeData, isDark }) {
  // Compare consecutive events
  const { filmMap, byFilm } = allTimeData

  const pairs = [
    [2001, 2007],
    [2007, 2016],
    [2016, 2026],
  ]

  const movements = useMemo(() => {
    const all = []
    pairs.forEach(([from, to]) => {
      Object.entries(byFilm).forEach(([filmId, ranks]) => {
        if (ranks[from] != null && ranks[to] != null) {
          const diff = ranks[from] - ranks[to] // positive = improved (rank number dropped)
          all.push({
            filmId: Number(filmId),
            title: filmMap[filmId]?.title || '?',
            from, to,
            fromRank: ranks[from],
            toRank: ranks[to],
            diff,
          })
        }
      })
    })
    return all
  }, [filmMap, byFilm])

  const topRisers = useMemo(() =>
    [...movements].filter(m => m.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 8),
    [movements])

  const topFallers = useMemo(() =>
    [...movements].filter(m => m.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 8),
    [movements])

  function MovementCard({ items, type }) {
    return (
      <div className="space-y-2">
        {items.map((m, i) => (
          <Link
            key={i}
            to={`/movies/${m.filmId}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 dark:hover:bg-night-700 transition-colors group"
          >
            <span className={`text-2xl font-display font-bold w-10 text-center flex-shrink-0 ${
              type === 'riser' ? 'text-green-500' : 'text-red-400'
            }`}>
              {type === 'riser' ? '↑' : '↓'}{Math.abs(m.diff)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 dark:text-white text-sm truncate
                              group-hover:text-film-600 dark:group-hover:text-film-400 transition-colors">
                {m.title}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {shortYear(m.from)} #{m.fromRank} → {shortYear(m.to)} #{m.toRank}
              </div>
            </div>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="section-title text-base mb-1">🚀 Biggest Risers</h3>
        <p className="section-subtitle mb-4">Largest rank improvements between consecutive events</p>
        <MovementCard items={topRisers} type="riser" />
      </div>
      <div className="card">
        <h3 className="section-title text-base mb-1">📉 Biggest Fallers</h3>
        <p className="section-subtitle mb-4">Largest rank drops between consecutive events</p>
        <MovementCard items={topFallers} type="faller" />
      </div>
    </div>
  )
}

function AlwaysPresentSection({ allTimeData }) {
  const { filmMap, byFilm } = allTimeData

  const alwaysPresent = useMemo(() => {
    return Object.entries(byFilm)
      .filter(([, ranks]) => EVENTS_ORDER.every(y => ranks[y] != null))
      .map(([filmId, ranks]) => ({
        filmId: Number(filmId),
        title: filmMap[filmId]?.title || '?',
        ranks,
        avgRank: EVENTS_ORDER.reduce((s, y) => s + ranks[y], 0) / EVENTS_ORDER.length,
      }))
      .sort((a, b) => a.avgRank - b.avgRank)
  }, [filmMap, byFilm])

  return (
    <div className="card">
      <h3 className="section-title text-base mb-1">🏆 On Every Combined List</h3>
      <p className="section-subtitle mb-4">
        {alwaysPresent.length} film{alwaysPresent.length !== 1 ? 's' : ''} appeared on all 4 combined lists (2001, 2007, 2016, 2026)
      </p>
      {alwaysPresent.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">None found.</p>
      ) : (
        <div className="space-y-1">
          {alwaysPresent.map(f => (
            <Link
              key={f.filmId}
              to={`/movies/${f.filmId}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                         hover:bg-stone-100 dark:hover:bg-night-700 transition-colors group"
            >
              <span className="text-gold-500 text-lg flex-shrink-0">★</span>
              <span className="font-semibold text-gray-900 dark:text-white text-sm flex-1 truncate
                               group-hover:text-film-600 dark:group-hover:text-film-400 transition-colors">
                {f.title}
              </span>
              <div className="flex gap-2 flex-shrink-0">
                {EVENTS_ORDER.map(y => (
                  <span key={y} className="text-xs text-gray-400 tabular-nums">
                    {shortYear(y)} #{f.ranks[y]}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function InAndOutSection({ allTimeData }) {
  const { filmMap, byFilm } = allTimeData

  // Films with a "gap" — present, absent, then present again
  const inAndOut = useMemo(() => {
    return Object.entries(byFilm)
      .filter(([, ranks]) => {
        const pattern = EVENTS_ORDER.map(y => ranks[y] != null)
        const first = pattern.findIndex(v => v)
        const last  = pattern.length - 1 - [...pattern].reverse().findIndex(v => v)
        if (first === last) return false // only one appearance
        for (let i = first; i <= last; i++) {
          if (!pattern[i]) return true // gap found
        }
        return false
      })
      .map(([filmId, ranks]) => ({
        filmId: Number(filmId),
        title: filmMap[filmId]?.title || '?',
        ranks,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [filmMap, byFilm])

  return (
    <div className="card">
      <h3 className="section-title text-base mb-1">🔄 Appeared, Disappeared &amp; Returned</h3>
      <p className="section-subtitle mb-4">
        {inAndOut.length} film{inAndOut.length !== 1 ? 's' : ''} were absent from at least one event before returning
      </p>
      {inAndOut.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">None found.</p>
      ) : (
        <div className="space-y-1">
          {inAndOut.map(f => (
            <Link
              key={f.filmId}
              to={`/movies/${f.filmId}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                         hover:bg-stone-100 dark:hover:bg-night-700 transition-colors group"
            >
              <span className="text-blue-400 text-base flex-shrink-0">↩</span>
              <span className="font-semibold text-gray-900 dark:text-white text-sm flex-1 truncate
                               group-hover:text-film-600 dark:group-hover:text-film-400 transition-colors">
                {f.title}
              </span>
              <div className="flex gap-2 flex-shrink-0">
                {EVENTS_ORDER.map(y => (
                  <span key={y} className={`text-xs tabular-nums ${
                    f.ranks[y] != null ? 'text-gray-400' : 'text-gray-200 dark:text-gray-700 line-through'
                  }`}>
                    {shortYear(y)} {f.ranks[y] != null ? `#${f.ranks[y]}` : 'NR'}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SCORE ANALYSIS TAB ────────────────────────────────────────────────────────

function ScoreAnalysisTab({ scoresData, isDark }) {
  const [selectedEvent, setSelectedEvent] = useState(2026)

  const eventData = scoresData?.[selectedEvent]
  const textColor = isDark ? '#9ca3af' : '#6b7280'

  const chartData = useMemo(() => {
    if (!eventData) return []
    return SCORE_CATS
      .filter(cat => {
        if (cat.until && selectedEvent > cat.until) return false
        if (cat.since && selectedEvent < cat.since) return false
        return true
      })
      .map(cat => {
        const dustVal = eventData.dustin?.[cat.key]
        const mattVal = eventData.matt?.[cat.key]
        const normalize = cat.normalize ? 0.5 : 1
        return {
          category: cat.label,
          Dust:  dustVal != null ? +(dustVal * normalize).toFixed(2) : null,
          Hermz: mattVal != null ? +(mattVal * normalize).toFixed(2) : null,
        }
      })
      .filter(d => d.Dust != null || d.Hermz != null)
  }, [eventData, selectedEvent])

  return (
    <div>
      {/* Event selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {EVENTS_ORDER.map(yr => (
          <button
            key={yr}
            onClick={() => setSelectedEvent(yr)}
            className={`px-5 py-2 rounded-xl font-display font-bold text-sm transition-all ${
              yr === selectedEvent
                ? 'bg-film-600 text-white shadow-md shadow-film-900/20'
                : 'bg-stone-100 text-gray-500 hover:bg-film-50 hover:text-film-600 dark:bg-night-700 dark:text-gray-400 dark:hover:bg-film-900/40 dark:hover:text-film-400'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>

      {!eventData ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading score data…</p>
      ) : chartData.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-12">No score data for {selectedEvent}.</p>
      ) : (
        <div className="card">
          <h3 className="section-title text-base mb-1">Average Scores by Category — {selectedEvent}</h3>
          <p className="section-subtitle mb-1">
            Average score per ranking category across all {selectedEvent} films.
            Personal Impact normalized to /10 scale.
          </p>
          <div className="flex gap-4 mb-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded" style={{ background: DC }} />
              <span style={{ color: DC }} className="font-semibold">Dust</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded" style={{ background: HC }} />
              <span style={{ color: HC }} className="font-semibold">Hermz</span>
            </span>
          </div>

          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40 + 30)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
            >
              <XAxis type="number" domain={[0, 10]} tick={{ fill: textColor, fontSize: 11 }} />
              <YAxis type="category" dataKey="category" width={130} tick={{ fill: textColor, fontSize: 11 }} />
              <Tooltip
                contentStyle={tooltipStyle(isDark)}
                labelStyle={{ color: isDark ? '#f3f4f6' : '#111827' }}
                formatter={(val, name) => [val?.toFixed(2) ?? '—', name]}
              />
              <Bar dataKey="Dust"  fill={DC} radius={[0, 4, 4, 0]} barSize={10} />
              <Bar dataKey="Hermz" fill={HC} radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>

          {/* Raw data table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header text-left">Category</th>
                  <th className="table-header text-center" style={{ color: DC }}>Dust avg</th>
                  <th className="table-header text-center" style={{ color: HC }}>Hermz avg</th>
                  <th className="table-header text-center text-gray-400">Edge</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(row => {
                  const diff = row.Dust != null && row.Hermz != null
                    ? (row.Dust - row.Hermz).toFixed(2)
                    : null
                  return (
                    <tr key={row.category} className="table-row-hover">
                      <td className="table-cell font-medium text-gray-800 dark:text-gray-200">{row.category}</td>
                      <td className="table-cell text-center tabular-nums" style={{ color: DC }}>
                        {row.Dust?.toFixed(2) ?? '—'}
                      </td>
                      <td className="table-cell text-center tabular-nums" style={{ color: HC }}>
                        {row.Hermz?.toFixed(2) ?? '—'}
                      </td>
                      <td className="table-cell text-center tabular-nums text-xs">
                        {diff != null && (
                          <span className={Number(diff) > 0 ? 'text-film-500' : Number(diff) < 0 ? 'text-gold-500' : 'text-gray-400'}>
                            {Number(diff) > 0 ? `Dust +${diff}` : Number(diff) < 0 ? `Hermz +${Math.abs(diff)}` : 'Tied'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PODCAST PREP TAB ──────────────────────────────────────────────────────────

function PodcastPrepTab({ allTimeData }) {
  const { filmMap, byFilm, byEvent } = allTimeData
  const navigate = useNavigate()

  // 2026 combined films sorted by rank
  const list2026 = useMemo(() => {
    if (!byEvent[2026]) return []
    return [...byEvent[2026]]
      .sort((a, b) => a.rank - b.rank)
      .map(({ filmId, rank }) => ({
        filmId,
        rank,
        film: filmMap[filmId],
        prev2016: byFilm[filmId]?.[2016] ?? null,
        prev2007: byFilm[filmId]?.[2007] ?? null,
        prev2001: byFilm[filmId]?.[2001] ?? null,
        isNew: !byFilm[filmId]?.[2016] && !byFilm[filmId]?.[2007] && !byFilm[filmId]?.[2001],
      }))
  }, [filmMap, byFilm, byEvent])

  const top10 = list2026.slice(0, 10)
  const newFilms = list2026.filter(f => f.isNew)

  const biggestRisers2026 = useMemo(() => {
    return list2026
      .filter(f => f.prev2016 != null)
      .map(f => ({ ...f, improvement: f.prev2016 - f.rank }))
      .filter(f => f.improvement > 0)
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 5)
  }, [list2026])

  // Always present films (all 4 lists)
  const alwaysPresent = useMemo(() => {
    return Object.entries(byFilm)
      .filter(([, ranks]) => EVENTS_ORDER.every(y => ranks[y] != null))
      .map(([filmId, ranks]) => ({
        filmId: Number(filmId),
        title: filmMap[filmId]?.title || '?',
        rank2026: ranks[2026],
      }))
      .sort((a, b) => a.rank2026 - b.rank2026)
  }, [filmMap, byFilm])

  // Quick stats for 2026
  const totalFilms = list2026.length
  const decades = {}
  const genres  = {}
  list2026.forEach(({ film }) => {
    if (!film) return
    const d = decade(film.release_year)
    if (d) decades[d] = (decades[d] || 0) + 1
    const g = primaryGenre(film)
    if (g) genres[g] = (genres[g] || 0) + 1
  })
  const topDecade  = Object.entries(decades).sort(([,a],[,b]) => b-a)[0]
  const topGenre   = Object.entries(genres).sort(([,a],[,b]) => b-a)[0]

  function FilmPill({ filmId, rank, title, sub }) {
    return (
      <button
        onClick={() => navigate(`/movies/${filmId}`)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-night-800
                   hover:bg-film-50 dark:hover:bg-film-900/30 transition-colors text-left w-full"
      >
        <span className="font-display font-bold text-gray-400 dark:text-gray-600 w-8 text-right flex-shrink-0 text-sm">
          #{rank}
        </span>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{title}</div>
          {sub && <div className="text-xs text-gray-400">{sub}</div>}
        </div>
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title text-xl">2026 Combined List — Podcast Prep</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalFilms} films · Top decade: {topDecade ? `${decadeLabel(Number(topDecade[0]))} (${topDecade[1]})` : '—'} · Top genre: {topGenre?.[0] ?? '—'}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-ghost text-sm flex items-center gap-2 print:hidden"
        >
          🖨️ Print
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 10 */}
        <div className="card lg:col-span-2">
          <h3 className="section-title text-base mb-1">Top 10</h3>
          <p className="section-subtitle mb-4">2026 combined list — the cream of the crop</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {top10.map(f => (
              <FilmPill
                key={f.filmId}
                filmId={f.filmId}
                rank={f.rank}
                title={f.film?.title ?? '?'}
                sub={
                  f.prev2016
                    ? `was #${f.prev2016} in '16 · ${f.prev2016 - f.rank > 0 ? `↑${f.prev2016 - f.rank}` : f.prev2016 - f.rank < 0 ? `↓${Math.abs(f.prev2016 - f.rank)}` : '●'}`
                    : f.isNew ? '★ New to combined lists' : 'NR in \'16'
                }
              />
            ))}
          </div>
        </div>

        {/* New additions */}
        <div className="card">
          <h3 className="section-title text-base mb-1">✨ New Additions</h3>
          <p className="section-subtitle mb-4">
            {newFilms.length} films appearing on a combined list for the first time
          </p>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {newFilms.map(f => (
              <FilmPill
                key={f.filmId}
                filmId={f.filmId}
                rank={f.rank}
                title={f.film?.title ?? '?'}
                sub={f.film?.release_year ?? ''}
              />
            ))}
          </div>
        </div>

        {/* Biggest risers */}
        <div className="card">
          <h3 className="section-title text-base mb-1">🚀 Biggest Risers vs '16</h3>
          <p className="section-subtitle mb-4">Films that climbed most since the 2016 combined list</p>
          <div className="space-y-1.5">
            {biggestRisers2026.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">—</p>
              : biggestRisers2026.map(f => (
                  <FilmPill
                    key={f.filmId}
                    filmId={f.filmId}
                    rank={f.rank}
                    title={f.film?.title ?? '?'}
                    sub={`was #${f.prev2016} in '16 · ↑${f.improvement} spots`}
                  />
                ))
            }
          </div>
        </div>

        {/* Always present */}
        <div className="card lg:col-span-2">
          <h3 className="section-title text-base mb-1">🏆 On All 4 Lists</h3>
          <p className="section-subtitle mb-4">
            {alwaysPresent.length} films that made every combined list since 2001
          </p>
          {alwaysPresent.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">None.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alwaysPresent.map(f => (
                <FilmPill
                  key={f.filmId}
                  filmId={f.filmId}
                  rank={f.rank2026}
                  title={f.title}
                  sub="Present in 2001, 2007, 2016 & 2026"
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function MoviesStats() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isDark } = useTheme()

  const eventYear = Number(searchParams.get('event')) || 2026
  const view      = searchParams.get('view') || 'combined'
  const tab       = searchParams.get('tab') || 'charts'

  const [events, setEvents]       = useState([])
  const [profiles, setProfiles]   = useState({})

  // Charts tab data
  const [chartsFilms, setChartsFilms] = useState([])
  const [chartsLoading, setChartsLoading] = useState(true)
  const [chartsError, setChartsError]     = useState(null)

  // All-time data (all combined rankings, all events)
  const [allTimeData, setAllTimeData]   = useState(null)
  const [allTimeLoading, setAllTimeLoading] = useState(true)

  // Scores data (all individual rankings)
  const [scoresData, setScoresData]     = useState(null)
  const [scoresLoading, setScoresLoading] = useState(true)

  // ── fetch meta (events + profiles) once ──────────────────────────────────
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

  // ── fetch all-time combined data once ────────────────────────────────────
  useEffect(() => {
    async function loadAllTime() {
      setAllTimeLoading(true)
      const { data, error } = await supabase
        .from('combined_rankings')
        .select(`
          combined_rank, film_id, event_id,
          ranking_events (year),
          films (id, title, release_year, director, writer, omdb_genres, custom_genre_1, actor_1, actor_2, actor_3, actor_4, actor_5, poster_url)
        `)
      if (error) { setAllTimeLoading(false); return }

      const filmMap = {}
      const byFilm  = {} // { filmId: { year: rank } }
      const byEvent = {} // { year: [{ filmId, rank }] }

      data?.forEach(row => {
        const year   = row.ranking_events?.year
        const filmId = row.film_id
        const rank   = row.combined_rank
        if (row.films) filmMap[filmId] = row.films
        if (!byFilm[filmId]) byFilm[filmId] = {}
        byFilm[filmId][year] = rank
        if (!byEvent[year]) byEvent[year] = []
        byEvent[year].push({ filmId, rank })
      })

      setAllTimeData({ filmMap, byFilm, byEvent })
      setAllTimeLoading(false)
    }
    loadAllTime()
  }, [])

  // ── fetch scores data once ────────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(profiles).length === 0) return

    async function loadScores() {
      setScoresLoading(true)
      const { data, error } = await supabase
        .from('individual_rankings')
        .select(`
          event_id, user_id,
          score_plot, score_dialogue, score_screenplay, score_production_design,
          score_lead_performance, score_supp_performance, score_direction,
          score_cinematography, score_influence, score_acclaim, score_personal_impact,
          ranking_events (year)
        `)
      if (error) { setScoresLoading(false); return }

      // Build: { year: { dustin: { cat: avg }, matt: { cat: avg } } }
      const dustinId = profiles['dustin']
      const mattId   = profiles['matt']

      const raw = {} // { year: { userId: { catKey: [values] } } }

      data?.forEach(row => {
        const year   = row.ranking_events?.year
        const userId = row.user_id
        if (!year) return
        if (!raw[year]) raw[year] = {}
        if (!raw[year][userId]) raw[year][userId] = {}

        SCORE_CATS.forEach(cat => {
          const val = row[cat.key]
          if (val != null) {
            if (!raw[year][userId][cat.key]) raw[year][userId][cat.key] = []
            raw[year][userId][cat.key].push(val)
          }
        })
      })

      // Compute averages
      const result = {}
      Object.entries(raw).forEach(([year, byUser]) => {
        result[Number(year)] = {}
        const computeAvgs = (userId) => {
          if (!byUser[userId]) return {}
          const avgs = {}
          Object.entries(byUser[userId]).forEach(([catKey, vals]) => {
            avgs[catKey] = vals.reduce((s, v) => s + v, 0) / vals.length
          })
          return avgs
        }
        result[Number(year)].dustin = computeAvgs(dustinId)
        result[Number(year)].matt   = computeAvgs(mattId)
      })

      setScoresData(result)
      setScoresLoading(false)
    }
    loadScores()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles])

  // ── fetch charts tab data when event/view/meta changes ───────────────────
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return
    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return

    setChartsLoading(true)
    setChartsError(null)
    setChartsFilms([])

    async function fetchChartsFilms() {
      try {
        let filmList = []
        const filmFields = `id, title, release_year, director, writer, omdb_genres, custom_genre_1, custom_genre_2,
                            actor_1, actor_2, actor_3, actor_4, actor_5`

        if (view === 'combined') {
          const { data, error: err } = await supabase
            .from('combined_rankings')
            .select(`films (${filmFields})`)
            .eq('event_id', currentEvent.id)
          if (err) throw err
          filmList = (data || []).map(r => r.films).filter(Boolean)
        } else {
          const userId = profiles[view]
          if (!userId) throw new Error(`Profile not found for ${view}`)
          const { data, error: err } = await supabase
            .from('individual_rankings')
            .select(`films (${filmFields})`)
            .eq('event_id', currentEvent.id)
            .eq('user_id', userId)
          if (err) throw err
          filmList = (data || []).map(r => r.films).filter(Boolean)
        }
        setChartsFilms(filmList)
      } catch (e) {
        setChartsError(e.message)
      } finally {
        setChartsLoading(false)
      }
    }
    fetchChartsFilms()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYear, view, profiles, events])

  // ── nav helpers ───────────────────────────────────────────────────────────
  function setTab(t)    { setSearchParams({ event: eventYear, view, tab: t }) }
  function setEvent(yr) { setSearchParams({ event: yr, view, tab }) }
  function setView(v)   { setSearchParams({ event: eventYear, view: v, tab }) }

  const viewLabel = view === 'combined' ? 'Combined List'
                  : view === 'dustin'   ? "Dust's List"
                  :                       "Hermz's List"

  // ── tab definitions ───────────────────────────────────────────────────────
  const TABS = [
    { value: 'charts',    label: '📊 Charts'      },
    { value: 'allevents', label: '📈 All Events'   },
    { value: 'scores',    label: '🎯 Scores'       },
    { value: 'podcast',   label: '🎙️ Podcast Prep' },
  ]

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 print:py-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/movies"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
            ← Movies
          </Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <h1 className="page-title text-2xl">Stats &amp; Charts</h1>
        </div>
        <Link
          to={`/movies/list?event=${eventYear}&view=${view}`}
          className="btn-ghost text-sm flex items-center gap-1.5"
        >
          📋 View Rankings
        </Link>
      </div>

      {/* ── Tab nav ── */}
      <div className="flex gap-1 mb-8 p-1 bg-stone-100 dark:bg-night-800 rounded-xl w-fit flex-wrap print:hidden">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.value
                ? 'bg-white dark:bg-night-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CHARTS                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'charts' && (
        <>
          {/* Event selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {EVENTS_ORDER.map(yr => (
              <button key={yr} onClick={() => setEvent(yr)}
                className={`px-5 py-2 rounded-xl font-display font-bold text-sm transition-all ${
                  yr === eventYear
                    ? 'bg-film-600 text-white shadow-md shadow-film-900/20'
                    : 'bg-stone-100 text-gray-500 hover:bg-film-50 hover:text-film-600 dark:bg-night-700 dark:text-gray-400 dark:hover:bg-film-900/40 dark:hover:text-film-400'
                }`}>
                {yr}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-1 mb-8 p-1 bg-stone-100 dark:bg-night-800 rounded-xl w-fit">
            {[
              { value: 'combined', label: 'Combined' },
              { value: 'dustin',   label: "Dust's List" },
              { value: 'matt',     label: "Hermz's List" },
            ].map(opt => (
              <button key={opt.value} onClick={() => setView(opt.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  view === opt.value
                    ? 'bg-white dark:bg-night-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>

          {chartsLoading && (
            <div className="py-16 flex items-center justify-center">
              <span className="text-gray-400 animate-pulse">Loading {eventYear} stats…</span>
            </div>
          )}
          {chartsError && (
            <div className="py-8 text-center text-red-400 text-sm">Error: {chartsError}</div>
          )}

          {!chartsLoading && !chartsError && chartsFilms.length > 0 && (
            <>
              <QuickStats films={chartsFilms} />

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {eventYear} — <span className="font-semibold text-gray-700 dark:text-gray-200">{viewLabel}</span>
                <span className="ml-2 text-gray-400">({chartsFilms.length} films)</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="card">
                  <h2 className="section-title text-lg mb-1">By Decade</h2>
                  <p className="section-subtitle">Films grouped by release decade</p>
                  <DecadeChart films={chartsFilms} isDark={isDark} />
                </div>
                <div className="card">
                  <h2 className="section-title text-lg mb-1">By Genre</h2>
                  <p className="section-subtitle">Primary genre — top 12</p>
                  <GenreChart films={chartsFilms} isDark={isDark} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="card">
                  <h2 className="section-title text-lg mb-1">Top Directors</h2>
                  <p className="section-subtitle">Directors with 2+ films on this list</p>
                  <DirectorChart films={chartsFilms} isDark={isDark} />
                </div>
                <div className="card">
                  <h2 className="section-title text-lg mb-1">Top Actors</h2>
                  <p className="section-subtitle">Actors (from OMDB) with 2+ films on this list</p>
                  <ActorChart films={chartsFilms} isDark={isDark} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="card">
                  <h2 className="section-title text-lg mb-1">Top Screenwriters</h2>
                  <p className="section-subtitle">Writers (from OMDB) with 2+ films on this list</p>
                  <WriterChart films={chartsFilms} isDark={isDark} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: ALL EVENTS                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'allevents' && (
        <>
          {allTimeLoading ? (
            <div className="py-16 flex items-center justify-center">
              <span className="text-gray-400 animate-pulse">Loading all-time data…</span>
            </div>
          ) : !allTimeData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load all-time data.</div>
          ) : (
            <div className="space-y-8">

              {/* Bump chart */}
              <div className="card">
                <h2 className="section-title text-lg mb-1">Bump Chart — Combined Rankings</h2>
                <p className="section-subtitle mb-4">
                  Rank trajectory across all 4 events. Each line is a film. Rank 1 is at top. Gaps = not on that event's combined list.
                </p>
                <BumpChart allTimeData={allTimeData} isDark={isDark} />
              </div>

              {/* Rank movements */}
              <div>
                <h2 className="section-title text-lg mb-4">Rank Movements Between Events</h2>
                <RankMovementsSection allTimeData={allTimeData} isDark={isDark} />
              </div>

              {/* Always present + In & Out */}
              <AlwaysPresentSection allTimeData={allTimeData} />
              <InAndOutSection allTimeData={allTimeData} />

            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: SCORES                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'scores' && (
        <>
          {scoresLoading ? (
            <div className="py-16 flex items-center justify-center">
              <span className="text-gray-400 animate-pulse">Loading score data…</span>
            </div>
          ) : !scoresData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load score data.</div>
          ) : (
            <ScoreAnalysisTab scoresData={scoresData} isDark={isDark} />
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: PODCAST PREP                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'podcast' && (
        <>
          {allTimeLoading ? (
            <div className="py-16 flex items-center justify-center">
              <span className="text-gray-400 animate-pulse">Loading…</span>
            </div>
          ) : !allTimeData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load data.</div>
          ) : (
            <PodcastPrepTab allTimeData={allTimeData} />
          )}
        </>
      )}

    </div>
  )
}
