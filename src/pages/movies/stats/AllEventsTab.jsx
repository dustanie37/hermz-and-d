import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import FilmStill from '../../../components/FilmStill'
import { DC, HC, CC, sortTitle } from '../../../lib/helpers'
import {
  EVENTS_ORDER, BUMP_COLORS, TOOLTIP, AXIS, GRID,
  PanelHeader, EmptyNote, MovementCard, shortYear,
} from './shared'

// ── THE PODIUM — top three per edition + each player's #1 ────────────────────
function PodiumSection({ allTimeData, rank1Data }) {
  const { filmMap, byEvent } = allTimeData

  const columns = useMemo(() => EVENTS_ORDER.map(year => {
    const top3 = [...(byEvent[year] || [])].sort((a, b) => a.rank - b.rank).slice(0, 3)
      .map(({ filmId, rank }) => ({ filmId, rank, film: filmMap[filmId] }))
    return { year, top3, ones: rank1Data?.[year] || {} }
  }), [filmMap, byEvent, rank1Data])

  // Most podium finishes across all editions
  const podiumKings = useMemo(() => {
    const counts = {}
    columns.forEach(c => c.top3.forEach(({ filmId }) => { counts[filmId] = (counts[filmId] || 0) + 1 }))
    return Object.entries(counts)
      .map(([filmId, n]) => ({ filmId: Number(filmId), title: filmMap[filmId]?.title || '?', n }))
      .sort((a, b) => b.n - a.n)
      .filter(f => f.n > 1)
      .slice(0, 3)
  }, [columns, filmMap])

  const RANK_COLOR = { 1: 'text-gold-400', 2: 'text-gray-300', 3: 'text-amber-600' }

  return (
    <div className="card">
      <PanelHeader title="The Podium" subtitle="Combined-list top three" />
      {podiumKings.length > 0 && (
        <p className="font-mono text-xs tracking-kicker text-gold-400 uppercase mb-5">
          MOST PODIUMS · {podiumKings.map(k => `${k.title} ×${k.n}`).join('  ·  ')}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map(col => (
          <div key={col.year} className="rounded-xl border border-night-600 bg-night-900/50 p-4">
            <div className="font-display text-3xl text-white tracking-wide leading-none mb-4">{col.year}</div>
            <div className="space-y-2.5 mb-4">
              {col.top3.map(({ filmId, rank, film }) => (
                <Link key={filmId} to={`/movies/${filmId}`} className="flex items-center gap-2.5 group">
                  <span className={`font-display text-2xl tracking-wide leading-none w-5 flex-shrink-0 text-center ${RANK_COLOR[rank] || 'text-gray-400'}`}>{rank}</span>
                  <FilmStill src={film?.poster_url} title={film?.title} className="w-8 h-11 rounded border border-white/10 flex-shrink-0" />
                  <span className="text-sm font-semibold text-white leading-tight group-hover:text-film-400 transition-colors">{film?.title || '?'}</span>
                </Link>
              ))}
            </div>
            <div className="border-t border-night-700/60 pt-3 space-y-1.5">
              {[{ who: 'DUST', color: DC, pick: col.ones.dust }, { who: 'HERMZ', color: HC, pick: col.ones.hermz }].map(({ who, color, pick }) => (
                <div key={who} className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs tracking-kicker w-14 flex-shrink-0" style={{ color }}>{who} #1</span>
                  {pick
                    ? <Link to={`/movies/${pick.filmId}`} className="text-sm text-gray-200 hover:text-film-400 transition-colors truncate">{pick.title}</Link>
                    : <span className="font-mono text-xs text-gray-500">—</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── EDITION TRENDS — nostalgia index + score inflation ───────────────────────
function EditionTrendsSection({ allTimeData, scoresData }) {
  const { filmMap, byEvent } = allTimeData

  // Avg film age (years old at ranking time) per edition — combined lists
  const ageData = useMemo(() => EVENTS_ORDER.map(year => {
    const entries = byEvent[year] || []
    const ages = entries
      .map(({ filmId }) => filmMap[filmId]?.release_year)
      .filter(Boolean)
      .map(ry => year - ry)
    const avg = ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null
    return { year: String(year), age: avg != null ? +avg.toFixed(1) : null }
  }), [filmMap, byEvent])

  // Avg total score (/100) per player per edition
  const totalData = useMemo(() => EVENTS_ORDER.map(year => {
    const yr = scoresData?.[year]
    const sum = obj => obj ? +Object.values(obj).reduce((s, v) => s + v, 0).toFixed(1) : null
    return { year: String(year), Dust: sum(yr?.dustin), Hermz: sum(yr?.matt) }
  }), [scoresData])

  const first = ageData.find(d => d.age != null)
  const last  = [...ageData].reverse().find(d => d.age != null)
  const aging = first && last && first !== last ? +(last.age - first.age).toFixed(1) : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="card">
        <PanelHeader title="The Nostalgia Index" subtitle="Average film age at ranking time" />
        {aging != null && (
          <p className="font-mono text-xs tracking-kicker uppercase mb-4" style={{ color: CC }}>
            {aging > 0 ? `THE CANON AGED ${aging} YRS SINCE ${EVENTS_ORDER[0]}` : aging < 0 ? `THE CANON GOT ${Math.abs(aging)} YRS YOUNGER SINCE ${EVENTS_ORDER[0]}` : 'THE CANON HELD ITS AGE'}
          </p>
        )}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={ageData} margin={{ left: -14, right: 18, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 12 }} />
            <YAxis tick={{ fill: AXIS, fontSize: 12 }} unit="y" domain={['dataMin - 4', 'dataMax + 4']} />
            <Tooltip contentStyle={TOOLTIP} formatter={v => [`${v} years old`, 'Avg film age']} />
            <Line type="monotone" dataKey="age" stroke={CC} strokeWidth={2.5}
                  dot={{ r: 4, fill: CC }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <PanelHeader title="Score Inflation" subtitle="Average total score per film (/100)" />
        <ResponsiveContainer width="100%" height={244}>
          <LineChart data={totalData} margin={{ left: -14, right: 18, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 12 }} />
            <YAxis tick={{ fill: AXIS, fontSize: 12 }} domain={['dataMin - 3', 'dataMax + 3']} />
            <Tooltip contentStyle={TOOLTIP} />
            <Line type="monotone" dataKey="Dust"  stroke={DC} strokeWidth={2.5} dot={{ r: 4, fill: DC }} isAnimationActive={false} />
            <Line type="monotone" dataKey="Hermz" stroke={HC} strokeWidth={2.5} dot={{ r: 4, fill: HC }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
      sortKey: [...EVENTS_ORDER].reverse().reduce((acc, y) => acc ?? ranks[y], null) ?? 999,
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
        <span className="kicker-dim">{filteredFilms.length} films</span>
      </div>
      {filteredFilms.length === 0 ? (
        <EmptyNote pad="py-8">No films match</EmptyNote>
      ) : (
        // min-w wrapper keeps the chart readable on phones — swipe horizontally (mobile QA 2026-07-03)
        <div className="overflow-x-auto">
        <div className="min-w-[560px]">
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
        </div>
        </div>
      )}
      <p className="sm:hidden font-mono text-xs tracking-kicker text-gray-500 mt-2 text-center uppercase">
        Swipe chart → to explore
      </p>
      <p className="font-mono text-xs tracking-kicker text-gray-500 mt-3 text-center uppercase">
        Combined lists · rank 1 at top · gap = not ranked that edition
      </p>
    </div>
  )
}

// ── RANK MOVEMENTS — one card, two views (consecutive / first-to-last) ───────
function MovementsSection({ allTimeData }) {
  const { filmMap, byFilm } = allTimeData
  const [mode, setMode] = useState('consecutive')

  const consecutive = useMemo(() => {
    const pairs = EVENTS_ORDER.slice(0, -1).map((y, i) => [y, EVENTS_ORDER[i + 1]])
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

  const arcs = useMemo(() => Object.entries(byFilm)
    .map(([filmId, ranks]) => {
      const years = EVENTS_ORDER.filter(y => ranks[y] != null)
      if (years.length < 2) return null
      const firstYear = years[0], lastYear = years[years.length - 1]
      if (firstYear === lastYear) return null
      const diff = ranks[firstYear] - ranks[lastYear]
      return { filmId: Number(filmId), title: filmMap[filmId]?.title || '?', diff, from: firstYear, to: lastYear, fromRank: ranks[firstYear], toRank: ranks[lastYear] }
    })
    .filter(Boolean), [filmMap, byFilm])

  const source = mode === 'consecutive' ? consecutive : arcs
  const risers  = useMemo(() => [...source].filter(m => m.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 8), [source])
  const fallers = useMemo(() => [...source].filter(m => m.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 8), [source])

  const VIEWS = [
    { value: 'consecutive', label: 'Edition to Edition' },
    { value: 'arc',         label: 'First to Last'      },
  ]

  return (
    <div className="card">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <PanelHeader title="Rank Movements" subtitle="Combined lists" />
        <div className="flex gap-1 p-1 bg-night-900/60 rounded-full flex-shrink-0">
          {VIEWS.map(v => (
            <button key={v.value} onClick={() => setMode(v.value)}
              className={`px-3 py-1 rounded-full font-mono text-xs tracking-kicker uppercase transition-all ${
                mode === v.value ? 'bg-white text-night-950' : 'text-gray-400 hover:text-white'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        <div>
          <div className="font-mono text-xs tracking-kicker text-emerald-400 uppercase pb-2 mb-2 border-b border-night-700">Biggest Risers</div>
          <MovementCard items={risers} type="riser" />
        </div>
        <div>
          <div className="font-mono text-xs tracking-kicker text-red-400 uppercase pb-2 mb-2 border-b border-night-700">Biggest Fallers</div>
          <MovementCard items={fallers} type="faller" />
        </div>
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
      <PanelHeader title="On Every Combined List" subtitle={`${list.length} films`} />
      {list.length === 0 ? (
        <EmptyNote>None found</EmptyNote>
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
                    <div className="font-mono text-xs text-gray-500 leading-none uppercase">{shortYear(y)}</div>
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
      <PanelHeader title="Appeared, Disappeared & Returned" subtitle={`${list.length} films`} />
      {list.length === 0 ? (
        <EmptyNote>None found</EmptyNote>
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
                    <div className="font-mono text-xs text-gray-500 leading-none uppercase">{shortYear(y)}</div>
                    {f.ranks[y] != null
                      ? <div className="font-mono text-sm font-semibold text-gray-200 leading-snug tabular-nums">#{f.ranks[y]}</div>
                      : <div className="font-mono text-xs text-gray-500 leading-snug">NR</div>
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

// ── ALL EVENTS TAB ────────────────────────────────────────────────────────────
export default function AllEventsTab({ allTimeData, rank1Data, scoresData }) {
  return (
    <div className="space-y-7">
      <PodiumSection allTimeData={allTimeData} rank1Data={rank1Data} />
      <EditionTrendsSection allTimeData={allTimeData} scoresData={scoresData} />
      <div className="card">
        <PanelHeader title="Bump Chart" subtitle="Rank trajectory across every edition" />
        <BumpChart allTimeData={allTimeData} />
      </div>
      <MovementsSection allTimeData={allTimeData} />
      <AlwaysPresentSection allTimeData={allTimeData} />
      <InAndOutSection allTimeData={allTimeData} />
    </div>
  )
}
