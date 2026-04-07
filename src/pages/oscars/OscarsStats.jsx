import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine,
  Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

// ── colour tokens (match Tailwind palette) ────────────────────────────────────
const MATT_COLOR   = '#d97706'   // gold-600
const DUSTIN_COLOR = '#6170f5'   // film-500

// ── helpers ───────────────────────────────────────────────────────────────────

function pct(n, d) {
  if (!d) return 0
  return Math.round((n / d) * 100)
}

function pctStr(n, d) {
  return `${pct(n, d)}%`
}

/** Build win-streak data from sorted-ascending year rows */
function computeStreaks(sorted) {
  let mattCur = 0, dustinCur = 0
  let mattMax = 0, dustinMax = 0
  let mattMaxEnd = null, dustinMaxEnd = null

  for (const y of sorted) {
    if (y.winner === 'matt') {
      mattCur++; dustinCur = 0
      if (mattCur > mattMax) { mattMax = mattCur; mattMaxEnd = y.year }
    } else if (y.winner === 'dustin') {
      dustinCur++; mattCur = 0
      if (dustinCur > dustinMax) { dustinMax = dustinCur; dustinMaxEnd = y.year }
    } else {
      mattCur = 0; dustinCur = 0
    }
  }
  return {
    mattCurrent: mattCur,
    dustinCurrent: dustinCur,
    mattLongest: mattMax,
    dustinLongest: dustinMax,
    mattLongestEnd: mattMaxEnd,
    dustinLongestEnd: dustinMaxEnd,
  }
}

// ── custom tooltip ────────────────────────────────────────────────────────────

function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-night-800 border border-stone-200 dark:border-night-600
                    rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
          {p.payload.total ? <span className="text-gray-400 text-xs ml-1">/ {p.payload.total}</span> : null}
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
    <div className="bg-white dark:bg-night-800 border border-stone-200 dark:border-night-600
                    rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-300">
        Margin: <span className="font-bold">{Math.abs(val)}</span>
        {val !== 0 && <span className="ml-1 text-xs text-gray-400">({winner} won)</span>}
      </p>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function OscarsStats() {
  const { isDark } = useTheme()
  const [years,      setYears]      = useState([])
  const [catData,    setCatData]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [catSort,    setCatSort]    = useState('order') // 'order' | 'matt' | 'dustin' | 'combined'

  // chart theme
  const gridColor   = isDark ? '#1e1e30' : '#e5e7eb'
  const axisColor   = isDark ? '#6b7280' : '#9ca3af'
  const tooltipBg   = isDark ? '#161625' : '#ffffff'

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      // 1 — year summaries
      const { data: yrData, error: yrErr } = await supabase
        .from('v_oscar_year_summary')
        .select('*')
        .order('year', { ascending: true })
      if (yrErr) throw yrErr

      // 2 — all guesses with category + profile
      const { data: guesses, error: gErr } = await supabase
        .from('oscar_guesses')
        .select('is_correct, oscar_categories(id, name, display_order), profiles(username)')
      if (gErr) throw gErr

      // Build category accuracy map
      const catMap = {}
      for (const g of guesses) {
        const cat  = g.oscar_categories
        const user = g.profiles?.username
        if (!cat || (user !== 'matt' && user !== 'dustin')) continue
        if (!catMap[cat.id]) {
          catMap[cat.id] = {
            id: cat.id, name: cat.name, order: cat.display_order,
            matt:   { correct: 0, total: 0 },
            dustin: { correct: 0, total: 0 },
          }
        }
        catMap[cat.id][user].total++
        if (g.is_correct) catMap[cat.id][user].correct++
      }

      const cats = Object.values(catMap).map(c => ({
        ...c,
        mattPct:     pct(c.matt.correct,   c.matt.total),
        dustinPct:   pct(c.dustin.correct, c.dustin.total),
        combinedPct: pct(c.matt.correct + c.dustin.correct, c.matt.total + c.dustin.total),
        gap:         pct(c.matt.correct, c.matt.total) - pct(c.dustin.correct, c.dustin.total),
      }))

      setYears(yrData || [])
      setCatData(cats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="text-gray-400 animate-pulse">Crunching the numbers…</span>
    </div>
  )
  if (error) return (
    <div className="py-20 text-center text-red-500 dark:text-red-400">Error: {error}</div>
  )

  // ── derived stats ────────────────────────────────────────────────────────────

  const sorted       = [...years].sort((a, b) => a.year - b.year)  // asc for streaks
  const mattWins     = years.filter(y => y.winner === 'matt').length
  const dustinWins   = years.filter(y => y.winner === 'dustin').length
  const tbYears      = years.filter(y => y.tiebreaker_used)
  const mattTbWins   = tbYears.filter(y => y.winner === 'matt').length
  const dustinTbWins = tbYears.filter(y => y.winner === 'dustin').length

  const mattAllTime   = years.reduce((s, y) => s + (y.matt_correct   || 0), 0)
  const dustinAllTime = years.reduce((s, y) => s + (y.dustin_correct || 0), 0)
  const totalPossible = years.reduce((s, y) => s + (y.total_categories || 0), 0)

  const streaks = computeStreaks(sorted)

  // best / worst year
  const mattBest   = [...years].sort((a,b) => (b.matt_correct||0)   - (a.matt_correct||0))[0]
  const mattWorst  = [...years].sort((a,b) => (a.matt_correct||0)   - (b.matt_correct||0))[0]
  const dustinBest  = [...years].sort((a,b) => (b.dustin_correct||0) - (a.dustin_correct||0))[0]
  const dustinWorst = [...years].sort((a,b) => (a.dustin_correct||0) - (b.dustin_correct||0))[0]

  // timeline chart data
  const timelineData = sorted.map(y => ({
    year:   y.year,
    Hermz:  y.matt_correct   || 0,
    Dust:   y.dustin_correct || 0,
    total:  y.total_categories || 0,
    tb:     y.tiebreaker_used,
  }))

  // margin chart data (positive = Matt won, negative = Dustin won)
  const marginData = sorted.map(y => {
    const diff = (y.matt_correct||0) - (y.dustin_correct||0)
    return { year: y.year, diff, tb: y.tiebreaker_used }
  })

  // sorted category table
  const sortedCats = [...catData].sort((a, b) => {
    if (catSort === 'matt')     return b.mattPct     - a.mattPct
    if (catSort === 'dustin')   return b.dustinPct   - a.dustinPct
    if (catSort === 'combined') return b.combinedPct - a.combinedPct
    return a.order - b.order
  })

  // highlight groups
  const top5easiest  = [...catData].sort((a,b) => b.combinedPct - a.combinedPct).slice(0,5)
  const top5hardest  = [...catData].sort((a,b) => a.combinedPct - b.combinedPct).slice(0,5)
  const hermzEdge    = [...catData].filter(c => c.matt.total >= 3).sort((a,b) => b.gap - a.gap).slice(0,4)
  const dustEdge     = [...catData].filter(c => c.dustin.total >= 3).sort((a,b) => a.gap - b.gap).slice(0,4)

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/oscars" className="text-gray-400 hover:text-gold-600 transition-colors dark:text-gray-500 dark:hover:text-gold-400">
          🏆 Oscars
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-800 font-medium dark:text-white">Stats</span>
      </div>

      {/* ── Header ── */}
      <div>
        <h1 className="page-title">📊 All-Time Stats</h1>
        <p className="text-gray-500 mt-1 text-sm">{years.length} ceremonies · 2008–2026</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Overall Record                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Win record */}
        <div className="card">
          <p className="stat-label mb-4">Yearly Championship Record</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <PlayerStat
              name="Hermz"
              value={mattWins}
              sub={`${pctStr(mattWins, years.length)} of years`}
              highlight={mattWins > dustinWins}
              color="gold"
            />
            <div className="flex flex-col items-center justify-center">
              <span className="text-gray-300 dark:text-gray-600 font-display text-xl">vs</span>
              <span className="text-gray-400 text-xs mt-1">{years.length} years</span>
            </div>
            <PlayerStat
              name="Dust"
              value={dustinWins}
              sub={`${pctStr(dustinWins, years.length)} of years`}
              highlight={dustinWins > mattWins}
              color="film"
            />
          </div>

          {/* Tiebreaker sub-line */}
          {tbYears.length > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-night-700 text-center">
              <span className="badge-tiebreaker mr-2">{tbYears.length} tiebreaker{tbYears.length > 1 ? 's' : ''}</span>
              <span className="text-xs text-gray-400">
                Hermz won {mattTbWins} · Dust won {dustinTbWins}
              </span>
            </div>
          )}
        </div>

        {/* All-time correct */}
        <div className="card">
          <p className="stat-label mb-4">All-Time Correct Guesses</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <PlayerStat
              name="Hermz"
              value={mattAllTime}
              sub={`${pctStr(mattAllTime, totalPossible)} accuracy`}
              highlight={mattAllTime > dustinAllTime}
              color="gold"
            />
            <div className="flex flex-col items-center justify-center">
              <span className="text-gray-300 dark:text-gray-600 font-display text-xl">vs</span>
              <span className="text-gray-400 text-xs mt-1">{totalPossible} possible</span>
            </div>
            <PlayerStat
              name="Dust"
              value={dustinAllTime}
              sub={`${pctStr(dustinAllTime, totalPossible)} accuracy`}
              highlight={dustinAllTime > mattAllTime}
              color="film"
            />
          </div>

          {/* Per-year average */}
          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-night-700">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xl font-bold font-display text-gray-800 dark:text-white">
                  {(mattAllTime / years.length).toFixed(1)}
                </div>
                <div className="text-xs text-gray-400">Hermz avg / year</div>
              </div>
              <div>
                <div className="text-xl font-bold font-display text-gray-800 dark:text-white">
                  {(dustinAllTime / years.length).toFixed(1)}
                </div>
                <div className="text-xs text-gray-400">Dust avg / year</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Streaks & Peak Years                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Streaks */}
        <div className="card">
          <p className="stat-label mb-4">Win Streaks</p>
          <div className="space-y-4">
            <StreakRow
              label="Current streak"
              mattVal={streaks.mattCurrent}
              dustinVal={streaks.dustinCurrent}
            />
            <StreakRow
              label="Longest streak"
              mattVal={streaks.mattLongest}
              dustinVal={streaks.dustinLongest}
              mattSub={streaks.mattLongestEnd   ? `ended ${streaks.mattLongestEnd}`   : null}
              dustinSub={streaks.dustinLongestEnd ? `ended ${streaks.dustinLongestEnd}` : null}
            />
          </div>
        </div>

        {/* Best & Worst years */}
        <div className="card">
          <p className="stat-label mb-4">Peak & Trough Seasons</p>
          <div className="grid grid-cols-2 gap-4">

            {/* Hermz */}
            <div>
              <div className="text-xs font-semibold text-gold-600 dark:text-gold-400 uppercase tracking-wide mb-2">Hermz</div>
              <PeakRow label="Best" year={mattBest?.year}
                value={mattBest?.matt_correct} total={mattBest?.total_categories} />
              <PeakRow label="Worst" year={mattWorst?.year}
                value={mattWorst?.matt_correct} total={mattWorst?.total_categories} isWorst />
            </div>

            {/* Dust */}
            <div>
              <div className="text-xs font-semibold text-film-600 dark:text-film-400 uppercase tracking-wide mb-2">Dust</div>
              <PeakRow label="Best" year={dustinBest?.year}
                value={dustinBest?.dustin_correct} total={dustinBest?.total_categories} />
              <PeakRow label="Worst" year={dustinWorst?.year}
                value={dustinWorst?.dustin_correct} total={dustinWorst?.total_categories} isWorst />
            </div>

          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Score Timeline                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="card">
        <p className="stat-label mb-1">Correct Guesses Over Time</p>
        <p className="text-xs text-gray-400 mb-5">Per ceremony, 2008–2026. ◆ = tiebreaker year.</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={timelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false}
                   domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip content={<TimelineTooltip />} />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              formatter={(val) => (
                <span className="text-gray-600 dark:text-gray-300">{val}</span>
              )}
            />
            <Line type="monotone" dataKey="Hermz" stroke={MATT_COLOR}
              strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={MATT_COLOR} />}
              activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="Dust" stroke={DUSTIN_COLOR}
              strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={DUSTIN_COLOR} />}
              activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Winning Margin                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="card">
        <p className="stat-label mb-1">Winning Margin by Year</p>
        <p className="text-xs text-gray-400 mb-5">
          Positive = Hermz won · Negative = Dust won · 0 = decided by tiebreaker.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={marginData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} />
            <Tooltip content={<DiffTooltip />} />
            <ReferenceLine y={0} stroke={axisColor} strokeWidth={1} />
            <Bar dataKey="diff" radius={[3,3,0,0]} maxBarSize={32}>
              {marginData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.diff > 0 ? MATT_COLOR : entry.diff < 0 ? DUSTIN_COLOR : '#6b7280'}
                  opacity={entry.tb ? 0.55 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — Category Accuracy Table                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b border-stone-100 dark:border-night-700
                        flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="stat-label">Category Accuracy</p>
            <p className="text-xs text-gray-400 mt-0.5">All-time correct guesses per category</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Sort by:</span>
            {[['order','Category'], ['matt','Hermz'], ['dustin','Dust'], ['combined','Combined']].map(([val, label]) => (
              <button key={val}
                onClick={() => setCatSort(val)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  catSort === val
                    ? 'bg-gold-100 text-gold-700 font-semibold dark:bg-gold-900/30 dark:text-gold-400'
                    : 'text-gray-500 hover:bg-stone-100 dark:hover:bg-night-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Category</th>
              <th className="table-header text-center text-gold-600/80 dark:text-gold-500/80">Hermz</th>
              <th className="table-header text-center text-film-600/80 dark:text-film-400/80">Dust</th>
              <th className="table-header text-center">Combined</th>
              <th className="table-header text-center">Edge</th>
            </tr>
          </thead>
          <tbody>
            {sortedCats.map((cat, idx) => (
              <CategoryAccuracyRow key={cat.id} cat={cat} idx={idx} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6 — Highlights                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        <HighlightCard title="🟢 Easiest Categories" sub="Highest combined accuracy" items={top5easiest}
          renderSub={c => `${c.combinedPct}% combined`} />

        <HighlightCard title="🔴 Hardest Categories" sub="Lowest combined accuracy" items={top5hardest}
          renderSub={c => `${c.combinedPct}% combined`} />

        <HighlightCard
          title={<><span style={{ color: MATT_COLOR }}>Hermz</span> Dominates</>}
          sub="Categories where Hermz significantly outperforms"
          items={hermzEdge}
          renderSub={c => `Hermz ${c.mattPct}% vs Dust ${c.dustinPct}%`}
        />

        <HighlightCard
          title={<><span style={{ color: DUSTIN_COLOR }}>Dust</span> Dominates</>}
          sub="Categories where Dust significantly outperforms"
          items={dustEdge}
          renderSub={c => `Dust ${c.dustinPct}% vs Hermz ${c.mattPct}%`}
        />

      </div>

    </div>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function PlayerStat({ name, value, sub, highlight, color }) {
  const textColor = highlight
    ? color === 'gold'
      ? 'text-gold-600 dark:text-gold-300'
      : 'text-film-600 dark:text-film-400'
    : 'text-gray-700 dark:text-white'
  const bg = highlight
    ? color === 'gold'
      ? 'bg-gold-50 border border-gold-200 dark:bg-gold-900/30 dark:border-gold-700/30'
      : 'bg-film-50 border border-film-200 dark:bg-film-900/30 dark:border-film-700/30'
    : 'bg-stone-50 dark:bg-night-700/40'

  return (
    <div className={`rounded-xl py-4 px-2 ${bg}`}>
      <div className={`text-3xl font-bold font-display ${textColor}`}>{value}</div>
      <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{name}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function StreakRow({ label, mattVal, dustinVal, mattSub, dustinSub }) {
  const mattWinner   = mattVal > 0 && mattVal >= dustinVal
  const dustinWinner = dustinVal > 0 && dustinVal > mattVal
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg px-3 py-2 text-center
          ${mattWinner ? 'bg-gold-50 dark:bg-gold-900/20' : 'bg-stone-50 dark:bg-night-700/30'}`}>
          <span className={`text-2xl font-bold font-display
            ${mattWinner ? 'text-gold-600 dark:text-gold-300' : 'text-gray-600 dark:text-gray-300'}`}>
            {mattVal}
          </span>
          <span className="text-xs text-gray-400 ml-1">{mattVal === 1 ? 'yr' : 'yrs'}</span>
          <div className="text-xs text-gray-400">Hermz</div>
          {mattSub && <div className="text-xs text-gray-400">{mattSub}</div>}
        </div>
        <div className={`rounded-lg px-3 py-2 text-center
          ${dustinWinner ? 'bg-film-50 dark:bg-film-900/20' : 'bg-stone-50 dark:bg-night-700/30'}`}>
          <span className={`text-2xl font-bold font-display
            ${dustinWinner ? 'text-film-600 dark:text-film-400' : 'text-gray-600 dark:text-gray-300'}`}>
            {dustinVal}
          </span>
          <span className="text-xs text-gray-400 ml-1">{dustinVal === 1 ? 'yr' : 'yrs'}</span>
          <div className="text-xs text-gray-400">Dust</div>
          {dustinSub && <div className="text-xs text-gray-400">{dustinSub}</div>}
        </div>
      </div>
    </div>
  )
}

function PeakRow({ label, year, value, total, isWorst }) {
  return (
    <Link to={`/oscars/${year}`}
      className="flex items-center justify-between rounded-lg px-3 py-2 mb-2
                 bg-stone-50 dark:bg-night-700/30 hover:bg-stone-100 dark:hover:bg-night-700
                 transition-colors group">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-bold ${isWorst
          ? 'text-red-500 dark:text-red-400'
          : 'text-emerald-600 dark:text-emerald-400'}`}>
          {value}
        </span>
        <span className="text-xs text-gray-400 ml-1">/ {total}</span>
        <span className="text-xs text-gray-500 ml-2 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">
          {year}
        </span>
      </div>
    </Link>
  )
}

function ChartDot(props) {
  const { cx, cy, tb, color } = props
  if (tb) {
    return <polygon key={`dot-${cx}-${cy}`}
      points={`${cx},${cy-5} ${cx+5},${cy+4} ${cx-5},${cy+4}`}
      fill={color} stroke="none" />
  }
  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={color} stroke="none" />
}

function AccuracyBar({ pct: p, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-stone-100 dark:bg-night-700 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-8 text-right">{p}%</span>
    </div>
  )
}

function CategoryAccuracyRow({ cat, idx }) {
  const stripe = idx % 2 === 0 ? 'bg-white dark:bg-night-800' : 'bg-stone-50/70 dark:bg-night-800/50'
  const gap = cat.mattPct - cat.dustinPct
  const edgeColor = gap > 15 ? 'text-gold-600 dark:text-gold-400' :
                    gap < -15 ? 'text-film-600 dark:text-film-400' :
                    'text-gray-400'
  const edgeLabel = gap > 0 ? `+${gap} Hermz` : gap < 0 ? `${Math.abs(gap)} Dust` : '—'

  return (
    <tr className={`${stripe} table-row-hover`}>
      <td className="table-cell align-middle font-medium text-gray-700 dark:text-gray-200 py-3">
        {cat.name}
        <div className="text-xs text-gray-400">{cat.matt.total} years</div>
      </td>
      <td className="table-cell align-middle py-3 w-36">
        <AccuracyBar pct={cat.mattPct} color={MATT_COLOR} />
        <div className="text-xs text-gray-400 mt-0.5 text-right">
          {cat.matt.correct}/{cat.matt.total}
        </div>
      </td>
      <td className="table-cell align-middle py-3 w-36">
        <AccuracyBar pct={cat.dustinPct} color={DUSTIN_COLOR} />
        <div className="text-xs text-gray-400 mt-0.5 text-right">
          {cat.dustin.correct}/{cat.dustin.total}
        </div>
      </td>
      <td className="table-cell align-middle py-3 w-36">
        <AccuracyBar pct={cat.combinedPct} color="#10b981" />
      </td>
      <td className={`table-cell align-middle text-center text-xs font-semibold py-3 w-28 ${edgeColor}`}>
        {edgeLabel}
      </td>
    </tr>
  )
}

function HighlightCard({ title, sub, items, renderSub }) {
  return (
    <div className="card">
      <p className="font-semibold text-gray-800 dark:text-white text-base mb-0.5">{title}</p>
      <p className="text-xs text-gray-400 mb-4">{sub}</p>
      <ol className="space-y-2">
        {items.map((c, i) => (
          <li key={c.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300 dark:text-gray-600 w-4">{i+1}.</span>
              <span className="text-sm text-gray-700 dark:text-gray-200">{c.name}</span>
            </div>
            <span className="text-xs text-gray-400">{renderSub(c)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
