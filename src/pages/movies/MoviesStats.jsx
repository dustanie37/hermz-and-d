import { useState, useEffect, useMemo, Fragment } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import FilmStill from '../../components/FilmStill'
import { DC, HC, CC, sortTitle } from '../../lib/helpers'

// ── colour tokens ────────────────────────────────────────────────────────────
const EVENTS_ORDER = [2001, 2007, 2016, 2026]

const BUMP_COLORS = [
  HC, DC, '#10B981', '#F43F5E', '#A78BFA',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#14B8A6',
  '#F59E0B', '#3B82F6', '#A855F7', '#22C55E', '#EF4444',
  '#0EA5E9', '#D946EF', '#65A30D', '#DC2626', '#7C3AED',
  '#2563EB', '#DB2777', '#16A34A', '#CA8A04', '#0891B2',
]

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
  { key: 'score_personal_impact',   label: 'Personal Impact', max: 20, normalize: true },
]

// ── helpers ──────────────────────────────────────────────────────────────────
function normalizeGenre(g) {
  if (g === 'Action' || g === 'Adventure') return 'Action/Adventure'
  return g
}
function primaryGenre(film) {
  if (film.omdb_genres) return normalizeGenre(film.omdb_genres.split(',')[0].trim())
  return null
}
function decade(year)     { return year ? Math.floor(year / 10) * 10 : null }
function decadeLabel(d)   { return d ? `${d}s` : 'Unknown' }
function shortYear(y)     { return `'${String(y).slice(2)}` }

const TOOLTIP = { background: '#15141E', border: '1px solid #2A2734', borderRadius: 8, fontSize: 12, color: '#F3F4F6' }
const AXIS = '#9298A6'
const GRID = '#2A2734'

// ── PANEL HEADER ─────────────────────────────────────────────────────────────
function PanelHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <div className="font-display text-xl text-white tracking-wide leading-none">{title}</div>
      {subtitle && (
        <div className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase mt-1.5">{subtitle}</div>
      )}
    </div>
  )
}

// ── LEADERBOARD BAR — replaces all horizontal Recharts bar charts ─────────────
function LeaderboardBar({ data, color = DC }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-1.5">
      {data.map((item, i) => (
        <div key={i} className="relative group cursor-default">
          <div
            className="absolute inset-0 rounded-xl"
            style={{ width: `${Math.max(6, (item.count / max) * 100)}%`, background: `${color}1C` }}
          />
          <div className="relative z-10 flex items-center gap-2 px-3 py-2.5 rounded-xl">
            <span className="font-mono text-xs text-gray-500 w-5 flex-shrink-0 text-right">{i + 1}</span>
            <span className="flex-1 text-base text-gray-100 truncate min-w-0">{item.label}</span>
            <span className="font-display text-2xl tracking-wide leading-none flex-shrink-0" style={{ color }}>
              {item.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── H2H BAR — side-by-side stacked comparison ────────────────────────────────
function H2HBar({ data }) {
  const maxTotal = Math.max(...data.map(d => (d.dustCount || 0) + (d.mattCount || 0)), 1)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: DC }} />
          <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase">Dust</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: HC }} />
          <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase">Hermz</span>
        </div>
      </div>
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-200 font-medium">{item.label}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm tabular-nums" style={{ color: DC }}>{item.dustCount}</span>
              <span className="font-mono text-xs text-gray-700">·</span>
              <span className="font-mono text-sm tabular-nums" style={{ color: HC }}>{item.mattCount}</span>
            </div>
          </div>
          <div className="h-2 bg-night-700 rounded-full overflow-hidden flex">
            <div
              className="h-full rounded-l-full"
              style={{ width: `${((item.dustCount || 0) / maxTotal) * 100}%`, background: DC }}
            />
            <div
              className="h-full rounded-r-full"
              style={{ width: `${((item.mattCount || 0) / maxTotal) * 100}%`, background: HC }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ROSTER LIST — clean numbered rows, no fill bar ───────────────────────────
function RosterList({ data, color }) {
  if (!data.length) return null
  return (
    <div className="divide-y divide-night-700/40">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-4 py-3 group">
          <span className="font-mono text-sm text-gray-600 w-6 text-right flex-shrink-0">{i + 1}</span>
          <span className="flex-1 text-base text-gray-100 leading-snug">{item.label}</span>
          <span className="font-display text-2xl tracking-wide leading-none flex-shrink-0" style={{ color }}>{item.count}</span>
        </div>
      ))}
    </div>
  )
}

// ── HORIZONTAL BAR CHART — shared base ───────────────────────────────────────
function HBarChart({ data, color = DC, maxRows }) {
  const rows = maxRows ? data.slice(0, maxRows) : data
  const max  = Math.max(...rows.map(d => d.count), 1)
  return (
    <div className="space-y-2.5">
      {rows.map((item, i) => {
        const pct = (item.count / max) * 100
        return (
          <div key={i} className="flex items-center gap-3 group">
            <span className="font-mono text-xs text-gray-500 w-4 text-right flex-shrink-0">{i + 1}</span>
            <span className="text-sm text-gray-200 w-28 flex-shrink-0 truncate leading-snug">{item.label}</span>
            <div className="flex-1 h-5 bg-night-700/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}cc, ${color}88)`,
                  boxShadow: `0 0 8px ${color}44`,
                }}
              />
            </div>
            <span
              className="font-display text-xl leading-none flex-shrink-0 w-7 text-right tabular-nums"
              style={{ color }}
            >{item.count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── DECADE BAR CHART ─────────────────────────────────────────────────────────
function DecadeChart({ films, color = DC }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => { const d = decade(f.release_year); if (d) counts[d] = (counts[d] || 0) + 1 })
    return Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b))
      .map(([d, count]) => ({ label: decadeLabel(Number(d)), count }))
  }, [films])
  return <HBarChart data={data} color={color} />
}

// ── GENRE BAR CHART ───────────────────────────────────────────────────────────
function GenreChart({ films, color = HC }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => { const g = primaryGenre(f); if (g) counts[g] = (counts[g] || 0) + 1 })
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 14)
      .map(([genre, count]) => ({ label: genre, count }))
  }, [films])
  return <HBarChart data={data} color={color} maxRows={14} />
}

// ── PERSON ROSTER ─────────────────────────────────────────────────────────────
function PersonChart({ films, type, color = DC }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      if (type === 'director') {
        if (f.director) { const d = f.director.split(',')[0].trim(); counts[d] = (counts[d] || 0) + 1 }
      } else if (type === 'actor') {
        // Top-billed only (actor_1–3) — avoids noise from large ensembles
        ;['actor_1', 'actor_2', 'actor_3'].forEach(k => {
          const a = f[k]; if (a) counts[a] = (counts[a] || 0) + 1
        })
      } else if (type === 'writer') {
        if (f.writer) {
          f.writer.split(',').forEach(w => {
            const name = w.trim().replace(/\s*\(.*?\)\s*$/, '').trim()
            if (name) counts[name] = (counts[name] || 0) + 1
          })
        }
      }
    })
    return Object.entries(counts).filter(([, n]) => n > 1)
      .sort(([, a], [, b]) => b - a).slice(0, 15)
      .map(([k, count]) => ({ label: k, count }))
  }, [films, type])
  if (data.length === 0) return (
    <p className="text-gray-400 text-base text-center py-6 italic">No {type}s with multiple films.</p>
  )
  return <RosterList data={data} color={color} />
}

// ── QUICK STATS ───────────────────────────────────────────────────────────────
function QuickStats({ films }) {
  const decades = {}, genres = {}, directors = {}, actors = {}
  films.forEach(f => {
    const d = decade(f.release_year); if (d) decades[d] = (decades[d] || 0) + 1
    const g = primaryGenre(f);        if (g) genres[g]  = (genres[g] || 0) + 1
    if (f.director) { const dir = f.director.split(',')[0].trim(); directors[dir] = (directors[dir] || 0) + 1 }
    for (let i = 1; i <= 10; i++) { const a = f[`actor_${i}`]; if (a) actors[a] = (actors[a] || 0) + 1 }
  })
  const top = obj => Object.entries(obj).sort(([, a], [, b]) => b - a)[0]
  const td = top(decades), tg = top(genres), tdir = top(directors), tact = top(actors)
  const items = [
    { label: 'TOTAL FILMS',  value: films.length },
    { label: 'TOP DECADE',   value: td   ? decadeLabel(Number(td[0])) : '—' },
    { label: 'TOP GENRE',    value: tg   ? tg[0]   : '—' },
    { label: 'TOP DIRECTOR', value: tdir ? tdir[0] : '—' },
    { label: 'TOP ACTOR',    value: tact ? tact[0] : '—' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
      {items.map(s => (
        <div key={s.label} className="card text-center py-4 px-3">
          <div className="font-display text-xl text-white tracking-wide leading-tight truncate" title={String(s.value)}>{s.value}</div>
          <div className="font-mono text-sm tracking-kicker text-gray-500 mt-2 uppercase">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── H2H TASTE COMPARISON SECTION ─────────────────────────────────────────────
function computeH2HData(dustFilms, mattFilms, accessor) {
  const dustCounts = {}, mattCounts = {}
  dustFilms.forEach(f => { const l = accessor(f); if (l) dustCounts[l] = (dustCounts[l] || 0) + 1 })
  mattFilms.forEach(f => { const l = accessor(f); if (l) mattCounts[l] = (mattCounts[l] || 0) + 1 })
  const allLabels = new Set([...Object.keys(dustCounts), ...Object.keys(mattCounts)])
  return [...allLabels]
    .map(label => ({ label, dustCount: dustCounts[label] || 0, mattCount: mattCounts[label] || 0 }))
    .sort((a, b) => (b.dustCount + b.mattCount) - (a.dustCount + a.mattCount))
}

function TasteComparisonSection({ allH2HFilms, loading }) {
  const [selectedYear, setSelectedYear] = useState(2026)
  const h2hFilms = allH2HFilms[selectedYear] || { dustin: [], matt: [] }
  const { dustin: dustFilms, matt: mattFilms } = h2hFilms

  const decadeH2H = useMemo(() =>
    computeH2HData(dustFilms, mattFilms, f => { const d = decade(f.release_year); return d ? decadeLabel(d) : null })
    .sort((a, b) => {
      const da = parseInt(a.label), db = parseInt(b.label)
      return isNaN(da) || isNaN(db) ? (a.label || '').localeCompare(b.label || '') : da - db
    })
  , [dustFilms, mattFilms])

  const genreH2H = useMemo(() =>
    computeH2HData(dustFilms, mattFilms, f => primaryGenre(f)).slice(0, 12)
  , [dustFilms, mattFilms])

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="font-display text-3xl text-white tracking-wide leading-none">TASTE FACE-OFF</h2>
          <p className="font-serif italic text-base text-gray-400 mt-1">Individual lists — Dust vs Hermz side by side</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EVENTS_ORDER.map(yr => (
            <button key={yr} onClick={() => setSelectedYear(yr)}
                    className={yr === selectedYear ? 'pill-film' : 'pill'}>{yr}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <span className="font-mono text-sm tracking-kicker text-gray-500 animate-pulse">LOADING FACE-OFF DATA…</span>
        </div>
      ) : !dustFilms.length || !mattFilms.length ? (
        <p className="text-gray-400 text-base text-center py-6 italic">No data for {selectedYear}.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <PanelHeader title="Decade Face-Off" subtitle={String(selectedYear)} />
            <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">How their era preferences compare</p>
            <H2HBar data={decadeH2H} />
          </div>
          <div className="card">
            <PanelHeader title="Genre Face-Off" subtitle={String(selectedYear)} />
            <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Who gravitates toward which genres</p>
            <H2HBar data={genreH2H} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── BUMP CHART ────────────────────────────────────────────────────────────────
function BumpChart({ allTimeData }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showCount, setShowCount]   = useState(25)
  const { filmMap, byFilm } = allTimeData

  const eligibleFilms = useMemo(() => Object.entries(byFilm)
    .filter(([, ranks]) => Object.keys(ranks).length >= 2)
    .map(([filmId, ranks]) => ({
      filmId: Number(filmId), title: filmMap[filmId]?.title || '?', ranks,
      sortKey: ranks[2026] ?? ranks[2016] ?? ranks[2007] ?? ranks[2001] ?? 999,
    }))
    .sort((a, b) => a.sortKey - b.sortKey), [filmMap, byFilm])

  const filteredFilms = useMemo(() => {
    if (!searchTerm) return eligibleFilms.slice(0, showCount)
    const term = searchTerm.toLowerCase()
    return eligibleFilms.filter(f => f.title.toLowerCase().includes(term)).slice(0, showCount)
  }, [eligibleFilms, searchTerm, showCount])

  const chartData = useMemo(() => EVENTS_ORDER.map(year => {
    const entry = { year: String(year) }
    filteredFilms.forEach(f => { const r = f.ranks[year]; if (r != null) entry[String(f.filmId)] = r })
    return entry
  }), [filteredFilms])

  const maxRank = useMemo(() => {
    let max = 25
    filteredFilms.forEach(f => Object.values(f.ranks).forEach(r => { if (r > max) max = r }))
    return max + 2
  }, [filteredFilms])

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const sorted = [...payload].filter(p => p.value != null).sort((a, b) => a.value - b.value)
    if (!sorted.length) return null
    return (
      <div style={{ ...TOOLTIP, padding: '8px 12px', maxHeight: 220, overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: '0.04em', marginBottom: 4, color: '#fff' }}>{label}</div>
        {sorted.map(p => (
          <div key={p.dataKey} style={{ color: p.stroke, marginBottom: 2, fontSize: 12 }}>
            #{p.value} — {filmMap[Number(p.dataKey)]?.title || p.dataKey}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input type="text" placeholder="Highlight a film…"
               value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
               className="input text-sm py-1.5 w-56" />
        <select value={showCount} onChange={e => setShowCount(Number(e.target.value))}
                className="select text-sm py-1.5 pr-8">
          <option value={15} className="bg-night-900">Top 15</option>
          <option value={25} className="bg-night-900">Top 25</option>
          <option value={40} className="bg-night-900">Top 40</option>
          <option value={9999} className="bg-night-900">All films</option>
        </select>
        <span className="font-mono text-xs tracking-kicker text-gray-500 uppercase">{filteredFilms.length} films</span>
      </div>
      {filteredFilms.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8 italic">No films match.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.min(650, Math.max(320, filteredFilms.length * 14 + 80))}>
          <LineChart data={chartData} margin={{ left: 12, right: 24, top: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 13, fontWeight: 600 }} />
            <YAxis reversed domain={[1, maxRank]} tick={{ fill: AXIS, fontSize: 12 }}
                   tickCount={Math.min(maxRank, 10)}
                   label={{ value: 'Rank', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12, dy: 24 }} />
            <Tooltip content={<CustomTooltip />} />
            {filteredFilms.map((f, i) => {
              const isHighlighted = searchTerm && f.title.toLowerCase().includes(searchTerm.toLowerCase())
              return (
                <Line key={f.filmId} type="monotone" dataKey={String(f.filmId)}
                      stroke={BUMP_COLORS[i % BUMP_COLORS.length]}
                      strokeWidth={isHighlighted ? 3.5 : 1.5}
                      strokeOpacity={searchTerm && !isHighlighted ? 0.2 : 0.85}
                      dot={{ r: isHighlighted ? 5 : 3 }}
                      activeDot={{ r: 6, cursor: 'pointer' }}
                      connectNulls={false} isAnimationActive={false} />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="font-mono text-xs tracking-kicker text-gray-500 mt-3 text-center uppercase">
        Combined list only · rank 1 at top · gap = not on that event's combined list
      </p>
    </div>
  )
}

// ── MOVEMENT CARD ─────────────────────────────────────────────────────────────
function MovementCard({ items, type }) {
  const arrowColor = type === 'riser' ? 'text-emerald-400' : 'text-red-400'
  return (
    <div className="space-y-1.5">
      {items.map((m, i) => (
        <Link key={i} to={`/movies/${m.filmId}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-night-700/40 transition-colors group">
          <span className={`font-display text-2xl tracking-wide w-12 text-center flex-shrink-0 leading-none ${arrowColor}`}>
            {type === 'riser' ? '↑' : '↓'}{Math.abs(m.diff)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{m.title}</div>
            <div className="font-mono text-sm text-gray-400 mt-0.5 uppercase">
              {shortYear(m.from)} <span className="text-gray-200 font-semibold">#{m.fromRank}</span>
              <span className="text-gray-600 mx-1">→</span>
              {shortYear(m.to)} <span className="text-gray-200 font-semibold">#{m.toRank}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ── RANK MOVEMENTS (consecutive) ──────────────────────────────────────────────
function RankMovementsSection({ allTimeData }) {
  const { filmMap, byFilm } = allTimeData
  const pairs = [[2001, 2007], [2007, 2016], [2016, 2026]]
  const movements = useMemo(() => {
    const all = []
    pairs.forEach(([from, to]) => {
      Object.entries(byFilm).forEach(([filmId, ranks]) => {
        if (ranks[from] != null && ranks[to] != null) {
          const diff = ranks[from] - ranks[to]
          all.push({ filmId: Number(filmId), title: filmMap[filmId]?.title || '?', from, to, fromRank: ranks[from], toRank: ranks[to], diff })
        }
      })
    })
    return all
  }, [filmMap, byFilm])
  const topRisers  = useMemo(() => [...movements].filter(m => m.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 8), [movements])
  const topFallers = useMemo(() => [...movements].filter(m => m.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 8), [movements])
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="card">
        <PanelHeader title="Biggest Risers" />
        <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Largest rank improvements between consecutive events</p>
        <MovementCard items={topRisers} type="riser" />
      </div>
      <div className="card">
        <PanelHeader title="Biggest Fallers" />
        <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Largest rank drops between consecutive events</p>
        <MovementCard items={topFallers} type="faller" />
      </div>
    </div>
  )
}

// ── ALL-TIME ARC (first → last appearance) ────────────────────────────────────
function AllTimeArcSection({ allTimeData }) {
  const { filmMap, byFilm } = allTimeData
  const arcs = useMemo(() => {
    return Object.entries(byFilm)
      .map(([filmId, ranks]) => {
        const years = EVENTS_ORDER.filter(y => ranks[y] != null)
        if (years.length < 2) return null
        const firstYear = years[0], lastYear = years[years.length - 1]
        if (firstYear === lastYear) return null
        const diff = ranks[firstYear] - ranks[lastYear]
        return { filmId: Number(filmId), title: filmMap[filmId]?.title || '?', diff, from: firstYear, to: lastYear, fromRank: ranks[firstYear], toRank: ranks[lastYear] }
      })
      .filter(Boolean)
  }, [filmMap, byFilm])
  const topRisers  = useMemo(() => [...arcs].filter(a => a.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 8), [arcs])
  const topFallers = useMemo(() => [...arcs].filter(a => a.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 8), [arcs])
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="card">
        <PanelHeader title="All-Time Climbers" />
        <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Biggest rank improvements from first to last appearance</p>
        <MovementCard items={topRisers} type="riser" />
      </div>
      <div className="card">
        <PanelHeader title="All-Time Drops" />
        <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Biggest rank declines from first to last appearance</p>
        <MovementCard items={topFallers} type="faller" />
      </div>
    </div>
  )
}

// ── ALWAYS PRESENT ────────────────────────────────────────────────────────────
function AlwaysPresentSection({ allTimeData }) {
  const { filmMap, byFilm } = allTimeData
  const list = useMemo(() => Object.entries(byFilm)
    .filter(([, ranks]) => EVENTS_ORDER.every(y => ranks[y] != null))
    .map(([filmId, ranks]) => ({
      filmId: Number(filmId), title: filmMap[filmId]?.title || '?', ranks,
      avgRank: EVENTS_ORDER.reduce((s, y) => s + ranks[y], 0) / EVENTS_ORDER.length,
    }))
    .sort((a, b) => a.avgRank - b.avgRank), [filmMap, byFilm])
  return (
    <div className="card">
      <PanelHeader title="On Every Combined List" />
      <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">
        {list.length} film{list.length !== 1 ? 's' : ''} appeared on all 4 combined lists (2001, 2007, 2016, 2026)
      </p>
      {list.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4 italic">None found.</p>
      ) : (
        <div className="space-y-1">
          {list.map(f => (
            <Link key={f.filmId} to={`/movies/${f.filmId}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
              <span className="text-gold-500 text-lg flex-shrink-0">★</span>
              <span className="text-sm font-semibold text-white flex-1 truncate group-hover:text-film-400 transition-colors">{f.title}</span>
              <div className="flex gap-3 flex-shrink-0">
                {EVENTS_ORDER.map(y => (
                  <div key={y} className="text-center min-w-[34px]">
                    <div className="font-mono text-[11px] text-gray-500 leading-none uppercase">{shortYear(y)}</div>
                    <div className="font-mono text-sm font-semibold text-gray-200 leading-snug tabular-nums">#{f.ranks[y]}</div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── IN AND OUT ────────────────────────────────────────────────────────────────
function InAndOutSection({ allTimeData }) {
  const { filmMap, byFilm } = allTimeData
  const list = useMemo(() => Object.entries(byFilm)
    .filter(([, ranks]) => {
      const pattern = EVENTS_ORDER.map(y => ranks[y] != null)
      const first = pattern.findIndex(v => v)
      const last  = pattern.length - 1 - [...pattern].reverse().findIndex(v => v)
      if (first === last) return false
      for (let i = first; i <= last; i++) if (!pattern[i]) return true
      return false
    })
    .map(([filmId, ranks]) => ({ filmId: Number(filmId), title: filmMap[filmId]?.title || '?', ranks }))
    .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title))), [filmMap, byFilm])
  return (
    <div className="card">
      <PanelHeader title="Appeared, Disappeared & Returned" />
      <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">
        {list.length} film{list.length !== 1 ? 's' : ''} were absent from at least one event before returning
      </p>
      {list.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4 italic">None found.</p>
      ) : (
        <div className="space-y-1">
          {list.map(f => (
            <Link key={f.filmId} to={`/movies/${f.filmId}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
              <span className="text-cinema-400 text-base flex-shrink-0">↩</span>
              <span className="text-sm font-semibold text-white flex-1 truncate group-hover:text-film-400 transition-colors">{f.title}</span>
              <div className="flex gap-3 flex-shrink-0">
                {EVENTS_ORDER.map(y => (
                  <div key={y} className="text-center min-w-[34px]">
                    <div className="font-mono text-[11px] text-gray-500 leading-none uppercase">{shortYear(y)}</div>
                    {f.ranks[y] != null
                      ? <div className="font-mono text-sm font-semibold text-gray-200 leading-snug tabular-nums">#{f.ranks[y]}</div>
                      : <div className="font-mono text-xs text-gray-600 leading-snug">NR</div>
                    }
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── RIVALRY TAB ───────────────────────────────────────────────────────────────
function RivalryTab({ rivalryData, allH2HFilms, allH2HLoading }) {
  const { gapsByFilm, filmMap: rivalFilmMap, dustOnly, mattOnly } = rivalryData
  const [eventFilter, setEventFilter] = useState(2026)

  // Gap film row
  function GapRow({ filmId, title, dustRank, mattRank, gap, direction }) {
    const color = direction === 'dust' ? DC : HC
    return (
      <Link to={`/movies/${filmId}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{title}</div>
          <div className="font-mono text-xs tracking-kicker text-gray-500 mt-0.5 uppercase flex items-center gap-2">
            <span style={{ color: DC }}>D #{dustRank}</span>
            <span className="text-gray-700">·</span>
            <span style={{ color: HC }}>H #{mattRank}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-display text-2xl tracking-wide leading-none" style={{ color }}>+{Math.abs(gap)}</div>
        </div>
      </Link>
    )
  }

  // Largest gap in Dust's favor (positive gap = mattRank > dustRank = Dust ranked higher)
  const dustFavors = useMemo(() =>
    Object.entries(gapsByFilm)
      .filter(([, evts]) => evts[eventFilter] != null && evts[eventFilter].gap > 0)
      .map(([filmId, evts]) => ({
        filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?',
        dustRank: evts[eventFilter].dustRank, mattRank: evts[eventFilter].mattRank,
        gap: evts[eventFilter].gap,
      }))
      .sort((a, b) => b.gap - a.gap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap, eventFilter])

  const hermzFavors = useMemo(() =>
    Object.entries(gapsByFilm)
      .filter(([, evts]) => evts[eventFilter] != null && evts[eventFilter].gap < 0)
      .map(([filmId, evts]) => ({
        filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?',
        dustRank: evts[eventFilter].dustRank, mattRank: evts[eventFilter].mattRank,
        gap: evts[eventFilter].gap,
      }))
      .sort((a, b) => a.gap - b.gap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap, eventFilter])

  // Most polarizing: 2+ shared events, sorted by avg |gap|
  const mostPolarizing = useMemo(() =>
    Object.entries(gapsByFilm)
      .map(([filmId, evts]) => {
        const shared = Object.values(evts)
        if (shared.length < 2) return null
        const avgGap = shared.reduce((s, e) => s + Math.abs(e.gap), 0) / shared.length
        const years = new Set(Object.keys(evts).map(Number))
        return { filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?', avgGap: +avgGap.toFixed(1), years }
      })
      .filter(Boolean)
      .sort((a, b) => b.avgGap - a.avgGap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap])

  // Most agreed: 2+ shared events, sorted by smallest avg |gap|
  const mostAgreed = useMemo(() =>
    Object.entries(gapsByFilm)
      .map(([filmId, evts]) => {
        const shared = Object.values(evts)
        if (shared.length < 2) return null
        const avgGap = shared.reduce((s, e) => s + Math.abs(e.gap), 0) / shared.length
        const years = new Set(Object.keys(evts).map(Number))
        return { filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?', avgGap: +avgGap.toFixed(1), years }
      })
      .filter(Boolean)
      .sort((a, b) => a.avgGap - b.avgGap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap])

  // The Flip: gap direction changed between events
  const theFlip = useMemo(() =>
    Object.entries(gapsByFilm)
      .map(([filmId, evts]) => {
        const orderedGaps = EVENTS_ORDER
          .filter(y => evts[y] != null)
          .map(y => ({ year: y, gap: evts[y].gap, dustRank: evts[y].dustRank, mattRank: evts[y].mattRank }))
        if (orderedGaps.length < 2) return null
        let flipped = false
        for (let i = 1; i < orderedGaps.length; i++) {
          const prev = orderedGaps[i - 1].gap, curr = orderedGaps[i].gap
          if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) { flipped = true; break }
        }
        if (!flipped) return null
        return { filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?', orderedGaps }
      })
      .filter(Boolean)
      .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
  , [gapsByFilm, rivalFilmMap])

  // Summary cards
  const biggestDustGap = useMemo(() => {
    let max = null
    Object.values(gapsByFilm).forEach(evts => Object.values(evts).forEach(e => {
      if (e.gap > 0 && (!max || e.gap > max.gap)) max = e
    }))
    return max
  }, [gapsByFilm])

  const biggestHermzGap = useMemo(() => {
    let min = null
    Object.values(gapsByFilm).forEach(evts => Object.values(evts).forEach(e => {
      if (e.gap < 0 && (!min || e.gap < min.gap)) min = e
    }))
    return min
  }, [gapsByFilm])

  return (
    <div className="space-y-7">

      {/* Taste Face-Off */}
      <TasteComparisonSection allH2HFilms={allH2HFilms} loading={allH2HLoading} />

      <div className="border-t border-night-700/60" />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'FILMS BOTH RANKED', value: Object.keys(gapsByFilm).length, color: 'text-white' },
          { label: 'DUST EXCLUSIVES',   value: dustOnly.length,  color: `text-film-400`  },
          { label: 'HERMZ EXCLUSIVES',  value: mattOnly.length,  color: `text-gold-400`  },
          { label: 'ALLEGIANCE FLIPS',  value: theFlip.length,   color: 'text-cinema-400' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <div className={`font-display text-3xl leading-none tracking-wide ${s.color}`}>{s.value}</div>
            <div className="font-mono text-sm tracking-kicker text-gray-500 mt-2 uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Biggest Gaps */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-display text-3xl text-white tracking-wide leading-none">BIGGEST GAPS</h2>
            <p className="font-serif italic text-base text-gray-400 mt-1">Films they disagreed on most — individual rankings</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EVENTS_ORDER.map(yr => (
              <button key={yr} onClick={() => setEventFilter(yr)}
                      className={yr === eventFilter ? 'pill-film' : 'pill'}>{yr}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: DC }} />
              <PanelHeader title="Dust Favors" />
            </div>
            <p className="font-serif italic text-base text-gray-400 mb-4">Films Dust ranked much higher than Hermz</p>
            {dustFavors.length === 0
              ? <p className="text-gray-500 text-sm text-center py-4 italic">No shared rankings for {eventFilter}.</p>
              : <div className="space-y-0.5">{dustFavors.map(f => <GapRow key={f.filmId} {...f} direction="dust" />)}</div>
            }
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: HC }} />
              <PanelHeader title="Hermz Favors" />
            </div>
            <p className="font-serif italic text-base text-gray-400 mb-4">Films Hermz ranked much higher than Dust</p>
            {hermzFavors.length === 0
              ? <p className="text-gray-500 text-sm text-center py-4 italic">No shared rankings for {eventFilter}.</p>
              : <div className="space-y-0.5">{hermzFavors.map(f => <GapRow key={f.filmId} {...f} direction="hermz" />)}</div>
            }
          </div>
        </div>
      </div>

      {/* Polarizing vs Agreed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <PanelHeader title="Most Polarizing" />
          <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Consistently largest average gap across shared events</p>
          <div className="space-y-0.5">
            {mostPolarizing.map(f => (
              <Link key={f.filmId} to={`/movies/${f.filmId}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{f.title}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {EVENTS_ORDER.map(yr => (
                      <span key={yr} title={String(yr)} className={`w-2 h-2 rounded-full flex-shrink-0 ${f.years.has(yr) ? 'bg-cinema-400' : 'bg-night-600'}`} />
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display text-xl tracking-wide text-cinema-400 leading-none">{f.avgGap}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <PanelHeader title="Most Agreed-Upon" />
          <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Films they consistently ranked closest together</p>
          <div className="space-y-0.5">
            {mostAgreed.map(f => (
              <Link key={f.filmId} to={`/movies/${f.filmId}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{f.title}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {EVENTS_ORDER.map(yr => (
                      <span key={yr} title={String(yr)} className={`w-2 h-2 rounded-full flex-shrink-0 ${f.years.has(yr) ? 'bg-emerald-400' : 'bg-night-600'}`} />
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display text-xl tracking-wide text-emerald-400 leading-none">{f.avgGap}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* The Flip */}
      {theFlip.length > 0 && (
        <div className="card">
          <PanelHeader title="The Flip" />
          <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">
            {theFlip.length} film{theFlip.length !== 1 ? 's' : ''} where allegiance switched direction between editions
          </p>
          <div className="space-y-1">
            {theFlip.map(f => (
              <Link key={f.filmId} to={`/movies/${f.filmId}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-night-700/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{f.title}</div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {f.orderedGaps.map(eg => {
                    const c = eg.gap > 0 ? DC : HC
                    const who = eg.gap > 0 ? 'D' : 'H'
                    return (
                      <div key={eg.year} className="text-center min-w-[52px]">
                        <div className="font-mono text-xs text-gray-400 leading-none">{eg.year}</div>
                        <div className="font-mono text-base leading-tight tabular-nums mt-1 font-bold" style={{ color: c }}>
                          {who}+{Math.abs(eg.gap)}
                        </div>
                        <div className="font-mono text-xs text-gray-400 leading-none mt-1">D{eg.dustRank} · H{eg.mattRank}</div>
                      </div>
                    )
                  })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Solo Picks */}
      <div>
        <h2 className="font-display text-3xl text-white tracking-wide leading-none mb-1">SOLO PICKS</h2>
        <p className="font-serif italic text-base text-gray-400 mb-5">Films one person ranked that the other never did — across all 4 editions</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: DC }} />
              <PanelHeader title="Dust's Exclusives" />
            </div>
            <p className="font-serif italic text-base text-gray-400 mb-4">{dustOnly.length} films Dust ranked that Hermz never did</p>
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {dustOnly.map(f => (
                <Link key={f.filmId} to={`/movies/${f.filmId}`}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                  <span className="text-base text-gray-200 group-hover:text-film-400 transition-colors truncate">{f.title}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: HC }} />
              <PanelHeader title="Hermz's Exclusives" />
            </div>
            <p className="font-serif italic text-base text-gray-400 mb-4">{mattOnly.length} films Hermz ranked that Dust never did</p>
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {mattOnly.map(f => (
                <Link key={f.filmId} to={`/movies/${f.filmId}`}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                  <span className="text-base text-gray-200 group-hover:text-film-400 transition-colors truncate">{f.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>


    </div>
  )
}

// ── SCORE ANALYSIS TAB ────────────────────────────────────────────────────────
function ScoreAnalysisTab({ scoresData, profiles, events }) {
  const [selectedEvent, setSelectedEvent] = useState(2026)
  const [expandedCat, setExpandedCat]     = useState(null)
  const [filmsCache, setFilmsCache]       = useState({})
  const [filmsLoading, setFilmsLoading]   = useState(false)

  const eventData = scoresData?.[selectedEvent]

  // Clear expansion when event changes
  useEffect(() => { setExpandedCat(null) }, [selectedEvent])

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
        const norm = cat.normalize ? 0.5 : 1
        return {
          category: cat.label,
          Dust:  dustVal != null ? +(dustVal * norm).toFixed(2) : null,
          Hermz: mattVal != null ? +(mattVal * norm).toFixed(2) : null,
        }
      })
      .filter(d => d.Dust != null || d.Hermz != null)
  }, [eventData, selectedEvent])

  const tensData = useMemo(() => {
    if (!eventData) return []
    return SCORE_CATS
      .filter(cat => {
        if (cat.until && selectedEvent > cat.until) return false
        if (cat.since && selectedEvent < cat.since) return false
        return true
      })
      .map(cat => ({
        category:  cat.label,
        catKey:    cat.key,
        threshold: cat.max,
        Dust:  eventData.dustinTens?.[cat.key] || 0,
        Hermz: eventData.mattTens?.[cat.key]   || 0,
      }))
      .filter(d => d.Dust > 0 || d.Hermz > 0)
      .sort((a, b) => (b.Dust + b.Hermz) - (a.Dust + a.Hermz))
  }, [eventData, selectedEvent])

  const dustTenTotal  = Object.values(eventData?.dustinTens || {}).reduce((s, v) => s + v, 0)
  const hermzTenTotal = Object.values(eventData?.mattTens   || {}).reduce((s, v) => s + v, 0)

  async function loadPerfectFilms(catKey, threshold) {
    const cacheKey = `${selectedEvent}_${catKey}`
    if (filmsCache[cacheKey]) return
    setFilmsLoading(true)
    const ev = events?.find(e => e.year === selectedEvent)
    if (!ev || !profiles) { setFilmsLoading(false); return }
    const dustinId = profiles['dustin']
    const mattId   = profiles['matt']
    const { data } = await supabase
      .from('individual_rankings')
      .select(`rank, ${catKey}, user_id, films (id, title)`)
      .eq('event_id', ev.id)
      .in('user_id', [dustinId, mattId].filter(Boolean))
      .gte(catKey, threshold)
      .order('rank', { ascending: true })
    if (data) {
      const dustFilms  = data.filter(r => r.user_id === dustinId).sort((a, b) => a.rank - b.rank)
      const hermzFilms = data.filter(r => r.user_id === mattId).sort((a, b) => a.rank - b.rank)
      setFilmsCache(prev => ({ ...prev, [cacheKey]: { dustFilms, hermzFilms } }))
    }
    setFilmsLoading(false)
  }

  function toggleCat(catKey, threshold) {
    if (expandedCat === catKey) { setExpandedCat(null); return }
    setExpandedCat(catKey)
    loadPerfectFilms(catKey, threshold)
  }

  const expandedRow  = tensData.find(t => t.catKey === expandedCat)
  const expandedData = expandedCat ? filmsCache[`${selectedEvent}_${expandedCat}`] : null

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-6">
        {EVENTS_ORDER.map(yr => (
          <button key={yr} onClick={() => setSelectedEvent(yr)}
                  className={yr === selectedEvent ? 'pill-film' : 'pill'}>{yr}</button>
        ))}
      </div>

      {!eventData ? (
        <p className="text-gray-500 text-sm text-center py-12 italic">Loading score data…</p>
      ) : (
        <div className="space-y-5">

          {/* ── Average scores — dumbbell chart ─────────────────────────────── */}
          <div className="card">
            <PanelHeader title="Average Scores by Category" subtitle={String(selectedEvent)} />
            <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">
              Average score per film across all {selectedEvent} ranked films. Personal Impact normalized to /10.
            </p>
            <div className="flex items-center gap-5 mb-5">
              <span className="flex items-center gap-2 font-mono text-xs tracking-kicker uppercase" style={{ color: DC }}>
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: DC }} /> Dust
              </span>
              <span className="flex items-center gap-2 font-mono text-xs tracking-kicker uppercase" style={{ color: HC }}>
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: HC }} /> Hermz
              </span>
              <span className="flex items-center gap-2 font-mono text-xs tracking-kicker uppercase text-gray-600">
                <span className="inline-block w-4 h-0.5 bg-night-600" /> gap
              </span>
            </div>
            <div className="space-y-1">
              {chartData.map(row => {
                const dPct     = row.Dust  != null ? (row.Dust  / 10) * 100 : null
                const hPct     = row.Hermz != null ? (row.Hermz / 10) * 100 : null
                const leftPct  = dPct != null && hPct != null ? Math.min(dPct, hPct) : 0
                const widthPct = dPct != null && hPct != null ? Math.abs(dPct - hPct) : 0
                const gapColor = dPct != null && hPct != null ? (dPct >= hPct ? DC : HC) : '#2A2734'
                const diff     = row.Dust != null && row.Hermz != null ? +(row.Dust - row.Hermz).toFixed(2) : null
                const diffColor = diff == null ? '#6B7280' : diff > 0 ? DC : diff < 0 ? HC : '#6B7280'
                const diffLabel = diff == null ? '—' : diff > 0 ? `D +${diff.toFixed(2)}` : diff < 0 ? `H +${Math.abs(diff).toFixed(2)}` : '—'
                return (
                  <div key={row.category} className="flex items-center gap-3 py-1.5">
                    <span className="font-mono text-xs text-gray-100 w-[108px] flex-shrink-0 text-right truncate">{row.category}</span>
                    <div className="flex-1 relative h-5 flex items-center">
                      <div className="absolute inset-x-0 h-px bg-night-700" />
                      {dPct != null && hPct != null && (
                        <div className="absolute h-px" style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: `${gapColor}55` }} />
                      )}
                      {dPct != null && (
                        <div className="absolute w-3 h-3 rounded-full z-10" style={{ left: `${dPct}%`, transform: 'translateX(-50%)', background: DC, boxShadow: '0 0 0 2px #15141E' }} />
                      )}
                      {hPct != null && (
                        <div className="absolute w-3 h-3 rounded-full z-10" style={{ left: `${hPct}%`, transform: 'translateX(-50%)', background: HC, boxShadow: '0 0 0 2px #15141E' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 w-[168px] justify-end">
                      <span className="font-mono text-sm tabular-nums font-semibold" style={{ color: DC }}>{row.Dust?.toFixed(2) ?? '—'}</span>
                      <span className="font-mono text-[11px] text-gray-700">·</span>
                      <span className="font-mono text-sm tabular-nums font-semibold" style={{ color: HC }}>{row.Hermz?.toFixed(2) ?? '—'}</span>
                      <span className="font-mono text-sm tracking-kicker uppercase w-[60px] text-right font-semibold" style={{ color: diffColor }}>{diffLabel}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Perfect scores — interactive card grid ───────────────────────── */}
          {tensData.length > 0 && (
            <div className="card">
              <PanelHeader title="Perfect Scores" subtitle={String(selectedEvent)} />
              <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">
                Count of 10s per category (20 for Personal Impact) — click a card to see the films
              </p>

              {/* totals */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl border border-night-600 bg-night-900/60 py-3 px-4 text-center">
                  <div className="font-display text-4xl tracking-wide leading-none" style={{ color: DC }}>{dustTenTotal}</div>
                  <div className="font-mono text-xs tracking-kicker text-gray-500 mt-2 uppercase">Dust total perfects</div>
                </div>
                <div className="rounded-xl border border-night-600 bg-night-900/60 py-3 px-4 text-center">
                  <div className="font-display text-4xl tracking-wide leading-none" style={{ color: HC }}>{hermzTenTotal}</div>
                  <div className="font-mono text-xs tracking-kicker text-gray-500 mt-2 uppercase">Hermz total perfects</div>
                </div>
              </div>

              {/* category cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 mb-3">
                {tensData.map(row => {
                  const isActive = expandedCat === row.catKey
                  return (
                    <button
                      key={row.catKey}
                      onClick={() => toggleCat(row.catKey, row.threshold)}
                      className={`rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
                        isActive
                          ? 'border-film-500/70 bg-film-500/10'
                          : 'border-night-600 bg-night-900/60 hover:border-night-500 hover:bg-night-800/50'
                      }`}
                    >
                      <div className="font-mono text-[11px] tracking-kicker text-white uppercase leading-tight mb-2">{row.category}</div>
                      <div className="flex items-baseline gap-1.5 justify-end">
                        <span className="font-display text-2xl tracking-wide leading-none" style={{ color: DC }}>{row.Dust}</span>
                        <span className="font-mono text-sm text-gray-700">/</span>
                        <span className="font-display text-2xl tracking-wide leading-none" style={{ color: HC }}>{row.Hermz}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* expanded film list */}
              {expandedCat && (
                <div className="rounded-xl border border-night-600 bg-night-900/40 p-4 mt-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl text-white tracking-wide leading-none">{expandedRow?.category}</span>
                      <span className="font-mono text-xs tracking-kicker text-gray-500 uppercase">perfect scores · {selectedEvent}</span>
                    </div>
                    <button onClick={() => setExpandedCat(null)}
                            className="font-mono text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1">✕</button>
                  </div>

                  {filmsLoading && !expandedData ? (
                    <div className="py-6 text-center font-mono text-xs tracking-kicker text-gray-500 animate-pulse uppercase">Loading films…</div>
                  ) : expandedData ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Dust column */}
                      <div>
                        <div className="font-mono text-xs tracking-kicker uppercase pb-2 mb-2 border-b border-night-700" style={{ color: DC }}>
                          Dust · {expandedData.dustFilms.length} film{expandedData.dustFilms.length !== 1 ? 's' : ''}
                        </div>
                        {expandedData.dustFilms.length === 0 ? (
                          <p className="font-mono text-xs text-gray-600 italic py-2">None</p>
                        ) : (
                          <div className="space-y-0.5">
                            {expandedData.dustFilms.map((r, i) => (
                              <Link key={i} to={`/movies/${r.films?.id}`}
                                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-night-700/40 transition-colors group">
                                <span className="font-mono text-xs text-gray-600 w-7 text-right flex-shrink-0">#{r.rank}</span>
                                <span className="text-sm text-gray-200 group-hover:text-film-400 transition-colors truncate flex-1">{r.films?.title ?? '?'}</span>
                                <span className="font-display text-lg leading-none flex-shrink-0" style={{ color: DC }}>{r[expandedCat]}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Hermz column */}
                      <div>
                        <div className="font-mono text-xs tracking-kicker uppercase pb-2 mb-2 border-b border-night-700" style={{ color: HC }}>
                          Hermz · {expandedData.hermzFilms.length} film{expandedData.hermzFilms.length !== 1 ? 's' : ''}
                        </div>
                        {expandedData.hermzFilms.length === 0 ? (
                          <p className="font-mono text-xs text-gray-600 italic py-2">None</p>
                        ) : (
                          <div className="space-y-0.5">
                            {expandedData.hermzFilms.map((r, i) => (
                              <Link key={i} to={`/movies/${r.films?.id}`}
                                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-night-700/40 transition-colors group">
                                <span className="font-mono text-xs text-gray-600 w-7 text-right flex-shrink-0">#{r.rank}</span>
                                <span className="text-sm text-gray-200 group-hover:text-film-400 transition-colors truncate flex-1">{r.films?.title ?? '?'}</span>
                                <span className="font-display text-lg leading-none flex-shrink-0" style={{ color: HC }}>{r[expandedCat]}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── PODCAST PREP TAB ──────────────────────────────────────────────────────────
function PodcastPrepTab({ allTimeData }) {
  const { filmMap, byFilm, byEvent } = allTimeData
  const navigate = useNavigate()
  const list2026 = useMemo(() => {
    if (!byEvent[2026]) return []
    return [...byEvent[2026]].sort((a, b) => a.rank - b.rank).map(({ filmId, rank }) => ({
      filmId, rank, film: filmMap[filmId],
      prev2016: byFilm[filmId]?.[2016] ?? null,
      isNew: !byFilm[filmId]?.[2016] && !byFilm[filmId]?.[2007] && !byFilm[filmId]?.[2001],
    }))
  }, [filmMap, byFilm, byEvent])
  const top10 = list2026.slice(0, 10)
  const newFilms = list2026.filter(f => f.isNew)
  const biggestRisers2026 = useMemo(() => list2026.filter(f => f.prev2016 != null)
    .map(f => ({ ...f, improvement: f.prev2016 - f.rank })).filter(f => f.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement).slice(0, 5), [list2026])
  const alwaysPresent = useMemo(() => Object.entries(byFilm)
    .filter(([, ranks]) => EVENTS_ORDER.every(y => ranks[y] != null))
    .map(([filmId, ranks]) => ({ filmId: Number(filmId), title: filmMap[filmId]?.title || '?', rank2026: ranks[2026] }))
    .sort((a, b) => a.rank2026 - b.rank2026), [filmMap, byFilm])
  const totalFilms = list2026.length
  const decades = {}, genres = {}
  list2026.forEach(({ film }) => {
    if (!film) return
    const d = decade(film.release_year); if (d) decades[d] = (decades[d] || 0) + 1
    const g = primaryGenre(film);        if (g) genres[g]  = (genres[g] || 0) + 1
  })
  const topDecade = Object.entries(decades).sort(([, a], [, b]) => b - a)[0]
  const topGenre  = Object.entries(genres).sort(([, a], [, b]) => b - a)[0]
  function FilmPill({ filmId, rank, title, sub }) {
    return (
      <button onClick={() => navigate(`/movies/${filmId}`)}
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-night-900/60 hover:bg-night-700/60 transition-colors text-left w-full">
        <span className="font-display text-lg text-gray-500 tracking-wide w-8 text-right flex-shrink-0 leading-none">#{rank}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{title}</div>
          {sub && <div className="font-mono text-xs tracking-kicker text-gray-500 mt-0.5 uppercase truncate">{sub}</div>}
        </div>
      </button>
    )
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 print:hidden">
        <div>
          <PanelHeader title="2026 Combined List" subtitle="Podcast Prep" />
          <p className="font-serif italic text-base text-gray-400 mt-1">
            {totalFilms} films · Top decade: {topDecade ? `${decadeLabel(Number(topDecade[0]))} (${topDecade[1]})` : '—'} · Top genre: {topGenre?.[0] ?? '—'}
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-ghost text-xs">🖨 Print</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card lg:col-span-2">
          <PanelHeader title="Top 10" />
          <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">2026 combined list — the cream of the crop</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {top10.map(f => (
              <FilmPill key={f.filmId} filmId={f.filmId} rank={f.rank} title={f.film?.title ?? '?'}
                sub={f.prev2016
                  ? `was #${f.prev2016} in '16 · ${f.prev2016 - f.rank > 0 ? `↑${f.prev2016 - f.rank}` : f.prev2016 - f.rank < 0 ? `↓${Math.abs(f.prev2016 - f.rank)}` : '●'}`
                  : f.isNew ? '★ NEW TO COMBINED LISTS' : "NR in '16"} />
            ))}
          </div>
        </div>
        <div className="card">
          <PanelHeader title="New Additions" />
          <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">{newFilms.length} films appearing on a combined list for the first time</p>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {newFilms.map(f => <FilmPill key={f.filmId} filmId={f.filmId} rank={f.rank} title={f.film?.title ?? '?'} sub={f.film?.release_year ?? ''} />)}
          </div>
        </div>
        <div className="card">
          <PanelHeader title="Biggest Risers vs '16" />
          <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Films that climbed most since the 2016 combined list</p>
          <div className="space-y-1.5">
            {biggestRisers2026.length === 0
              ? <p className="text-gray-500 text-sm text-center py-4 italic">—</p>
              : biggestRisers2026.map(f => (
                  <FilmPill key={f.filmId} filmId={f.filmId} rank={f.rank} title={f.film?.title ?? '?'}
                    sub={`was #${f.prev2016} in '16 · ↑${f.improvement} spots`} />
                ))}
          </div>
        </div>
        <div className="card lg:col-span-2">
          <PanelHeader title="On All 4 Lists" />
          <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">{alwaysPresent.length} films that made every combined list since 2001</p>
          {alwaysPresent.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4 italic">None.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alwaysPresent.map(f => (
                <FilmPill key={f.filmId} filmId={f.filmId} rank={f.rank2026} title={f.title} sub="Present in 2001, 2007, 2016 & 2026" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CROSSOVER TAB ─────────────────────────────────────────────────────────────
const EVENTS_LABEL = { 2001: "'01", 2007: "'07", 2016: "'16", 2026: "'26" }
const MAJOR_CATS = [
  { key: 'Best Picture',             label: 'Picture'           },
  { key: 'Best Director',            label: 'Director'          },
  { key: 'Best Actor',               label: 'Actor'             },
  { key: 'Best Actress',             label: 'Actress'           },
  { key: 'Best Supporting Actor',    label: 'Supp. Actor'       },
  { key: 'Best Supporting Actress',  label: 'Supp. Actress'     },
  { key: 'Best Original Screenplay', label: 'Orig. Screenplay'  },
  { key: 'Best Adapted Screenplay',  label: 'Adapt. Screenplay' },
]

function CrossoverTab({ data }) {
  const { films, totalWithNoms, totalWithWins, totalFilmsOnLists } = data
  const [filter,     setFilter]     = useState('all')
  const [catFilter,  setCatFilter]  = useState(null)
  const [yearFilter, setYearFilter] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  let displayed = filter === 'wins' ? films.filter(f => f.oscarWins > 0)
    : filter === 'noms' ? films.filter(f => f.oscarWins === 0 && f.oscarNoms > 0)
    : films
  if (yearFilter)  displayed = displayed.filter(f => f.combinedRanks[yearFilter] != null)
  if (catFilter)   displayed = displayed.filter(f => f.winCategories.includes(catFilter))
  displayed = [...displayed].sort((a, b) => {
    if (yearFilter) {
      const ra = a.combinedRanks[yearFilter] ?? 999, rb = b.combinedRanks[yearFilter] ?? 999
      return ra - rb || b.oscarWins - a.oscarWins
    }
    return b.oscarWins - a.oscarWins || (a.bestCombinedRank ?? 999) - (b.bestCombinedRank ?? 999)
  })
  function toggleCat(key) { setCatFilter(prev => prev === key ? null : key); if (catFilter !== key) setFilter('all') }
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { v: totalFilmsOnLists,              label: 'On Combined Lists', color: 'text-white' },
          { v: totalWithNoms,                   label: 'With Oscar Noms',   color: 'text-gold-400' },
          { v: totalWithWins,                   label: 'With Oscar Wins',   color: 'text-emerald-400' },
          { v: totalFilmsOnLists - totalWithNoms, label: 'No Oscar Data',   color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="card text-center py-5">
            <div className={`font-display text-3xl leading-none tracking-wide ${s.color}`}>{s.v}</div>
            <div className="font-mono text-xs tracking-kicker text-gray-500 mt-2 uppercase">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <PanelHeader title="Oscar × Our Rankings" />
              <p className="font-serif italic text-base text-gray-400 mt-1">Films on our combined lists with Oscar recognition</p>
            </div>
            <div className="flex gap-1 p-1 bg-night-900/60 rounded-full flex-shrink-0">
              {[{ v: 'all', label: 'All' }, { v: 'wins', label: '🏆 Winners' }, { v: 'noms', label: 'Noms Only' }].map(opt => (
                <button key={opt.v} onClick={() => { setFilter(opt.v); setCatFilter(null) }}
                  className={`px-3 py-1 rounded-full font-mono text-xs tracking-kicker uppercase transition-all ${
                    filter === opt.v && !catFilter ? 'bg-white text-night-950' : 'text-gray-400 hover:text-white'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="font-mono text-xs tracking-kicker text-gray-500 uppercase flex-shrink-0">LIST</span>
            {[null, 2001, 2007, 2016, 2026].map(yr => (
              <button key={yr ?? 'all'} onClick={() => setYearFilter(yr)} className={yearFilter === yr ? 'pill-film' : 'pill'}>{yr ?? 'All'}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs tracking-kicker text-gray-500 uppercase flex-shrink-0">WON</span>
            {MAJOR_CATS.map(cat => (
              <button key={cat.key} onClick={() => toggleCat(cat.key)}
                className={catFilter === cat.key
                  ? 'px-3 py-1.5 rounded-full font-medium text-xs bg-emerald-500 text-night-950 border-0'
                  : 'pill'}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header text-left w-10">#</th>
                <th className="table-header">Film</th>
                <th className="table-header text-center">Wins</th>
                <th className="table-header text-center">Noms</th>
                <th className="table-header text-center hidden sm:table-cell">{yearFilter ? `${yearFilter} Rank` : 'Best Rank'}</th>
                <th className="table-header text-center hidden lg:table-cell">Combined Ranks</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((f, i) => {
                const isExpanded = expandedId === f.filmId
                const hasBP = f.winCategories.includes('Best Picture')
                const hasBD = f.winCategories.includes('Best Director')
                return (
                  <Fragment key={f.filmId}>
                    <tr className="table-row-hover cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : f.filmId)}>
                      <td className="table-cell text-gray-500 font-mono text-sm tracking-kicker">{i + 1}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <FilmStill src={f.poster_url} title={f.title} className="w-9 h-12 rounded border border-white/10 flex-shrink-0" />
                          <div className="min-w-0">
                            <Link to={`/movies/${f.filmId}`} onClick={e => e.stopPropagation()}
                                  className="text-sm font-semibold text-white hover:text-film-400 transition-colors truncate block">{f.title}</Link>
                            <div className="font-mono text-xs tracking-kicker text-gray-500 mt-1 flex items-center gap-2 uppercase flex-wrap">
                              {f.release_year && <span>{f.release_year}</span>}
                              {hasBP && <span className="text-gold-400">● Best Picture</span>}
                              {hasBD && !hasBP && <span className="text-cinema-400">● Best Director</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        {f.oscarWins > 0
                          ? <span className="font-display text-xl text-emerald-400 tracking-wide leading-none">{f.oscarWins}</span>
                          : <span className="font-mono text-[11px] text-gray-700">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        <span className="font-mono text-sm text-gray-400 tabular-nums">{f.oscarNoms}</span>
                      </td>
                      <td className="table-cell text-center hidden sm:table-cell">
                        {(() => {
                          const r = yearFilter ? f.combinedRanks[yearFilter] : f.bestCombinedRank
                          if (r == null) return <span className="text-gray-700">—</span>
                          const c = r <= 5 ? 'text-gold-400' : r <= 15 ? 'text-film-400' : 'text-gray-400'
                          return <span className={`font-display text-xl tracking-wide leading-none ${c}`}>#{r}</span>
                        })()}
                      </td>
                      <td className="table-cell text-center hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-2">
                          {EVENTS_ORDER.map(yr => {
                            const r = f.combinedRanks[yr]
                            return (
                              <div key={yr} className="text-center">
                                <div className="font-mono text-sm tracking-kicker text-gray-600 leading-none">{EVENTS_LABEL[yr]}</div>
                                <div className={`font-mono text-[11px] leading-tight mt-0.5 tabular-nums ${r ? (r <= 5 ? 'text-gold-400' : r <= 15 ? 'text-film-400' : 'text-gray-400') : 'text-gray-700'}`}>
                                  {r ? `#${r}` : '–'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-night-700/60 bg-night-900/40">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          {f.winCategories.length > 0 && (
                            <div className="mb-2">
                              <span className="font-mono text-[11px] tracking-cinema text-emerald-400 uppercase mr-2">WON</span>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {f.winCategories.map(c => (
                                  <span key={c} className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {f.nomCategories.length > 0 && (
                            <div>
                              <span className="font-mono text-[11px] tracking-cinema text-gray-400 uppercase mr-2">NOMINATED</span>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {f.nomCategories.map(c => (
                                  <span key={c} className="text-xs bg-night-700 text-gray-400 border border-night-600 px-2 py-0.5 rounded-full">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {displayed.length === 0 && (
            <div className="py-12 text-center text-gray-500 text-sm italic">
              {catFilter && yearFilter ? `No films on our ${yearFilter} combined list won ${catFilter}.`
                : catFilter ? `No films on our combined lists won ${catFilter}.`
                : yearFilter ? `No Oscar data for films on our ${yearFilter} combined list.`
                : 'No films match this filter.'}
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

  const eventYear = Number(searchParams.get('event')) || 2026
  const view      = searchParams.get('view') || 'combined'
  const tab       = searchParams.get('tab')  || 'charts'

  const [events,   setEvents]   = useState([])
  const [profiles, setProfiles] = useState({})

  // Charts tab
  const [chartsFilms,   setChartsFilms]   = useState([])
  const [chartsLoading, setChartsLoading] = useState(true)
  const [chartsError,   setChartsError]   = useState(null)

  // H2H / Taste Face-Off (all years, for Rivalry tab)
  const [allH2HFilms,   setAllH2HFilms]   = useState({})
  const [allH2HLoading, setAllH2HLoading] = useState(false)

  // All Events tab
  const [allTimeData,    setAllTimeData]    = useState(null)
  const [allTimeLoading, setAllTimeLoading] = useState(true)

  // Rivalry tab
  const [rivalryData,    setRivalryData]    = useState(null)
  const [rivalryLoading, setRivalryLoading] = useState(false)

  // Scores tab
  const [scoresData,    setScoresData]    = useState(null)
  const [scoresLoading, setScoresLoading] = useState(true)

  // Crossover tab
  const [crossoverData,    setCrossoverData]    = useState(null)
  const [crossoverLoading, setCrossoverLoading] = useState(false)

  // Load meta
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

  // Load all-time combined data
  useEffect(() => {
    async function loadAllTime() {
      setAllTimeLoading(true)
      const { data, error } = await supabase
        .from('combined_rankings')
        .select(`
          combined_rank, film_id, event_id,
          ranking_events (year),
          films (id, title, release_year, director, writer, omdb_genres, custom_genre_1,
                 actor_1, actor_2, actor_3, actor_4, actor_5,
                 actor_6, actor_7, actor_8, actor_9, actor_10, poster_url)
        `)
      if (error) { setAllTimeLoading(false); return }
      const filmMap = {}, byFilm = {}, byEvent = {}
      data?.forEach(row => {
        const year = row.ranking_events?.year
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

  // Load rivalry data (lazy — only when tab is opened)
  useEffect(() => {
    if (tab !== 'rivalry' || Object.keys(profiles).length === 0 || rivalryData) return
    async function loadRivalry() {
      setRivalryLoading(true)
      const dustinId = profiles['dustin']
      const mattId   = profiles['matt']

      const { data } = await supabase
        .from('individual_rankings')
        .select(`
          film_id, user_id, rank, event_id,
          ranking_events (year),
          films (id, title, poster_url, release_year)
        `)
        .not('rank', 'is', null)

      if (!data) { setRivalryLoading(false); return }

      const filmMap  = {}
      const byFilmByYear = {}
      const dustinSet = new Set()
      const mattSet   = new Set()

      data.forEach(row => {
        const filmId = String(row.film_id)
        const year   = row.ranking_events?.year
        if (!year) return
        if (row.films) filmMap[filmId] = row.films

        if (row.user_id === dustinId) {
          dustinSet.add(filmId)
          if (!byFilmByYear[filmId]) byFilmByYear[filmId] = {}
          if (!byFilmByYear[filmId][year]) byFilmByYear[filmId][year] = {}
          byFilmByYear[filmId][year].dustRank = row.rank
        } else if (row.user_id === mattId) {
          mattSet.add(filmId)
          if (!byFilmByYear[filmId]) byFilmByYear[filmId] = {}
          if (!byFilmByYear[filmId][year]) byFilmByYear[filmId][year] = {}
          byFilmByYear[filmId][year].mattRank = row.rank
        }
      })

      // Build gap map — only where both ranked the film in the same event
      const gapsByFilm = {}
      Object.entries(byFilmByYear).forEach(([filmId, years]) => {
        const sharedYears = Object.entries(years).filter(([, r]) => r.dustRank && r.mattRank)
        if (sharedYears.length === 0) return
        gapsByFilm[filmId] = {}
        sharedYears.forEach(([year, ranks]) => {
          gapsByFilm[filmId][Number(year)] = {
            dustRank: ranks.dustRank,
            mattRank: ranks.mattRank,
            gap: ranks.mattRank - ranks.dustRank, // positive = Dust ranked higher
          }
        })
      })

      // Solo picks — ranked by one, never by the other across all events
      const dustOnly = [...dustinSet]
        .filter(id => !mattSet.has(id))
        .map(id => ({ filmId: Number(id), title: filmMap[id]?.title || '?', poster_url: filmMap[id]?.poster_url }))
        .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))

      const mattOnly = [...mattSet]
        .filter(id => !dustinSet.has(id))
        .map(id => ({ filmId: Number(id), title: filmMap[id]?.title || '?', poster_url: filmMap[id]?.poster_url }))
        .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))

      setRivalryData({ gapsByFilm, filmMap, dustOnly, mattOnly })
      setRivalryLoading(false)
    }
    loadRivalry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profiles])

  // Load scores data
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
      const dustinId = profiles['dustin'], mattId = profiles['matt']
      const raw = {}
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
      const result = {}
      Object.entries(raw).forEach(([year, byUser]) => {
        result[Number(year)] = {}
        const avgs = (uid) => {
          if (!byUser[uid]) return {}
          const o = {}
          Object.entries(byUser[uid]).forEach(([k, vs]) => { o[k] = vs.reduce((s, v) => s + v, 0) / vs.length })
          return o
        }
        const counts10 = (uid) => {
          if (!byUser[uid]) return {}
          const o = {}
          SCORE_CATS.forEach(cat => {
            const vs = byUser[uid][cat.key]
            if (!vs) return
            const threshold = cat.key === 'score_personal_impact' ? 20 : 10
            const count = vs.filter(v => v >= threshold).length
            if (count > 0) o[cat.key] = count
          })
          return o
        }
        result[Number(year)].dustin     = avgs(dustinId)
        result[Number(year)].matt       = avgs(mattId)
        result[Number(year)].dustinTens = counts10(dustinId)
        result[Number(year)].mattTens   = counts10(mattId)
      })
      setScoresData(result)
      setScoresLoading(false)
    }
    loadScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles])

  // Load crossover data (lazy)
  useEffect(() => {
    if (tab !== 'crossover' || !allTimeData || crossoverData) return
    async function loadCrossover() {
      setCrossoverLoading(true)
      const byFilmRaw = allTimeData.byFilm
      const filmMapRaw = allTimeData.filmMap
      const totalFilmsOnLists = Object.keys(byFilmRaw).length
      const { data: noms } = await supabase.from('film_oscar_noms').select('film_id, category_name, is_winner').limit(10000)
      const oscarMap = {}
      ;(noms || []).forEach(n => {
        const idStr = String(n.film_id)
        const inLists = Object.prototype.hasOwnProperty.call(byFilmRaw, idStr)
                     || Object.prototype.hasOwnProperty.call(byFilmRaw, n.film_id)
        if (!inLists) return
        if (!oscarMap[idStr]) oscarMap[idStr] = { wins: 0, noms: 0, winCats: [], nomCats: [] }
        oscarMap[idStr].noms++
        if (n.is_winner) {
          oscarMap[idStr].wins++
          if (!oscarMap[idStr].winCats.includes(n.category_name)) oscarMap[idStr].winCats.push(n.category_name)
        } else {
          if (!oscarMap[idStr].nomCats.includes(n.category_name)) oscarMap[idStr].nomCats.push(n.category_name)
        }
      })
      const films = Object.entries(oscarMap).map(([filmId, stats]) => {
        const f = filmMapRaw[filmId] || filmMapRaw[Number(filmId)] || {}
        const ranks = byFilmRaw[filmId] || byFilmRaw[Number(filmId)] || {}
        const rankValues = Object.values(ranks).filter(Boolean)
        return {
          filmId, title: f.title, poster_url: f.poster_url, director: f.director,
          release_year: f.release_year, oscarWins: stats.wins, oscarNoms: stats.noms,
          winCategories: stats.winCats, nomCategories: stats.nomCats,
          combinedRanks: ranks, eventCount: rankValues.length,
          bestCombinedRank: rankValues.length ? Math.min(...rankValues) : null,
        }
      })
      films.sort((a, b) => b.oscarWins - a.oscarWins || (a.bestCombinedRank ?? 999) - (b.bestCombinedRank ?? 999))
      const totalWithNoms = films.length
      const totalWithWins = films.filter(f => f.oscarWins > 0).length
      setCrossoverData({ films, totalWithNoms, totalWithWins, totalFilmsOnLists })
      setCrossoverLoading(false)
    }
    loadCrossover()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, allTimeData])

  // Load H2H data for all 4 years (used by Taste Face-Off on Rivalry tab)
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return
    const dustinId = profiles['dustin']
    const mattId   = profiles['matt']
    const filmFields = `id, title, release_year, omdb_genres, custom_genre_1, custom_genre_2`
    async function loadAllH2H() {
      setAllH2HLoading(true)
      try {
        const results = await Promise.all(
          EVENTS_ORDER.map(async yr => {
            const ev = events.find(e => e.year === yr)
            if (!ev) return [yr, { dustin: [], matt: [] }]
            const [dustRes, mattRes] = await Promise.all([
              supabase.from('individual_rankings').select(`films (${filmFields})`).eq('event_id', ev.id).eq('user_id', dustinId),
              supabase.from('individual_rankings').select(`films (${filmFields})`).eq('event_id', ev.id).eq('user_id', mattId),
            ])
            return [yr, {
              dustin: (dustRes.data || []).map(r => r.films).filter(Boolean),
              matt:   (mattRes.data || []).map(r => r.films).filter(Boolean),
            }]
          })
        )
        const map = {}
        results.forEach(([yr, data]) => { map[yr] = data })
        setAllH2HFilms(map)
      } finally {
        setAllH2HLoading(false)
      }
    }
    loadAllH2H()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, events])

  // Load charts data (main view only)
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return
    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return
    setChartsLoading(true); setChartsError(null)
    setChartsFilms([])

    const filmFields = `id, title, release_year, director, writer, omdb_genres, custom_genre_1, custom_genre_2,
                        actor_1, actor_2, actor_3, actor_4, actor_5,
                        actor_6, actor_7, actor_8, actor_9, actor_10`

    async function fetchChartsData() {
      try {
        let res
        if (view === 'combined') {
          res = await supabase.from('combined_rankings').select(`films (${filmFields})`).eq('event_id', currentEvent.id)
        } else {
          const userId = profiles[view]
          if (!userId) throw new Error(`Profile not found for ${view}`)
          res = await supabase.from('individual_rankings').select(`films (${filmFields})`)
            .eq('event_id', currentEvent.id).eq('user_id', userId)
        }
        if (res.error) throw res.error
        setChartsFilms((res.data || []).map(r => r.films).filter(Boolean))
      } catch (e) {
        setChartsError(e.message)
      } finally {
        setChartsLoading(false)
      }
    }
    fetchChartsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYear, view, profiles, events])

  function setTab(t)    { setSearchParams({ event: eventYear, view, tab: t }) }
  function setEvent(yr) { setSearchParams({ event: yr, view, tab }) }
  function setView(v)   { setSearchParams({ event: eventYear, view: v, tab }) }

  const viewLabel = view === 'combined' ? 'Combined List' : view === 'dustin' ? "Dust's List" : "Hermz's List"
  const chartColor = view === 'matt' ? HC : view === 'dustin' ? DC : CC

  const TABS = [
    { value: 'charts',    label: 'Charts'      },
    { value: 'allevents', label: 'All Events'  },
    { value: 'rivalry',   label: 'Rivalry'     },
    { value: 'scores',    label: 'Scores'      },
    { value: 'podcast',   label: 'Podcast Prep'},
    { value: 'crossover', label: 'Crossover'   },
  ]

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <FilmStill
        title={`Hermz and D Stats ${eventYear}`}
        hue={view === 'matt' ? 36 : view === 'dustin' ? 234 : 200}
        mood="cool"
        className="w-full h-[300px] sm:h-[340px] print:hidden"
      >
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-sm tracking-kicker text-film-400 hover:text-film-300 transition-colors">← FILMS</Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-sm tracking-kicker text-white uppercase">Stats &amp; Charts</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">STATS &amp; CHARTS</h1>
        </div>
        <div className="absolute top-6 right-6 sm:right-10 z-10">
          <Link to={`/movies/list?event=${eventYear}&view=${view}`} className="btn-ghost text-xs">📋 View Rankings</Link>
        </div>
      </FilmStill>

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 print:py-4">

        {/* Tab nav */}
        <div className="flex flex-wrap gap-1.5 mb-8 print:hidden">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
                    className={tab === t.value ? 'pill-active' : 'pill'}>{t.label}</button>
          ))}
        </div>

        {/* ── CHARTS TAB ───────────────────────────────────────────────────── */}
        {tab === 'charts' && (
          <>
            {/* Event + view selectors */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex flex-wrap gap-1.5">
                {EVENTS_ORDER.map(yr => (
                  <button key={yr} onClick={() => setEvent(yr)} className={yr === eventYear ? 'pill-film' : 'pill'}>{yr}</button>
                ))}
              </div>
              <span className="hidden sm:block w-px h-6 bg-night-700" />
              <div className="flex gap-1 p-1 bg-night-800/80 rounded-full">
                {[{ value: 'combined', label: 'Combined' }, { value: 'dustin', label: "Dust's List" }, { value: 'matt', label: "Hermz's List" }].map(opt => (
                  <button key={opt.value} onClick={() => setView(opt.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      view === opt.value
                        ? opt.value === 'matt'    ? 'bg-gold-500 text-night-950'
                        : opt.value === 'dustin'  ? 'bg-film-500 text-night-950'
                        : 'bg-cinema-500 text-night-950'
                        : 'text-gray-400 hover:text-white'
                    }`}>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {chartsLoading && (
              <div className="py-16 flex items-center justify-center">
                <span className="font-mono text-sm tracking-kicker text-gray-500 animate-pulse">LOADING {eventYear} STATS…</span>
              </div>
            )}
            {chartsError && <div className="py-8 text-center text-red-400 text-sm">Error: {chartsError}</div>}

            {!chartsLoading && !chartsError && chartsFilms.length > 0 && (
              <>
                <QuickStats films={chartsFilms} />
                <p className="font-mono text-xs tracking-kicker text-gray-500 mb-6 uppercase">
                  {eventYear} · <span className="text-gray-200">{viewLabel}</span>
                  <span className="text-gray-600 ml-2">({chartsFilms.length} films)</span>
                </p>

                {/* Decade + Genre */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="card">
                    <PanelHeader title="By Decade" />
                    <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Films grouped by release decade</p>
                    <DecadeChart films={chartsFilms} color={chartColor} />
                  </div>
                  <div className="card">
                    <PanelHeader title="By Genre" />
                    <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Primary genre — top 12</p>
                    <GenreChart films={chartsFilms} color={chartColor} />
                  </div>
                </div>

                {/* Directors + Actors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="card">
                    <PanelHeader title="Top Directors" />
                    <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Directors with 2+ films on this list</p>
                    <PersonChart films={chartsFilms} type="director" color={chartColor} />
                  </div>
                  <div className="card">
                    <PanelHeader title="Top Actors" />
                    <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Top-billed cast (leads only) with 2+ films on this list</p>
                    <PersonChart films={chartsFilms} type="actor" color={chartColor} />
                  </div>
                </div>

                {/* Screenwriters */}
                <div className="mb-5">
                  <div className="card">
                    <PanelHeader title="Top Screenwriters" />
                    <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">Writers with 2+ films on this list</p>
                    <PersonChart films={chartsFilms} type="writer" color={chartColor} />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── ALL EVENTS TAB ───────────────────────────────────────────────── */}
        {tab === 'allevents' && (
          allTimeLoading ? (
            <div className="py-16 flex items-center justify-center">
              <span className="font-mono text-sm tracking-kicker text-gray-500 animate-pulse">LOADING ALL-TIME DATA…</span>
            </div>
          ) : !allTimeData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load all-time data.</div>
          ) : (
            <div className="space-y-7">
              <div className="card">
                <PanelHeader title="Bump Chart" subtitle="Combined Rankings" />
                <p className="font-serif italic text-base text-gray-400 mt-1 mb-4">
                  Rank trajectory across all 4 editions. Rank 1 at top. Gaps = not on that edition's combined list.
                </p>
                <BumpChart allTimeData={allTimeData} />
              </div>

              <div>
                <h2 className="font-display text-3xl text-white tracking-wide leading-none mb-1">RANK MOVEMENTS</h2>
                <p className="font-serif italic text-base text-gray-400 mb-4">Between consecutive events</p>
                <RankMovementsSection allTimeData={allTimeData} />
              </div>

              <div>
                <h2 className="font-display text-3xl text-white tracking-wide leading-none mb-1">ALL-TIME ARC</h2>
                <p className="font-serif italic text-base text-gray-400 mb-4">Biggest movement from first to last combined list appearance</p>
                <AllTimeArcSection allTimeData={allTimeData} />
              </div>

              <AlwaysPresentSection allTimeData={allTimeData} />
              <InAndOutSection allTimeData={allTimeData} />
            </div>
          )
        )}

        {/* ── RIVALRY TAB ──────────────────────────────────────────────────── */}
        {tab === 'rivalry' && (
          rivalryLoading ? (
            <div className="py-16 flex items-center justify-center">
              <span className="font-mono text-sm tracking-kicker text-gray-500 animate-pulse">LOADING RIVALRY DATA…</span>
            </div>
          ) : !rivalryData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load rivalry data.</div>
          ) : (
            <RivalryTab rivalryData={rivalryData} allH2HFilms={allH2HFilms} allH2HLoading={allH2HLoading} />
          )
        )}

        {/* ── SCORES TAB ───────────────────────────────────────────────────── */}
        {tab === 'scores' && (
          scoresLoading ? (
            <div className="py-16 flex items-center justify-center">
              <span className="font-mono text-sm tracking-kicker text-gray-500 animate-pulse">LOADING SCORE DATA…</span>
            </div>
          ) : !scoresData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load score data.</div>
          ) : (
            <ScoreAnalysisTab scoresData={scoresData} profiles={profiles} events={events} />
          )
        )}

        {/* ── PODCAST PREP TAB ─────────────────────────────────────────────── */}
        {tab === 'podcast' && (
          allTimeLoading ? (
            <div className="py-16 flex items-center justify-center">
              <span className="font-mono text-sm tracking-kicker text-gray-500 animate-pulse">LOADING…</span>
            </div>
          ) : !allTimeData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load data.</div>
          ) : (
            <PodcastPrepTab allTimeData={allTimeData} />
          )
        )}

        {/* ── CROSSOVER TAB ────────────────────────────────────────────────── */}
        {tab === 'crossover' && (
          (crossoverLoading || allTimeLoading) ? (
            <div className="py-16 flex items-center justify-center">
              <span className="font-mono text-sm tracking-kicker text-gray-500 animate-pulse">LOADING CROSSOVER DATA…</span>
            </div>
          ) : !crossoverData ? (
            <div className="py-8 text-center text-red-400 text-sm">Failed to load crossover data.</div>
          ) : (
            <CrossoverTab data={crossoverData} />
          )
        )}

      </div>
    </div>
  )
}
