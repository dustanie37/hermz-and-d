// hermz-and-d/src/pages/oscars/OscarsStats.jsx
// Phase 2 — All-Time Oscar Stats page (Projector Room visual system).
// Drop-in replacement for the existing file. No other files need to change.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'

// ── colour tokens (must match tailwind.config.js gold-500 / film-500) ────────
const HC = '#E0A22F'   // Hermz / matt
const DC = '#5B6CFF'   // Dust  / dustin

// ── category groupings ──────────────────────────────────────────────────────
const CAT_GROUP = {
  'Best Picture':                    'Major',
  'Best Director':                   'Major',
  'Best Animated Feature Film':      'Major',
  'Best International Feature Film': 'Major',
  'Best Documentary Feature Film':   'Major',
  'Best Actor':                      'Acting',
  'Best Actress':                    'Acting',
  'Best Supporting Actor':           'Acting',
  'Best Supporting Actress':         'Acting',
  'Best Original Screenplay':        'Writing',
  'Best Adapted Screenplay':         'Writing',
  'Best Production Design':          'Craft',
  'Best Cinematography':             'Craft',
  'Best Costume Design':             'Craft',
  'Best Film Editing':               'Craft',
  'Best Makeup and Hairstyling':     'Craft',
  'Best Visual Effects':             'Craft',
  'Best Original Score':             'Music',
  'Best Original Song':              'Music',
  'Best Sound':                      'Music',
  'Best Casting':                    'Craft',
  'Best Animated Short Film':        'Shorts',
  'Best Documentary Short Film':     'Shorts',
  'Best Live Action Short Film':     'Shorts',
  'Best Sound Editing':              'Sound',
  'Best Sound Mixing':               'Sound',
}

const GROUP_META = {
  Major:   { label: 'Major Awards', color: '#a78bfa' },
  Acting:  { label: 'Acting',       color: '#f472b6' },
  Writing: { label: 'Writing',      color: '#4ade80' },
  Craft:   { label: 'Craft',        color: '#60a5fa' },
  Music:   { label: 'Music & Sound',color: '#fb923c' },
  Shorts:  { label: 'Short Films',  color: '#94a3b8' },
  Sound:   { label: 'Discontinued', color: '#64748b' },
}
const GROUP_ORDER = ['Major','Acting','Writing','Craft','Music','Shorts','Sound']

// ── helpers ─────────────────────────────────────────────────────────────────
const pct        = (n, d) => d ? Math.round((n / d) * 100) : 0
const pctStr     = (n, d) => `${pct(n, d)}%`
const pctFull    = (n, d) => d ? Math.round((n / d) * 10000) / 100 : 0
const pctStrFull = (n, d) => `${pctFull(n, d).toFixed(2)}%`

function computeStreaks(sorted) {
  let mC = 0, dC = 0, mMax = 0, dMax = 0
  let mStart = null, dStart = null
  for (const y of sorted) {
    if (y.winner === 'matt') {
      mC++; dC = 0; dStart = null
      if (mC === 1) mStart = y.year
      if (mC > mMax) mMax = mC
    } else if (y.winner === 'dustin') {
      dC++; mC = 0; mStart = null
      if (dC === 1) dStart = y.year
      if (dC > dMax) dMax = dC
    } else { mC = 0; dC = 0; mStart = null; dStart = null }
  }
  const lastYear = sorted.length ? sorted[sorted.length - 1].year : null
  return { mattCurrent: mC, dustinCurrent: dC, mattStreakStart: mStart, dustinStreakStart: dStart,
           mattLongest: mMax, dustinLongest: dMax, lastYear }
}

// ── tooltips (dark theme) ───────────────────────────────────────────────────
function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card-panel px-3 py-2 text-sm">
      <p className="font-mono text-[10px] tracking-kicker text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
          {p.payload.total ? <span className="text-gray-500 text-xs ml-1">/ {p.payload.total}</span> : null}
        </p>
      ))}
    </div>
  )
}
function DiffTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  const winner = val > 0 ? 'Hermz' : val < 0 ? 'Dust' : 'Tied'
  return (
    <div className="card-panel px-3 py-2 text-sm">
      <p className="font-mono text-[10px] tracking-kicker text-white mb-1">{label}</p>
      <p className="text-gray-300">
        Margin: <span className="font-bold">{Math.abs(val)}</span>
        {val !== 0 && <span className="ml-1 text-xs text-gray-500">({winner} won)</span>}
      </p>
    </div>
  )
}
function ChartDot(props) {
  const { cx, cy, tb, color } = props
  if (tb) return <polygon key={`d-${cx}-${cy}`} points={`${cx},${cy-5} ${cx+5},${cy} ${cx},${cy+5} ${cx-5},${cy}`} fill={color} stroke="none" />
  return <circle key={`d-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={color} stroke="none" />
}

// ── MiniBar — mirrored accuracy bar (Hermz left, Dust right) ───────────────
function MiniBar({ h, d }) {
  const hL = h > d, dL = d > h
  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="font-mono text-[10px] w-9 text-right" style={{ color: HC, opacity: hL ? 1 : 0.55 }}>{h}%</span>
      <div className="flex-1 h-2.5 bg-night-700 rounded-l-sm overflow-hidden">
        <div className="h-full rounded-l-sm transition-all" style={{ width: `${h}%`, backgroundColor: HC, opacity: hL ? 0.95 : 0.35 }} />
      </div>
      <div className="flex-1 h-2.5 bg-night-700 rounded-r-sm overflow-hidden flex flex-row-reverse">
        <div className="h-full rounded-r-sm transition-all" style={{ width: `${d}%`, backgroundColor: DC, opacity: dL ? 0.95 : 0.35 }} />
      </div>
      <span className="font-mono text-[10px] w-9" style={{ color: DC, opacity: dL ? 1 : 0.55 }}>{d}%</span>
    </div>
  )
}

function SplitBar({ h, d }) {
  const hL = h > d, dL = d > h
  const total = Math.max(h + d, 1)
  const hW = Math.round((h / total) * 100)
  const dW = 100 - hW
  return (
    <div className="flex flex-1 h-6 rounded overflow-hidden">
      <div className="flex items-center justify-center text-xs font-bold transition-all"
        style={{ width: `${hW}%`, backgroundColor: HC, opacity: hL ? 1 : 0.3, color: hL ? '#070608' : HC, minWidth: h ? 28 : 0 }}>
        {h > 5 ? `${h}%` : ''}
      </div>
      <div style={{ width: 2, backgroundColor: '#070608' }} />
      <div className="flex items-center justify-center text-xs font-bold transition-all flex-row-reverse"
        style={{ width: `${dW}%`, backgroundColor: DC, opacity: dL ? 1 : 0.3, color: dL ? '#070608' : DC, minWidth: d ? 28 : 0 }}>
        {d > 5 ? `${d}%` : ''}
      </div>
    </div>
  )
}

// ── MomentumTooltip ─────────────────────────────────────────────────────────
function MomentumTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const h = payload.find(p => p.dataKey === 'Hermz')?.value ?? 0
  const d = payload.find(p => p.dataKey === 'Dust')?.value ?? 0
  const diff = h - d
  const leader = diff > 0 ? 'Hermz' : diff < 0 ? 'Dust' : null
  const leaderColor = diff > 0 ? HC : DC
  return (
    <div className="card-panel px-3 py-2 text-sm">
      <p className="font-mono text-[10px] tracking-kicker text-white mb-1">{label}</p>
      <p style={{ color: HC }}>Hermz: <span className="font-bold">{h}</span> wins</p>
      <p style={{ color: DC }}>Dust: <span className="font-bold">{d}</span> wins</p>
      {leader && (
        <p className="text-xs mt-1" style={{ color: leaderColor }}>
          {leader} leads by {Math.abs(diff)}
        </p>
      )}
      {diff === 0 && <p className="text-xs mt-1 text-gray-400">Tied</p>}
    </div>
  )
}

// ── CategoryHeatmap ──────────────────────────────────────────────────────────
function CategoryHeatmap({ catData, sorted }) {
  const CC = '#00E0D9'
  const years = sorted.map(y => y.year)
  const CELL = 22
  const LABEL_W = 172

  const cats = [...catData].sort((a, b) => {
    const gA = GROUP_ORDER.indexOf(CAT_GROUP[a.name] || 'Craft')
    const gB = GROUP_ORDER.indexOf(CAT_GROUP[b.name] || 'Craft')
    if (gA !== gB) return gA - gB
    return (a.order || 0) - (b.order || 0)
  })

  function cellState(cat, year) {
    const data = cat.byYear[year]
    if (!data) return 'inactive'
    const m = data.matt?.correct ?? false
    const d = data.dustin?.correct ?? false
    if (m && d) return 'both'
    if (m) return 'hermz'
    if (d) return 'dust'
    return 'neither'
  }

  const stateColor = { both: CC, hermz: HC, dust: DC, neither: '#1a1825', inactive: '#070608' }
  const stateBorder = { neither: '#2A2734' }

  let lastGroup = null

  return (
    <div className="overflow-x-auto -mx-1">
      <div style={{ minWidth: LABEL_W + years.length * CELL + 16, paddingRight: 8 }}>
        {/* Year column headers */}
        <div className="flex" style={{ paddingLeft: LABEL_W }}>
          {years.map(yr => (
            <div key={yr} style={{ width: CELL, flexShrink: 0, textAlign: 'center', paddingBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#9298A6' }}>
                '{String(yr).slice(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Category rows */}
        {cats.map((cat, i) => {
          const group = CAT_GROUP[cat.name] || 'Craft'
          const meta = GROUP_META[group]
          const isNewGroup = group !== lastGroup
          if (isNewGroup) lastGroup = group
          return (
            <div key={cat.id}>
              {isNewGroup && i > 0 && <div style={{ height: 8 }} />}
              <div className="flex items-center" style={{ marginBottom: 2 }}>
                {/* Label */}
                <div style={{ width: LABEL_W, flexShrink: 0, paddingRight: 10, textAlign: 'right' }}>
                  <span style={{
                    fontSize: 11, lineHeight: 1,
                    color: cat.isLegacy ? '#6b7280' : '#d1d5db',
                  }}>
                    {cat.name.replace('Best ', '')}
                  </span>
                </div>
                {/* Cells */}
                {years.map(yr => {
                  const state = cellState(cat, yr)
                  const isInactive = state === 'inactive'
                  const isNeither = state === 'neither'
                  const bg = isInactive ? '#070608' : isNeither ? '#1a1825' : stateColor[state]
                  return isInactive ? (
                    <div key={yr} style={{ width: CELL, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: CELL - 4, height: CELL - 4, borderRadius: 3, backgroundColor: '#070608' }} />
                    </div>
                  ) : (
                    <Link key={yr} to={`/oscars/${yr}`}
                      title={`${yr} · ${cat.name}`}
                      style={{ width: CELL, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      <div
                        style={{
                          width: CELL - 4, height: CELL - 4, borderRadius: 3,
                          backgroundColor: bg,
                          border: isNeither ? '1px solid #2A2734' : 'none',
                          opacity: isNeither ? 0.65 : 0.87,
                          transition: 'opacity 0.12s, transform 0.12s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.opacity = 1
                          e.currentTarget.style.transform = 'scale(1.18)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.opacity = isNeither ? 0.65 : 0.87
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      />
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 mt-5 pt-4 border-t border-night-700/60">
          {[
            { color: CC,        label: 'Both correct',   neither: false, inactive: false },
            { color: HC,        label: 'Hermz only',     neither: false, inactive: false },
            { color: DC,        label: 'Dust only',      neither: false, inactive: false },
            { color: '#1a1825', label: 'Neither',        neither: true,  inactive: false },
            { color: '#070608', label: 'N/A (inactive)', neither: false, inactive: true  },
          ].map(({ color, label, neither, inactive }) => (
            <div key={label} className="flex items-center gap-2">
              <div style={{
                width: 14, height: 14, borderRadius: 2,
                backgroundColor: color,
                border: neither ? '1px solid #2A2734' : inactive ? '1px solid #1a1825' : 'none',
                opacity: inactive ? 0.4 : 1,
              }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{label}</span>
            </div>
          ))}
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>
            Click any cell → ceremony
          </span>
        </div>
      </div>
    </div>
  )
}

// ── main component ──────────────────────────────────────────────────────────
export default function OscarsStats() {
  const [years,       setYears]       = useState([])
  const [catData,     setCatData]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [catView,     setCatView]     = useState('accuracy')
  const [expandedCat, setExpandedCat] = useState(null)

  const gridColor = '#2A2734'
  const axisColor = '#9298A6'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true); setError(null)
    try {
      const { data: yrData, error: yrErr } = await supabase
        .from('v_oscar_year_summary').select('*').eq('status', 'complete').order('year', { ascending: true })
      if (yrErr) throw yrErr

      const { data: guesses, error: gErr } = await supabase
        .from('oscar_guesses')
        .select('is_correct, guess, oscar_categories(id, name, display_order, active_from, active_until), profiles(username), oscar_years(year)')
      if (gErr) throw gErr

      const catMap = {}
      for (const g of guesses) {
        const cat  = g.oscar_categories
        const user = g.profiles?.username
        const yr   = g.oscar_years?.year
        if (!cat || (user !== 'matt' && user !== 'dustin')) continue
        if (!catMap[cat.id]) {
          catMap[cat.id] = {
            id: cat.id, name: cat.name, order: cat.display_order,
            active_from: cat.active_from, active_until: cat.active_until,
            matt: { correct: 0, total: 0 }, dustin: { correct: 0, total: 0 }, byYear: {},
          }
        }
        catMap[cat.id][user].total++
        if (g.is_correct) catMap[cat.id][user].correct++
        if (yr) {
          if (!catMap[cat.id].byYear[yr]) catMap[cat.id].byYear[yr] = { year: yr, matt: null, dustin: null }
          catMap[cat.id].byYear[yr][user] = { guess: g.guess, correct: g.is_correct }
        }
      }
      const cats = Object.values(catMap).map(c => ({
        ...c,
        mattPct:     pct(c.matt.correct,   c.matt.total),
        dustinPct:   pct(c.dustin.correct, c.dustin.total),
        combinedPct: pct(c.matt.correct + c.dustin.correct, c.matt.total + c.dustin.total),
        isLegacy:    c.active_until !== null && c.active_until !== undefined,
        isNew:       c.active_from  !== null && c.active_from  > 2008,
      }))
      setYears((yrData || []).filter(y => y.winner && y.winner !== 'pending'))
      setCatData(cats)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">CRUNCHING THE NUMBERS…</span>
    </div>
  )
  if (error) return <div className="py-20 text-center text-red-400">Error: {error}</div>

  // ── derived ───────────────────────────────────────────────────────────────
  const sorted       = [...years].sort((a,b) => a.year - b.year)
  const mattWins     = years.filter(y => y.winner === 'matt').length
  const dustinWins   = years.filter(y => y.winner === 'dustin').length
  const tbYears      = years.filter(y => y.tiebreaker_used)
  const mattTbWins   = tbYears.filter(y => y.winner === 'matt').length
  const dustinTbWins = tbYears.filter(y => y.winner === 'dustin').length
  const mattAllTime  = years.reduce((s,y) => s + (y.matt_correct||0), 0)
  const dustinAllTime= years.reduce((s,y) => s + (y.dustin_correct||0), 0)
  const totalPossible= years.reduce((s,y) => s + (y.total_categories||0), 0)
  const streaks      = computeStreaks(sorted)
  const mattBest     = [...years].sort((a,b) => (b.matt_correct||0)   - (a.matt_correct||0))[0]
  const mattWorst    = [...years].sort((a,b) => (a.matt_correct||0)   - (b.matt_correct||0))[0]
  const dustinBest   = [...years].sort((a,b) => (b.dustin_correct||0) - (a.dustin_correct||0))[0]
  const dustinWorst  = [...years].sort((a,b) => (a.dustin_correct||0) - (b.dustin_correct||0))[0]

  const timelineData = sorted.map(y => ({ year: y.year, Hermz: y.matt_correct||0, Dust: y.dustin_correct||0, total: y.total_categories||0, tb: y.tiebreaker_used }))
  const marginData   = sorted.map(y => ({ year: y.year, diff: (y.matt_correct||0)-(y.dustin_correct||0), tb: y.tiebreaker_used }))

  let mCum = 0, dCum = 0
  const momentumData = sorted.map(y => {
    if (y.winner === 'matt') mCum++
    else if (y.winner === 'dustin') dCum++
    return { year: y.year, Hermz: mCum, Dust: dCum, tb: y.tiebreaker_used }
  })

  const grouped = GROUP_ORDER.map(g => ({
    g, meta: GROUP_META[g],
    cats: catData.filter(c => (CAT_GROUP[c.name] || 'Craft') === g).sort((a,b) => a.order - b.order),
  })).filter(g => g.cats.length > 0)

  const hCW  = catData.filter(c => c.mattPct > c.dustinPct).length
  const dCW  = catData.filter(c => c.dustinPct > c.mattPct).length
  const tied = catData.filter(c => c.mattPct === c.dustinPct).length

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <FilmStill title="Hermz and D Oscar Stats" hue={48} mood="cool"
                 className="w-full h-[300px] sm:h-[340px]">
        {/* Oscar statuette — Mirko Fabian / Unsplash, screen blend */}
        <div className="absolute pointer-events-none hidden sm:block"
             style={{ right: 0, top: 0, width: '40%', height: '100%', overflow: 'hidden' }}>
          <img src="https://images.unsplash.com/photo-1741887864007-271499b10d53?fm=jpg&q=85&w=800&auto=format&fit=crop"
               alt=""
               style={{ position: 'absolute', right: '-5%', top: '50%', transform: 'translateY(-50%)',
                        width: '100%', height: '140%', objectFit: 'cover', objectPosition: 'center top',
                        mixBlendMode: 'screen', opacity: 0.55, filter: 'contrast(1.15) brightness(0.85)' }} />
        </div>
        <div className="absolute inset-0 scrim-bottom" />

        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/oscars" className="font-mono text-[11px] tracking-kicker text-gold-500
                                          hover:text-gold-400 transition-colors flex items-center gap-2">
              <OscarIcon size={12} /> OSCARS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white">STATS</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white tracking-wide leading-[0.92]">
            ALL-TIME STATS
          </h1>
          <p className="font-serif italic text-lg text-gray-400 mt-3">
            {years.length} ceremonies · 2008–{years[years.length-1]?.year ?? '—'}
          </p>
        </div>

        {/* Floating big-number summary, hidden on mobile */}
        <div className="hidden md:flex absolute bottom-7 right-6 sm:right-10 z-10
                        bg-night-950/70 backdrop-blur-md border border-white/[0.12]
                        rounded-2xl px-5 py-3.5 gap-5 items-center shadow-still-lg">
          <BigPct who="matt"   pct={pctFull(mattAllTime,   totalPossible)} total={mattAllTime}   leading={mattAllTime > dustinAllTime} />
          <span className="w-px h-14 bg-white/10" />
          <BigPct who="dustin" pct={pctFull(dustinAllTime, totalPossible)} total={dustinAllTime} leading={dustinAllTime > mattAllTime} />
        </div>
      </FilmStill>

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 space-y-6">

        {/* ── 1. Championship + Correct cards ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <p className="kicker mb-4">YEARLY CHAMPIONSHIP RECORD</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <PlayerStat name="Hermz" value={mattWins}   sub={`${pctStr(mattWins, years.length)} of years`}   color="gold" leading={mattWins > dustinWins} />
              <div className="flex flex-col items-center justify-center">
                <span className="font-display text-2xl text-gray-500">vs</span>
                <span className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1">{years.length} years</span>
              </div>
              <PlayerStat name="Dust"  value={dustinWins} sub={`${pctStr(dustinWins, years.length)} of years`} color="film" leading={dustinWins > mattWins} />
            </div>
            {tbYears.length > 0 && (
              <div className="mt-4 pt-4 border-t border-night-700 text-center">
                <span className="badge-tiebreaker mr-2">{tbYears.length} TIEBREAKER{tbYears.length>1?'S':''}</span>
                <span className="font-mono text-[10px] tracking-kicker text-gray-500">
                  Hermz {mattTbWins} · Dust {dustinTbWins}
                </span>
              </div>
            )}
          </div>

          <div className="card">
            <p className="kicker mb-4">ALL-TIME CORRECT GUESSES</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <PlayerStat name="Hermz" value={mattAllTime}   sub={`${pctStrFull(mattAllTime, totalPossible)} accuracy`}   color="gold" leading={mattAllTime > dustinAllTime} />
              <div className="flex flex-col items-center justify-center">
                <span className="font-display text-2xl text-gray-500">vs</span>
                <span className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1">{totalPossible} possible</span>
              </div>
              <PlayerStat name="Dust"  value={dustinAllTime} sub={`${pctStrFull(dustinAllTime, totalPossible)} accuracy`} color="film" leading={dustinAllTime > mattAllTime} />
            </div>
            <div className="mt-4 pt-4 border-t border-night-700 grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="font-display text-xl text-white">{(mattAllTime/years.length).toFixed(1)}</div>
                <div className="kicker-dim mt-1">HERMZ AVG / YEAR</div>
              </div>
              <div>
                <div className="font-display text-xl text-white">{(dustinAllTime/years.length).toFixed(1)}</div>
                <div className="kicker-dim mt-1">DUST AVG / YEAR</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Streaks + Peak/Valley ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <p className="kicker mb-4">WIN STREAKS</p>
            <ActiveStreak streaks={streaks} />
          </div>
          <div className="card">
            <p className="kicker mb-4">PEAK &amp; VALLEY</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-[10px] tracking-kicker text-gold-400 mb-2">HERMZ</div>
                <PeakRow label="Best"  year={mattBest?.year}   value={mattBest?.matt_correct}    total={mattBest?.total_categories} />
                <PeakRow label="Worst" year={mattWorst?.year}  value={mattWorst?.matt_correct}   total={mattWorst?.total_categories} isWorst />
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-kicker text-film-400 mb-2">DUST</div>
                <PeakRow label="Best"  year={dustinBest?.year}  value={dustinBest?.dustin_correct}  total={dustinBest?.total_categories} />
                <PeakRow label="Worst" year={dustinWorst?.year} value={dustinWorst?.dustin_correct} total={dustinWorst?.total_categories} isWorst />
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Timeline ─────────────────────────────────────────────────── */}
        <div className="card">
          <p className="kicker">CORRECT GUESSES OVER TIME</p>
          <p className="text-xs text-gray-500 mt-1 mb-5">Per ceremony 2008–2026. ◆ = tiebreaker year.</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timelineData} margin={{ top:5, right:20, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fontSize:11, fill:axisColor }} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:axisColor }} tickLine={false} axisLine={false} domain={['dataMin - 1','dataMax + 1']} />
              <Tooltip content={<TimelineTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:12, color:axisColor }} />
              <Line type="monotone" dataKey="Hermz" stroke={HC} strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={HC} />} activeDot={{ r:5 }} />
              <Line type="monotone" dataKey="Dust"  stroke={DC} strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={DC} />} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── 4. Championship Race ──────────────────────────────────────── */}
        <div className="card">
          <p className="kicker">CHAMPIONSHIP RACE</p>
          <p className="text-xs text-gray-500 mt-1 mb-5">Cumulative wins over all {sorted.length} ceremonies. ◆ = tiebreaker year.</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={momentumData} margin={{ top:5, right:20, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fontSize:11, fill:axisColor }} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:axisColor }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'dataMax + 1']} />
              <Tooltip content={<MomentumTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:12, color:axisColor }} />
              <Line type="stepAfter" dataKey="Hermz" stroke={HC} strokeWidth={2.5}
                    dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={HC} />} activeDot={{ r:5 }} />
              <Line type="stepAfter" dataKey="Dust"  stroke={DC} strokeWidth={2.5}
                    dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={DC} />} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── 5. Category Heatmap ──────────────────────────────────────── */}
        <div className="card">
          <p className="kicker">CATEGORY HEATMAP</p>
          <p className="text-xs text-gray-500 mt-1 mb-5">
            Every category · every year — who got it right at a glance.
          </p>
          <CategoryHeatmap catData={catData} sorted={sorted} />
        </div>

        {/* ── 6. Category Accuracy ──────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-night-700/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="kicker">CATEGORY ACCURACY</p>
              <p className="text-xs text-gray-500 mt-1">All-time correct guesses per category · click any row to expand</p>
            </div>
            <div className="flex items-center gap-1 bg-night-700/60 rounded-full p-1">
              {[['accuracy','Accuracy'],['h2h','Head-to-Head']].map(([val, label]) => (
                <button key={val} onClick={() => setCatView(val)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    catView === val ? 'bg-white text-night-950' : 'text-gray-400 hover:text-gray-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {catView === 'h2h' && (
            <div className="flex items-center justify-center gap-8 py-3 bg-night-900/40 border-b border-night-700/60">
              <div className="text-center">
                <span className="font-display text-2xl" style={{ color: HC }}>{hCW}</span>
                <div className="kicker-dim mt-1">HERMZ LEADS</div>
              </div>
              <div className="text-center">
                <span className="font-display text-2xl text-gray-500">{tied}</span>
                <div className="kicker-dim mt-1">TIED</div>
              </div>
              <div className="text-center">
                <span className="font-display text-2xl" style={{ color: DC }}>{dCW}</span>
                <div className="kicker-dim mt-1">DUST LEADS</div>
              </div>
            </div>
          )}

          {catView === 'accuracy' && (
            <div className="flex items-center gap-4 px-6 py-2.5 border-b border-night-700/60 text-xs">
              <span style={{ color: HC }}>■ Hermz fills left</span>
              <span style={{ color: DC }}>■ Dust fills right</span>
              <span className="text-gray-500">(brighter bar = leader)</span>
            </div>
          )}

          <div className="px-4 py-4 space-y-5">
            {grouped.map(({ g, meta, cats }) => (
              <div key={g}>
                <div className="flex items-center gap-2 mb-2"
                     style={{ borderLeft: `3px solid ${meta.color}`, paddingLeft: 10 }}>
                  <span className="font-mono text-[10px] tracking-cinema uppercase" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
                <div className="space-y-1">
                  {cats.map(cat => (
                    <CategoryRow
                      key={cat.id} cat={cat} view={catView}
                      expanded={expandedCat === cat.id}
                      onToggle={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
function BigPct({ who, pct, total, leading }) {
  const c = who === 'matt' ? 'text-gold-500' : 'text-film-500'
  const name = who === 'matt' ? 'HERMZ' : 'DUST'
  return (
    <div className="text-center px-2 relative">
      <div className={`font-mono text-[9px] tracking-cinema ${c} mb-1.5`}>{name}{leading && ' · LEADING'}</div>
      <div className="flex items-baseline justify-center gap-1">
        <span className="font-display text-4xl text-white leading-none tracking-wide">{typeof pct === 'number' ? pct.toFixed(2) : pct}</span>
        <span className="font-mono text-sm text-gray-500">%</span>
      </div>
      <div className="font-mono text-[9px] tracking-kicker text-gray-500 mt-1">{total} CORRECT</div>
    </div>
  )
}

function PlayerStat({ name, value, sub, color, leading }) {
  const bg = leading
    ? (color === 'gold' ? 'bg-gold-500 border-gold-400' : 'bg-film-500 border-film-400')
    : 'bg-night-700/40 border-night-600'
  const valColor = leading ? 'text-night-950' : 'text-white'
  const subColor = leading
    ? (color === 'gold' ? 'text-gold-900' : 'text-film-900')
    : 'text-gray-400'
  return (
    <div className={`rounded-xl py-4 px-2 border ${bg}`}>
      <div className={`font-display text-4xl tracking-wide leading-none ${valColor}`}>{value}</div>
      <div className={`font-mono text-[9px] tracking-cinema mt-2 ${subColor}`}>{name.toUpperCase()}</div>
      {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
    </div>
  )
}

function ActiveStreak({ streaks }) {
  const { mattCurrent, dustinCurrent, mattStreakStart, dustinStreakStart, lastYear } = streaks
  if (!mattCurrent && !dustinCurrent) {
    return <div className="text-sm text-gray-500">No active streak</div>
  }
  const isHermz = mattCurrent > 0
  const count = isHermz ? mattCurrent : dustinCurrent
  const start = isHermz ? mattStreakStart : dustinStreakStart
  const name = isHermz ? 'Hermz' : 'Dust'
  const bg = isHermz ? 'bg-gold-500 border-gold-400' : 'bg-film-500 border-film-400'
  const range = start === lastYear ? `${start}` : `${start}–${lastYear}`
  return (
    <div className={`inline-flex items-center gap-4 rounded-xl px-5 py-3 border ${bg}`}>
      <div className="text-center">
        <span className="font-display text-3xl text-night-950 leading-none tracking-wide">{count}</span>
        <div className="font-mono text-[9px] tracking-kicker text-night-950/70 mt-1">
          {count === 1 ? 'YEAR' : 'YEARS'}
        </div>
      </div>
      <div>
        <div className="text-night-950 font-semibold text-sm">{name} is on a roll</div>
        <div className="font-mono text-[10px] tracking-kicker text-night-950/70 mt-0.5">{range}</div>
      </div>
    </div>
  )
}

function PeakRow({ label, year, value, total, isWorst }) {
  return (
    <Link to={`/oscars/${year}`}
      className="flex items-center justify-between rounded-lg px-3 py-2 mb-2 bg-night-700/40 hover:bg-night-700 transition-colors group">
      <span className="font-mono text-[10px] tracking-kicker text-gray-400 uppercase">{label}</span>
      <div className="text-right">
        <span className={`font-display text-base ${isWorst ? 'text-red-400' : 'text-emerald-400'} leading-none`}>{value}</span>
        <span className="font-mono text-xs text-gray-500 ml-1">/ {total}</span>
        <span className="font-mono text-xs text-gray-500 ml-2 group-hover:text-gold-400 transition-colors">{year}</span>
      </div>
    </Link>
  )
}

function CategoryRow({ cat, view, expanded, onToggle }) {
  const { mattPct: h, dustinPct: d } = cat
  const hL = h > d, dL = d > h
  const edgeLabel = hL ? 'Hermz' : dL ? 'Dust' : 'Tied'
  const edgeColor = hL ? HC : dL ? DC : '#9ca3af'
  const labelOpacity = cat.isLegacy ? 0.55 : 1
  const yearRows = Object.values(cat.byYear).sort((a,b) => b.year - a.year)
  return (
    <>
      <div
        onClick={onToggle}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
          expanded ? 'bg-night-700/60' : 'hover:bg-night-700/30'
        }`}
        style={{ opacity: labelOpacity }}
      >
        <div className="w-44 flex-shrink-0 text-right">
          <span className="text-xs text-gray-300 leading-tight">{cat.name.replace('Best ', '')}</span>
        </div>
        {view === 'accuracy' ? <MiniBar h={h} d={d} /> : <SplitBar h={h} d={d} />}
        <div className="w-14 flex-shrink-0 text-xs font-semibold text-right" style={{ color: edgeColor }}>
          {edgeLabel}
        </div>
        <div className={`text-gray-500 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</div>
      </div>

      {expanded && (
        <div className="mx-3 mb-2 rounded-lg overflow-hidden border border-night-600">
          <div className="px-3 py-2 bg-night-900 border-b border-night-600">
            <span className="text-xs font-semibold text-gray-200">{cat.name} — Year by Year</span>
            <span className="text-xs text-gray-500 ml-3">
              Hermz {cat.matt.correct}/{cat.matt.total} · Dust {cat.dustin.correct}/{cat.dustin.total}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="bg-night-900/60">
                  <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Year</th>
                  <th className="px-3 py-1.5 text-left font-medium" style={{ color: HC }}>Hermz guess</th>
                  <th className="px-3 py-1.5 text-left font-medium" style={{ color: DC }}>Dust guess</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map(row => (
                  <tr key={row.year} className="border-t border-night-700 hover:bg-night-700/30">
                    <td className="px-3 py-1.5">
                      <Link to={`/oscars/${row.year}`} className="text-gold-400 hover:underline font-medium"
                            onClick={e => e.stopPropagation()}>{row.year}</Link>
                    </td>
                    <td className="px-3 py-1.5">
                      {row.matt ? (
                        <span className={row.matt.correct ? 'text-emerald-400' : 'text-gray-500'}>
                          {row.matt.correct ? '✓' : '✗'} {row.matt.guess}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.dustin ? (
                        <span className={row.dustin.correct ? 'text-emerald-400' : 'text-gray-500'}>
                          {row.dustin.correct ? '✓' : '✗'} {row.dustin.guess}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
