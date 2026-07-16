// hermz-and-d/src/pages/oscars/OscarsStats.jsx
// Phase 2 — All-Time Oscar Stats page (Projector Room visual system).
// Drop-in replacement for the existing file. No other files need to change.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'
import { DC, HC, CC } from '../../lib/helpers'
// Category grouping is DATA now (oscar_categories.group_name/group_order) and the
// helpers live in lib/oscarSeason — the local CAT_GROUP/GROUP_META copies that used
// to sit here were a second source of truth and drifted. Never re-inline them.
import { GROUP_ORDER, GROUP_COLOR } from '../../lib/oscarSeason'

// ── colour tokens (must match tailwind.config.js gold-500 / film-500) ────────

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
      <p className="font-mono text-xs tracking-kicker text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}{p.dataKey === 'Agree' ? '%' : ''}</span>
          {p.dataKey !== 'Agree' && p.payload.total ? <span className="text-gray-400 text-xs ml-1">/ {p.payload.total}</span> : null}
        </p>
      ))}
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
    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
      <span className="font-mono text-xs w-9 sm:w-10 text-right flex-shrink-0" style={{ color: HC, opacity: hL ? 1 : 0.55 }}>{h}%</span>
      <div className="flex-1 h-2.5 bg-night-700 rounded-l-sm overflow-hidden">
        <div className="h-full rounded-l-sm transition-all" style={{ width: `${h}%`, backgroundColor: HC, opacity: hL ? 0.95 : 0.35 }} />
      </div>
      <div className="flex-1 h-2.5 bg-night-700 rounded-r-sm overflow-hidden flex flex-row-reverse">
        <div className="h-full rounded-r-sm transition-all" style={{ width: `${d}%`, backgroundColor: DC, opacity: dL ? 0.95 : 0.35 }} />
      </div>
      <span className="font-mono text-xs w-9 sm:w-10 flex-shrink-0" style={{ color: DC, opacity: dL ? 1 : 0.55 }}>{d}%</span>
    </div>
  )
}

// single teal bar — how often the two picks matched (Agreement view)
function AgreeBar({ a }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-2.5 bg-night-700 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm transition-all" style={{ width: `${a}%`, backgroundColor: CC, opacity: 0.8 }} />
      </div>
      <span className="font-mono text-xs w-9 sm:w-10 text-right flex-shrink-0" style={{ color: CC }}>{a}%</span>
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

// ── CategoryHeatmap ──────────────────────────────────────────────────────────
const HEAT_FILTERS = [
  { key: 'both',    label: 'Both correct', color: CC, chip: CC },
  { key: 'hermz',   label: 'Hermz only',   color: HC, chip: HC },
  { key: 'dust',    label: 'Dust only',    color: DC, chip: DC },
  { key: 'neither', label: 'Neither',      color: '#7f1d1d', chip: '#f87171' },
]

function CategoryHeatmap({ catData, sorted }) {
  const years = sorted.map(y => y.year)
  const CELL = 24
  const LABEL_W = 172
  const [filters, setFilters] = useState(() => new Set())

  const cats = [...catData].sort((a, b) => {
    const gA = a.groupOrder ?? 99
    const gB = b.groupOrder ?? 99
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

  // 'neither' = muted red — the "both missed" hue from the ceremony pages,
  // kept dim enough to sit behind the win colors but clearly apart from
  // the near-black inactive cells (user feedback 2026-07-15).
  const stateColor = { both: CC, hermz: HC, dust: DC, neither: '#7f1d1d', inactive: '#070608' }

  // Counts per state (across active cells only) — shown on the filter chips.
  const counts = { both: 0, hermz: 0, dust: 0, neither: 0 }
  for (const cat of cats) for (const yr of years) {
    const s = cellState(cat, yr)
    if (s !== 'inactive') counts[s]++
  }

  const filterOn = filters.size > 0
  const toggleFilter = key => setFilters(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  let lastGroup = null

  return (
    <>
    {/* Filter chips — double as the legend (tap to isolate; combine freely) */}
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <button onClick={() => setFilters(new Set())}
        className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
          !filterOn
            ? 'bg-white text-night-950 border-white font-semibold'
            : 'border-night-600 text-gray-400 hover:text-gray-200'
        }`}>
        All
      </button>
      {HEAT_FILTERS.map(f => {
        const on = filters.has(f.key)
        return (
          <button key={f.key} onClick={() => toggleFilter(f.key)}
            className={`flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
              on ? 'text-gray-100' : 'text-gray-400 hover:text-gray-200'
            }`}
            style={{
              borderColor: on ? f.chip : '#26263c',
              backgroundColor: on ? `${f.chip}1f` : 'transparent',
            }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2, flexShrink: 0,
              backgroundColor: f.color,
              border: f.bordered ? '1px solid #2A2734' : 'none',
            }} />
            {f.label}
            <span className={on ? 'text-gray-300' : 'text-gray-400'}>{counts[f.key]}</span>
          </button>
        )
      })}
    </div>
    <p className="sm:hidden font-mono text-xs tracking-kicker text-gray-400 uppercase mb-2">
      Swipe grid → for more years
    </p>
    <div className="overflow-x-auto -mx-1">
      <div style={{ minWidth: LABEL_W + years.length * CELL + 16, paddingRight: 8 }}>
        {/* Year column headers */}
        <div className="flex" style={{ paddingLeft: LABEL_W }}>
          {years.map(yr => (
            <div key={yr} style={{ width: CELL, flexShrink: 0, textAlign: 'center', paddingBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#9298A6' }}>
                '{String(yr).slice(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Category rows */}
        {cats.map((cat, i) => {
          const group = cat.group
          const isNewGroup = group !== lastGroup
          if (isNewGroup) lastGroup = group
          const states = years.map(yr => cellState(cat, yr))
          const rowHasMatch = !filterOn || states.some(s => filters.has(s))
          return (
            <div key={cat.id}>
              {isNewGroup && i > 0 && <div style={{ height: 8 }} />}
              <div className="flex items-center" style={{ marginBottom: 2 }}>
                {/* Label */}
                <div style={{ width: LABEL_W, flexShrink: 0, paddingRight: 10, textAlign: 'right' }}>
                  <span style={{
                    fontSize: 12, lineHeight: 1,
                    color: cat.isLegacy ? '#9ca3af' : '#d1d5db',
                    opacity: rowHasMatch ? 1 : 0.3,
                    transition: 'opacity 0.15s',
                  }}>
                    {cat.name.replace('Best ', '')}
                  </span>
                </div>
                {/* Cells */}
                {years.map((yr, yi) => {
                  const state = states[yi]
                  const isInactive = state === 'inactive'
                  const isNeither = state === 'neither'
                  const bg = stateColor[state]
                  if (isInactive) return (
                    <div key={yr} style={{ width: CELL, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: CELL - 4, height: CELL - 4, borderRadius: 3, backgroundColor: '#070608' }} />
                    </div>
                  )
                  const dimmed = filterOn && !filters.has(state)
                  const baseOpacity = dimmed ? 0.07 : isNeither ? 0.75 : 0.87
                  return (
                    <Link key={yr} to={`/oscars/${yr}`}
                      title={`${yr} · ${cat.name}`}
                      style={{ width: CELL, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      <div
                        style={{
                          width: CELL - 4, height: CELL - 4, borderRadius: 3,
                          backgroundColor: bg,
                          opacity: baseOpacity,
                          transition: 'opacity 0.15s, transform 0.12s',
                        }}
                        onMouseEnter={e => {
                          if (dimmed) return
                          e.currentTarget.style.opacity = 1
                          e.currentTarget.style.transform = 'scale(1.18)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.opacity = baseOpacity
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

        {/* Footer note (states are explained by the filter chips above) */}
        <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-night-700/60">
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#070608', border: '1px solid #1a1825' }} />
            <span className="font-mono text-xs text-gray-400">Category not active that year</span>
          </div>
          <span className="font-mono text-xs text-gray-400 ml-auto">Click any cell → ceremony</span>
        </div>
      </div>
    </div>
    </>
  )
}

// ── StreakTimeline ───────────────────────────────────────────────────────────
function StreakTimeline({ sorted }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map(y => {
          const isHermz = y.winner === 'matt'
          const isDust  = y.winner === 'dustin'
          const bg = isHermz ? HC : isDust ? DC : '#6b7280'
          return (
            <Link key={y.year} to={`/oscars/${y.year}`}
              title={`${y.year} — ${isHermz ? 'Hermz' : 'Dust'} won${y.tiebreaker_used ? ' (TB)' : ''}`}
              className="flex flex-col items-center gap-1 group">
              <div
                style={{
                  width: 30, height: 30, borderRadius: 6, backgroundColor: bg,
                  border: y.tiebreaker_used ? `2px solid ${CC}` : '2px solid transparent',
                  opacity: 0.88, transition: 'transform 0.12s, opacity 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'scale(1.12)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = 0.88; e.currentTarget.style.transform = 'scale(1)' }}
              />
              <span className="font-mono text-gray-400 group-hover:text-gray-200 transition-colors"
                    style={{ fontSize: 12 }}>
                '{String(y.year).slice(2)}
              </span>
            </Link>
          )
        })}
      </div>
      <div className="flex items-center gap-5 mt-4 flex-wrap">
        {[
          { color: HC, label: 'Hermz' },
          { color: DC, label: 'Dust' },
          { color: 'transparent', border: `2px solid ${CC}`, label: 'Tiebreaker' },
        ].map(({ color, border, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color, border: border || 'none' }} />
            <span className="font-mono text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── DifficultyRating ─────────────────────────────────────────────────────────
function DifficultyRating({ sorted }) {
  const tier = p => {
    if (p >= 80) return { label: 'Chalk',   color: '#4ade80' }
    if (p >= 70) return { label: 'Average', color: '#facc15' }
    if (p >= 60) return { label: 'Tough',   color: '#fb923c' }
    return            { label: 'Brutal',  color: '#f87171' }
  }
  const data = sorted
    .map(y => ({
      year:  y.year,
      pct:   pct((y.matt_correct||0) + (y.dustin_correct||0), (y.total_categories||0) * 2),
      matt:  y.matt_correct  || 0,
      dust:  y.dustin_correct|| 0,
      total: y.total_categories || 0,
    }))
    .sort((a, b) => a.pct - b.pct)

  return (
    <div className="space-y-1">
      {data.map(d => {
        const t = tier(d.pct)
        return (
          <Link key={d.year} to={`/oscars/${d.year}`}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-night-700/30 transition-colors group">
            <span className="font-mono text-sm font-medium text-gray-200 w-12 flex-shrink-0">{d.year}</span>
            <div className="flex-1 h-3 bg-night-700 rounded overflow-hidden">
              <div style={{ width: `${d.pct}%`, backgroundColor: t.color, opacity: 0.75 }}
                   className="h-full rounded" />
            </div>
            <span className="font-mono text-sm font-semibold w-10 text-right flex-shrink-0" style={{ color: t.color }}>
              {d.pct}%
            </span>
            <span className="font-mono text-sm w-14 text-right flex-shrink-0 hidden sm:block font-medium"
                  style={{ color: t.color }}>
              {t.label}
            </span>
            <span className="font-mono text-xs text-gray-400 w-20 text-right flex-shrink-0 hidden sm:block">
              {d.matt}+{d.dust}/{d.total}
            </span>
          </Link>
        )
      })}
      <div className="flex flex-wrap items-center gap-5 pt-3 mt-2 border-t border-night-700/60">
        {[
          { label: 'Chalk ≥80%',      color: '#4ade80' },
          { label: 'Average 70–79%',  color: '#facc15' },
          { label: 'Tough 60–69%',    color: '#fb923c' },
          { label: 'Brutal <60%',     color: '#f87171' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color, opacity: 0.75 }} />
            <span className="font-mono text-xs text-gray-300">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── OwnershipGrid ────────────────────────────────────────────────────────────
function OwnershipGrid({ catData }) {
  const cats = [...catData].sort((a, b) => {
    const gA = a.groupOrder ?? 99
    const gB = b.groupOrder ?? 99
    if (gA !== gB) return gA - gB
    return (a.order || 0) - (b.order || 0)
  })
  const byGroup = GROUP_ORDER
    .map(g => ({ g, color: GROUP_COLOR[g], cats: cats.filter(c => c.group === g) }))
    .filter(({ cats }) => cats.length > 0)

  return (
    <div className="space-y-6">
      {byGroup.map(({ g, color, cats }) => (
        <div key={g}>
          <div className="flex items-center gap-2 mb-3"
               style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12 }}>
            <span className="font-mono text-sm font-semibold uppercase" style={{ color }}>
              {g}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {cats.map(cat => {
              const h = cat.mattPct, d = cat.dustinPct
              const hL = h > d, dL = d > h
              const edge = hL ? HC : dL ? DC : '#9ca3af'
              const leader = hL ? 'Hermz' : dL ? 'Dust' : 'Tied'
              const margin = Math.abs(h - d)
              return (
                <div key={cat.id}
                  style={{ borderLeft: `4px solid ${edge}` }}
                  className={`bg-night-800 rounded-r-lg px-3 py-3 ${cat.isLegacy ? 'opacity-45' : ''}`}>
                  <div className="text-sm text-gray-200 leading-snug mb-2 font-medium">
                    {cat.name.replace('Best ', '')}
                  </div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="font-display text-2xl leading-none" style={{ color: edge }}>
                      {leader}
                    </span>
                    {margin > 0 && (
                      <span className="font-mono text-sm text-gray-300">
                        +{margin}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold" style={{ color: HC }}>{h}%</span>
                    <span className="font-mono text-xs text-gray-500">·</span>
                    <span className="font-mono text-xs font-semibold" style={{ color: DC }}>{d}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── CategoryStreaksSection ───────────────────────────────────────────────────
function buildCatStreaks(catData, sorted) {
  const years = sorted.map(y => y.year)
  const results = []
  for (const cat of catData) {
    for (const who of ['matt', 'dustin']) {
      const chron = years
        .map(yr => {
          const d = cat.byYear[yr]?.[who]
          return d != null ? { year: yr, correct: d.correct } : null
        })
        .filter(Boolean)
      if (chron.length < 2) continue

      // current streak (walk backwards from most recent)
      let curLen = 1, curType = chron[chron.length - 1].correct
      let curStart = chron[chron.length - 1].year
      for (let i = chron.length - 2; i >= 0; i--) {
        if (chron[i].correct === curType) { curLen++; curStart = chron[i].year }
        else break
      }

      // longest ever correct streak + its year range
      let longest = 0, run = 0, runStart = null, longestStart = null, longestEnd = null
      for (const r of chron) {
        if (r.correct) {
          if (run === 0) runStart = r.year
          run++
          if (run > longest) { longest = run; longestStart = runStart; longestEnd = r.year }
        } else run = 0
      }

      results.push({
        catName: cat.name.replace('Best ', ''),
        who, name: who === 'matt' ? 'Hermz' : 'Dust',
        color: who === 'matt' ? HC : DC,
        isLegacy: cat.isLegacy,
        curLen, curType, curStart,
        lastYear: chron[chron.length - 1].year,
        longest, longestStart, longestEnd,
      })
    }
  }
  return results
}

function CatStreakRow({ entry, type, rank }) {
  const isRecord = type === 'record'
  const isCold   = type === 'cold'
  const count     = isRecord ? entry.longest     : entry.curLen
  const startYear = isRecord ? entry.longestStart : entry.curStart
  const endYear   = isRecord ? entry.longestEnd   : entry.lastYear
  const range     = startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`
  const numColor  = isCold ? '#6b7280' : entry.color

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-night-800/50 hover:bg-night-800 transition-colors">
      {rank != null && (
        <span className="font-mono text-xs text-gray-400 w-5 flex-shrink-0 text-center">#{rank}</span>
      )}
      <span className="font-display text-3xl leading-none flex-shrink-0 w-8 text-center" style={{ color: numColor }}>
        {count}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-100 leading-tight truncate">{entry.catName}</div>
        <div className="font-mono text-xs mt-0.5" style={{ color: entry.color }}>{entry.name}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-xs text-gray-300">{range}</div>
      </div>
    </div>
  )
}

function CategoryStreaksSection({ catData, sorted }) {
  const all = buildCatStreaks(catData, sorted)

  const hot = all
    .filter(s => !s.isLegacy && s.curType  && s.curLen  >= 3)
    .sort((a, b) => b.curLen - a.curLen)

  const cold = all
    .filter(s => !s.isLegacy && !s.curType && s.curLen  >= 3)
    .sort((a, b) => b.curLen - a.curLen)

  const records = all
    .filter(s => s.longest >= 4)
    .sort((a, b) => b.longest - a.longest || b.longestEnd - a.longestEnd)
    .slice(0, 12)

  const Sub = ({ label, accent, children, empty }) => (
    <div>
      <p className="kicker mb-3" style={{ color: accent }}>{label}</p>
      {children.length === 0
        ? <p className="text-sm text-gray-400">{empty}</p>
        : <div className="space-y-1.5">{children}</div>
      }
    </div>
  )

  return (
    <div className="space-y-7">
      <Sub label="🔥 CURRENTLY HOT" accent="#f59e0b"
           empty="No active correct streaks of 3+ years">
        {hot.map((s, i) => <CatStreakRow key={`${s.who}-${s.catName}-h`} entry={s} type="hot" />)}
      </Sub>
      <Sub label="🧊 CURRENTLY COLD" accent="#94a3b8"
           empty="No active miss streaks of 3+ years">
        {cold.map((s, i) => <CatStreakRow key={`${s.who}-${s.catName}-c`} entry={s} type="cold" />)}
      </Sub>
      <Sub label="LONGEST EVER" accent={HC}
           empty="No correct streaks of 4+ years found">
        {records.map((s, i) => <CatStreakRow key={`${s.who}-${s.catName}-r`} entry={s} type="record" rank={i + 1} />)}
      </Sub>
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

  // Phase 13e — ceremony night: refresh quietly whenever the tab regains focus,
  // so category stats track winners as they're entered on the other device.
  useEffect(() => {
    const onFocus = () => fetchAll(true)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  async function fetchAll(quiet = false) {
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const { data: yrData, error: yrErr } = await supabase
        .from('v_oscar_year_summary').select('*').eq('status', 'complete').order('year', { ascending: true })
      if (yrErr) throw yrErr

      const { data: guesses, error: gErr } = await supabase
        .from('oscar_guesses')
        .select('is_correct, guess, oscar_categories(id, name, display_order, active_from, active_until, group_name, group_order), profiles(username), oscar_years(year)')
      if (gErr) throw gErr

      const catMap = {}
      for (const g of guesses) {
        const cat  = g.oscar_categories
        const user = g.profiles?.username
        const yr   = g.oscar_years?.year
        if (!cat || (user !== 'matt' && user !== 'dustin')) continue
        // Phase 13e — unresolved picks (no winner marked yet) don't count against
        // accuracy; the live year's categories join the stats as winners land.
        if (g.is_correct === null || g.is_correct === undefined) continue
        if (!catMap[cat.id]) {
          catMap[cat.id] = {
            id: cat.id, name: cat.name, order: cat.display_order,
            group: cat.group_name, groupOrder: cat.group_order,
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
      const cats = Object.values(catMap).map(c => {
        let pairs = 0, agrees = 0
        for (const d of Object.values(c.byYear)) {
          if (d.matt?.guess != null && d.dustin?.guess != null) {
            pairs++
            if (d.matt.guess === d.dustin.guess) agrees++
          }
        }
        return {
          ...c,
          mattPct:     pct(c.matt.correct,   c.matt.total),
          dustinPct:   pct(c.dustin.correct, c.dustin.total),
          combinedPct: pct(c.matt.correct + c.dustin.correct, c.matt.total + c.dustin.total),
          pairs, agreePct: pct(agrees, pairs),
          isLegacy:    c.active_until !== null && c.active_until !== undefined,
          isNew:       c.active_from  !== null && c.active_from  > 2008,
        }
      })
      setYears((yrData || []).filter(y => y.winner && y.winner !== 'pending'))
      setCatData(cats)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="font-mono text-xs tracking-kicker text-gray-400 animate-pulse">CRUNCHING THE NUMBERS…</span>
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

  // yearly margins (championship card footer)
  const margins    = sorted.map(y => ({ year: y.year, m: Math.abs((y.matt_correct||0) - (y.dustin_correct||0)), winner: y.winner }))
  const avgMargin  = margins.length ? (margins.reduce((s, x) => s + x.m, 0) / margins.length).toFixed(1) : '0'
  const blowout    = [...margins].sort((a, b) => b.m - a.m)[0]

  // agreement stats (all-time + per year for the timeline)
  let totalPairs = 0, agreements = 0, agreedCorrect = 0, disagreements = 0, hermzWhenDisagree = 0, dustWhenDisagree = 0
  const agreeByYear = {}
  for (const cat of catData) {
    for (const d of Object.values(cat.byYear)) {
      if (d.matt?.guess != null && d.dustin?.guess != null) {
        totalPairs++
        const a = agreeByYear[d.year] || (agreeByYear[d.year] = { pairs: 0, agree: 0 })
        a.pairs++
        if (d.matt.guess === d.dustin.guess) {
          agreements++; a.agree++
          if (d.matt.correct) agreedCorrect++
        } else {
          disagreements++
          if (d.matt.correct) hermzWhenDisagree++
          if (d.dustin.correct) dustWhenDisagree++
        }
      }
    }
  }

  const timelineData = sorted.map(y => ({
    year: y.year, Hermz: y.matt_correct||0, Dust: y.dustin_correct||0,
    total: y.total_categories||0, tb: y.tiebreaker_used,
    Agree: pct(agreeByYear[y.year]?.agree, agreeByYear[y.year]?.pairs),
  }))
  const agreePct      = pct(agreements, totalPairs)
  const agreeAccuracy = pct(agreedCorrect, agreements)
  const hermzEdgePct  = pct(hermzWhenDisagree, disagreements)
  const dustEdgePct   = pct(dustWhenDisagree, disagreements)

  const grouped = GROUP_ORDER.map(g => ({
    g, color: GROUP_COLOR[g],
    cats: catData.filter(c => c.group === g).sort((a,b) => a.order - b.order),
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
            <Link to="/oscars" className="font-mono text-xs tracking-kicker text-gold-500
                                          hover:text-gold-400 transition-colors flex items-center gap-2">
              <OscarIcon size={12} /> OSCARS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-xs tracking-kicker text-white">STATS</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white tracking-wide leading-[0.92]">
            ALL-TIME STATS
          </h1>
          <p className="font-mono text-sm tracking-kicker uppercase text-gray-300 mt-3">
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
            <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none mb-4">Championship Record</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <PlayerStat name="Hermz" value={mattWins}   sub={pctStr(mattWins, years.length)}   color="gold" leading={mattWins > dustinWins} />
              <div className="flex flex-col items-center justify-center">
                <span className="font-display text-2xl text-gray-500">vs</span>
                <span className="font-mono text-xs tracking-kicker text-gray-400 mt-1">{years.length} years</span>
              </div>
              <PlayerStat name="Dust"  value={dustinWins} sub={pctStr(dustinWins, years.length)} color="film" leading={dustinWins > mattWins} />
            </div>
            <div className="mt-4 pt-4 border-t border-night-700 grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="font-display text-xl text-white">{avgMargin}</div>
                <div className="kicker-dim mt-1">AVG MARGIN · CATEGORIES</div>
              </div>
              <div>
                <Link to={`/oscars/${blowout?.year}`} className="font-display text-xl text-white hover:text-gold-400 transition-colors">
                  {blowout?.year}
                </Link>
                <div className="kicker-dim mt-1">
                  BIGGEST GAP · {blowout?.winner === 'matt' ? 'HERMZ' : 'DUST'} +{blowout?.m}
                </div>
              </div>
            </div>
            {tbYears.length > 0 && (
              <div className="mt-4 pt-4 border-t border-night-700 text-center">
                <span className="badge-tiebreaker mr-2">{tbYears.length} TIEBREAKER{tbYears.length>1?'S':''}</span>
                <span className="font-mono text-xs tracking-kicker text-gray-400">
                  Hermz {mattTbWins} · Dust {dustinTbWins}
                </span>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none mb-4">Correct Guesses</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <PlayerStat name="Hermz" value={mattAllTime}   sub={`${pctStrFull(mattAllTime, totalPossible)} accuracy`}   color="gold" leading={mattAllTime > dustinAllTime} />
              <div className="flex flex-col items-center justify-center">
                <span className="font-display text-2xl text-gray-500">vs</span>
                <span className="font-mono text-xs tracking-kicker text-gray-400 mt-1">{totalPossible} possible</span>
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
            <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none mb-4">Win Streaks</h3>
            <ActiveStreak streaks={streaks} />
            <div className="mt-5 pt-4 border-t border-night-700/60">
              <StreakTimeline sorted={sorted} />
            </div>
          </div>
          <EraSplitCard sorted={sorted} />
        </div>

        {/* ── 3. Timeline ─────────────────────────────────────────────────── */}
        <div className="card">
          <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">Correct Guesses Over Time</h3>
          <p className="text-xs text-gray-400 mt-2 mb-5">◆ = tiebreaker year · dashed teal = agreement rate (right axis)</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timelineData} margin={{ top:5, right:0, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="year" tick={{ fontSize:12, fill:axisColor }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize:12, fill:axisColor }} tickLine={false} axisLine={false} domain={['dataMin - 1','dataMax + 1']} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`}
                     tick={{ fontSize:12, fill:axisColor }} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<TimelineTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:12, color:axisColor }} />
              <Line yAxisId="left" type="monotone" dataKey="Hermz" stroke={HC} strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={HC} />} activeDot={{ r:5 }} />
              <Line yAxisId="left" type="monotone" dataKey="Dust"  stroke={DC} strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={DC} />} activeDot={{ r:5 }} />
              <Line yAxisId="right" type="monotone" dataKey="Agree" name="Agree %" stroke={CC} strokeWidth={1.5}
                    strokeDasharray="6 4" strokeOpacity={0.7} dot={false} activeDot={{ r:4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── 4. Annual Difficulty ──────────────────────────────────────── */}
        <div className="card">
          <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">Annual Difficulty</h3>
          <p className="text-sm text-gray-400 mt-2 mb-4">Combined accuracy of both players · hardest years first</p>
          <DifficultyRating sorted={sorted} />
        </div>

        {/* ── 5. Peak & Valley + Upset Board ───────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none mb-4">Peak &amp; Valley</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-xs tracking-kicker text-gold-400 mb-2">HERMZ</div>
                <PeakRow label="Best"  year={mattBest?.year}   value={mattBest?.matt_correct}    total={mattBest?.total_categories} />
                <PeakRow label="Worst" year={mattWorst?.year}  value={mattWorst?.matt_correct}   total={mattWorst?.total_categories} isWorst />
              </div>
              <div>
                <div className="font-mono text-xs tracking-kicker text-film-400 mb-2">DUST</div>
                <PeakRow label="Best"  year={dustinBest?.year}  value={dustinBest?.dustin_correct}  total={dustinBest?.total_categories} />
                <PeakRow label="Worst" year={dustinWorst?.year} value={dustinWorst?.dustin_correct} total={dustinWorst?.total_categories} isWorst />
              </div>
            </div>
          </div>
          <UpsetBoard catData={catData} sorted={sorted} />
        </div>

        {/* ── 6. Category Heatmap ──────────────────────────────────────── */}
        <div className="card">
          <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none mb-5">Category Heatmap</h3>
          <CategoryHeatmap catData={catData} sorted={sorted} />
        </div>

        {/* ── 7. The Deciders + Money & Kryptonite ─────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <DecidersCard catData={catData} sorted={sorted} />
          <MoneyKryptoniteCard catData={catData} />
        </div>

        {/* ── 8. Category Streaks ──────────────────────────────────────── */}
        <div className="card">
          <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">Category Streaks</h3>
          <p className="text-sm text-gray-400 mt-2 mb-6">
            Hot and cold runs of 3+ years · longest-ever runs of 4+
          </p>
          <CategoryStreaksSection catData={catData} sorted={sorted} />
        </div>

        {/* ── 9. Category Breakdown (Accuracy / H2H / Ownership / Agreement) ── */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-night-700/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">Category Breakdown</h3>
              <p className="text-xs text-gray-400 mt-2">
                {catView === 'ownership'
                  ? 'Faded = retired'
                  : catView === 'agreement'
                  ? 'How often you pick the same nominee'
                  : 'Click any row for the year-by-year record'}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-night-700/60 rounded-full p-1">
              {[['accuracy','Accuracy'],['h2h','Head-to-Head'],['ownership','Ownership'],['agreement','Agreement']].map(([val, label]) => (
                <button key={val} onClick={() => setCatView(val)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    catView === val ? 'bg-white text-night-950' : 'text-gray-400 hover:text-gray-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(catView === 'h2h' || catView === 'ownership') && (
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

          {catView === 'agreement' && (
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-3 px-4 bg-night-900/40 border-b border-night-700/60">
              <div className="text-center">
                <span className="font-display text-2xl" style={{ color: CC }}>{agreePct}%</span>
                <div className="kicker-dim mt-1">AGREE</div>
              </div>
              <div className="text-center">
                <span className="font-display text-2xl text-emerald-400">{agreeAccuracy}%</span>
                <div className="kicker-dim mt-1">AGREED · RIGHT</div>
              </div>
              <div className="text-center">
                <span className="font-display text-2xl" style={{ color: HC }}>{hermzEdgePct}%</span>
                <div className="kicker-dim mt-1">HERMZ WHEN SPLIT</div>
              </div>
              <div className="text-center">
                <span className="font-display text-2xl" style={{ color: DC }}>{dustEdgePct}%</span>
                <div className="kicker-dim mt-1">DUST WHEN SPLIT</div>
              </div>
            </div>
          )}

          {catView === 'ownership' ? (
            <div className="px-6 py-5">
              <OwnershipGrid catData={catData} />
            </div>
          ) : (
            <div className="px-4 py-4 space-y-5">
              {grouped.map(({ g, color, cats }) => (
                <div key={g}>
                  <div className="flex items-center gap-2 mb-2"
                       style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10 }}>
                    <span className="font-mono text-xs tracking-cinema uppercase" style={{ color }}>
                      {g}
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
          )}
        </div>
      </div>
    </div>
  )
}

// ── DecidersCard — the categories that swung championships ──────────────────
// A "decider" = in a year decided by ≤2 categories (incl. tiebreaker years),
// a split pick the champion got right — flip that one call and the title flips.
function DecidersCard({ catData, sorted }) {
  const byCat = {}
  let closeYears = 0
  for (const y of sorted) {
    if (y.winner !== 'matt' && y.winner !== 'dustin') continue
    const margin = Math.abs((y.matt_correct||0) - (y.dustin_correct||0))
    if (margin > 2) continue
    closeYears++
    for (const cat of catData) {
      const d = cat.byYear[y.year]
      if (!d?.matt || !d?.dustin) continue
      if (!!d.matt.correct === !!d.dustin.correct) continue
      const champCorrect = y.winner === 'matt' ? d.matt.correct : d.dustin.correct
      if (!champCorrect) continue
      const k = cat.id
      if (!byCat[k]) byCat[k] = { name: cat.name.replace('Best ', ''), years: [] }
      byCat[k].years.push(y.year)
    }
  }
  const rows = Object.values(byCat).sort((a, b) => b.years.length - a.years.length).slice(0, 10)
  return (
    <div className="card">
      <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">The Deciders</h3>
      <p className="text-xs text-gray-400 mt-2 mb-3">
        Split picks the champion won in years decided by ≤2 categories — flip one, the title flips
      </p>
      <p className="font-mono text-xs tracking-kicker text-gold-400 uppercase mb-4">
        {closeYears} of {sorted.length} titles hinged on a category or two
      </p>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.name} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-night-800/50 hover:bg-night-800 transition-colors">
            <span className="font-display not-italic text-3xl leading-none w-8 text-center flex-shrink-0 text-gold-400">{r.years.length}</span>
            <span className="text-sm text-gray-100 flex-1 min-w-0 truncate">{r.name}</span>
            <span className="flex flex-wrap gap-1.5 justify-end">
              {r.years.map(yr => (
                <Link key={yr} to={`/oscars/${yr}`}
                  className="font-mono text-xs text-gray-400 hover:text-gold-400 transition-colors">
                  '{String(yr).slice(2)}
                </Link>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── UpsetBoard — winners that beat both players ─────────────────────────────
function UpsetBoard({ catData, sorted }) {
  const byCat = {}, byYear = {}
  let upsets = 0, contested = 0
  for (const cat of catData) {
    for (const d of Object.values(cat.byYear)) {
      if (!d.matt || !d.dustin) continue
      contested++
      if (!d.matt.correct && !d.dustin.correct) {
        upsets++
        const nm = cat.name.replace('Best ', '')
        byCat[nm] = (byCat[nm] || 0) + 1
        byYear[d.year] = (byYear[d.year] || 0) + 1
      }
    }
  }
  const topCats  = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topYears = Object.entries(byYear).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const RED = '#f87171'
  return (
    <div className="card">
      <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">Upset Board</h3>
      <p className="text-xs text-gray-400 mt-2 mb-3">Winners neither of you picked</p>
      <p className="font-mono text-xs tracking-kicker uppercase mb-4" style={{ color: RED }}>
        {upsets} of {contested} contested calls · {pct(upsets, contested)}% shock rate
      </p>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="kicker-dim mb-2">SHOCK CATEGORIES</div>
          <div className="space-y-1.5">
            {topCats.map(([nm, n]) => (
              <div key={nm} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-red-900/10">
                <span className="font-display not-italic text-2xl leading-none w-6 text-center flex-shrink-0" style={{ color: RED }}>{n}</span>
                <span className="text-sm text-gray-100 min-w-0 truncate">{nm}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="kicker-dim mb-2">CHAOS YEARS</div>
          <div className="space-y-1.5">
            {topYears.map(([yr, n]) => (
              <Link key={yr} to={`/oscars/${yr}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 bg-red-900/10 hover:bg-red-900/20 transition-colors">
                <span className="font-display not-italic text-2xl leading-none w-6 text-center flex-shrink-0" style={{ color: RED }}>{n}</span>
                <span className="font-mono text-sm text-gray-100">{yr}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EraSplitCard — first half vs second half of the rivalry ─────────────────
function EraSplitCard({ sorted }) {
  if (sorted.length < 4) return null
  const half = Math.ceil(sorted.length / 2)
  const eraStat = yrs => {
    const mC  = yrs.reduce((s, y) => s + (y.matt_correct   || 0), 0)
    const dC  = yrs.reduce((s, y) => s + (y.dustin_correct || 0), 0)
    const tot = yrs.reduce((s, y) => s + (y.total_categories || 0), 0)
    return {
      label: `${yrs[0].year}–${yrs[yrs.length - 1].year}`,
      mW: yrs.filter(y => y.winner === 'matt').length,
      dW: yrs.filter(y => y.winner === 'dustin').length,
      mPct: pctFull(mC, tot), dPct: pctFull(dC, tot),
    }
  }
  const e1 = eraStat(sorted.slice(0, half))
  const e2 = eraStat(sorted.slice(half))
  const trends = [
    { name: 'HERMZ', color: HC, d: e2.mPct - e1.mPct },
    { name: 'DUST',  color: DC, d: e2.dPct - e1.dPct },
  ]
  return (
    <div className="card">
      <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none mb-4">Era Split</h3>
      <div className="grid grid-cols-2 gap-4">
        {[e1, e2].map(era => (
          <div key={era.label} className="bg-night-700/40 rounded-xl p-4 text-center">
            <div className="font-mono text-xs tracking-kicker text-gray-400 mb-3">{era.label}</div>
            <div className="flex items-baseline justify-center gap-3">
              <span className="font-display text-3xl leading-none" style={{ color: HC, opacity: era.mW >= era.dW ? 1 : 0.55 }}>{era.mW}</span>
              <span className="text-gray-500 text-sm">vs</span>
              <span className="font-display text-3xl leading-none" style={{ color: DC, opacity: era.dW >= era.mW ? 1 : 0.55 }}>{era.dW}</span>
            </div>
            <div className="kicker-dim mt-2 mb-3">TITLES</div>
            <div className="flex justify-center gap-4">
              <span className="font-mono text-xs" style={{ color: HC }}>{era.mPct.toFixed(1)}%</span>
              <span className="font-mono text-xs" style={{ color: DC }}>{era.dPct.toFixed(1)}%</span>
            </div>
            <div className="kicker-dim mt-1">ACCURACY</div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-night-700 grid grid-cols-2 gap-4 text-center">
        {trends.map(t => (
          <div key={t.name}>
            <div className={`font-display text-xl ${t.d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.d >= 0 ? '▲' : '▼'} {Math.abs(t.d).toFixed(1)} pts
            </div>
            <div className="font-mono text-xs tracking-kicker mt-1" style={{ color: t.color }}>{t.name} TREND</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MoneyKryptoniteCard — each player's best & worst categories ─────────────
const MIN_YEARS_PLAYED = 8
function MoneyKryptoniteCard({ catData }) {
  const cols = [
    { who: 'matt',   name: 'HERMZ', color: HC, pctKey: 'mattPct' },
    { who: 'dustin', name: 'DUST',  color: DC, pctKey: 'dustinPct' },
  ].map(p => {
    const eligible = catData.filter(c => c[p.who].total >= MIN_YEARS_PLAYED)
    const best  = [...eligible].sort((a, b) => b[p.pctKey] - a[p.pctKey]).slice(0, 3)
    const worst = [...eligible].sort((a, b) => a[p.pctKey] - b[p.pctKey]).slice(0, 3)
    return { ...p, best, worst }
  })

  const Row = ({ cat, pctKey, color }) => (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm text-gray-200 truncate">{cat.name.replace('Best ', '')}</span>
      <span className="font-mono text-xs font-semibold flex-shrink-0" style={{ color }}>{cat[pctKey]}%</span>
    </div>
  )

  return (
    <div className="card">
      <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">Money &amp; Kryptonite</h3>
      <p className="text-xs text-gray-400 mt-2 mb-4">Minimum {MIN_YEARS_PLAYED} years played</p>
      <div className="grid grid-cols-2 gap-5">
        {cols.map(p => (
          <div key={p.who}>
            <div className="font-mono text-xs tracking-kicker mb-2" style={{ color: p.color }}>{p.name}</div>
            <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/30 px-3 py-2 mb-2">
              <div className="kicker-dim mb-1">💰 MONEY</div>
              {p.best.map(c => <Row key={c.id} cat={c} pctKey={p.pctKey} color="#34d399" />)}
            </div>
            <div className="rounded-lg bg-red-900/15 border border-red-800/30 px-3 py-2">
              <div className="kicker-dim mb-1">🪨 KRYPTONITE</div>
              {p.worst.map(c => <Row key={c.id} cat={c} pctKey={p.pctKey} color="#f87171" />)}
            </div>
          </div>
        ))}
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
      <div className={`font-mono text-xs tracking-cinema ${c} mb-1.5`}>{name}</div>
      <div className="flex items-baseline justify-center gap-1">
        <span className="font-display text-4xl text-white leading-none tracking-wide">{typeof pct === 'number' ? pct.toFixed(2) : pct}</span>
        <span className="font-mono text-sm text-gray-400">%</span>
      </div>
      <div className="font-mono text-xs tracking-kicker text-gray-400 mt-1">{total} CORRECT</div>
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
      <div className={`font-mono text-xs tracking-cinema mt-2 ${subColor}`}>{name.toUpperCase()}</div>
      {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
    </div>
  )
}

function ActiveStreak({ streaks }) {
  const { mattCurrent, dustinCurrent, mattStreakStart, dustinStreakStart, lastYear } = streaks
  if (!mattCurrent && !dustinCurrent) {
    return <div className="text-sm text-gray-400">No active streak</div>
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
        <div className="font-mono text-xs tracking-kicker text-night-950/70 mt-1">
          {count === 1 ? 'YEAR' : 'YEARS'}
        </div>
      </div>
      <div>
        <div className="text-night-950 font-semibold text-sm">{name} is on a roll</div>
        <div className="font-mono text-xs tracking-kicker text-night-950/70 mt-0.5">{range}</div>
      </div>
    </div>
  )
}

function PeakRow({ label, year, value, total, isWorst }) {
  return (
    <Link to={`/oscars/${year}`}
      className="flex items-center justify-between rounded-lg px-3 py-2 mb-2 bg-night-700/40 hover:bg-night-700 transition-colors group">
      <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase">{label}</span>
      <div className="text-right">
        <span className={`font-display text-base ${isWorst ? 'text-red-400' : 'text-emerald-400'} leading-none`}>{value}</span>
        <span className="font-mono text-xs text-gray-400 ml-1">/ {total}</span>
        <span className="font-mono text-xs text-gray-400 ml-2 group-hover:text-gold-400 transition-colors">{year}</span>
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
        className={`flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 cursor-pointer transition-colors ${
          expanded ? 'bg-night-700/60' : 'hover:bg-night-700/30'
        }`}
        style={{ opacity: labelOpacity }}
      >
        <div className="w-24 sm:w-44 flex-shrink-0 text-right">
          <span className="text-xs text-gray-300 leading-tight block truncate">{cat.name.replace('Best ', '')}</span>
        </div>
        {view === 'accuracy' ? <MiniBar h={h} d={d} />
          : view === 'agreement' ? <AgreeBar a={cat.agreePct} />
          : <SplitBar h={h} d={d} />}
        {view === 'agreement' ? (
          <div className="hidden sm:block w-14 flex-shrink-0 text-xs text-gray-400 text-right">
            {cat.pairs} yrs
          </div>
        ) : (
          <div className="hidden sm:block w-14 flex-shrink-0 text-xs font-semibold text-right" style={{ color: edgeColor }}>
            {edgeLabel}
          </div>
        )}
        <div className={`text-gray-500 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</div>
      </div>

      {expanded && (
        <div className="mx-3 mb-2 rounded-lg overflow-hidden border border-night-600">
          <div className="px-3 py-2 bg-night-900 border-b border-night-600">
            <span className="text-xs font-semibold text-gray-200">{cat.name} — Year by Year</span>
            <span className="text-xs text-gray-400 ml-3">
              Hermz {cat.matt.correct}/{cat.matt.total} · Dust {cat.dustin.correct}/{cat.dustin.total}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="bg-night-900/60">
                  <th className="px-3 py-1.5 text-left text-gray-400 font-medium">Year</th>
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
                        <span className={row.matt.correct ? 'text-emerald-400' : 'text-gray-400'}>
                          {row.matt.correct ? '✓' : '✗'} {row.matt.guess}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.dustin ? (
                        <span className={row.dustin.correct ? 'text-emerald-400' : 'text-gray-400'}>
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
