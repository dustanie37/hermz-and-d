import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'
import OscarIcon from '../../components/OscarIcon'

// ── colour tokens ─────────────────────────────────────────────────────────────
const HC = '#d97706'   // gold-600  (Hermz)
const DC = '#6170f5'   // film-500  (Dust)

// ── category groupings ────────────────────────────────────────────────────────
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
  Major:   { icon: '🎬', label: 'Major Awards',  color: '#7c3aed' },
  Acting:  { icon: '🎭', label: 'Acting',         color: '#db2777' },
  Writing: { icon: '✍️', label: 'Writing',        color: '#059669' },
  Craft:   { icon: '🎨', label: 'Craft',          color: '#0284c7' },
  Music:   { icon: '🎵', label: 'Music & Sound',  color: '#d97706' },
  Shorts:  { icon: '📽️', label: 'Short Films',    color: '#64748b' },
  Sound:   { icon: '🔇', label: 'Discontinued',   color: '#475569' },
}
const GROUP_ORDER = ['Major','Acting','Writing','Craft','Music','Shorts','Sound']

// ── helpers ───────────────────────────────────────────────────────────────────
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0 }
function pctStr(n, d) { return `${pct(n, d)}%` }

function computeStreaks(sorted) {
  let mattCur = 0, dustinCur = 0, mattMax = 0, dustinMax = 0
  let mattMaxEnd = null, dustinMaxEnd = null
  for (const y of sorted) {
    if (y.winner === 'matt')   { mattCur++;   dustinCur = 0; if (mattCur   > mattMax)   { mattMax   = mattCur;   mattMaxEnd   = y.year } }
    else if (y.winner === 'dustin') { dustinCur++; mattCur = 0;  if (dustinCur > dustinMax) { dustinMax = dustinCur; dustinMaxEnd = y.year } }
    else { mattCur = 0; dustinCur = 0 }
  }
  return { mattCurrent: mattCur, dustinCurrent: dustinCur, mattLongest: mattMax, dustinLongest: dustinMax, mattLongestEnd: mattMaxEnd, dustinLongestEnd: dustinMaxEnd }
}

// ── custom tooltips ───────────────────────────────────────────────────────────
function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-night-800 border border-stone-200 dark:border-night-600 rounded-lg px-3 py-2 shadow-lg text-sm">
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
    <div className="bg-white dark:bg-night-800 border border-stone-200 dark:border-night-600 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-300">
        Margin: <span className="font-bold">{Math.abs(val)}</span>
        {val !== 0 && <span className="ml-1 text-xs text-gray-400">({winner} won)</span>}
      </p>
    </div>
  )
}

function ChartDot(props) {
  const { cx, cy, tb, color } = props
  if (tb) return <polygon key={`d-${cx}-${cy}`} points={`${cx},${cy-5} ${cx+5},${cy+4} ${cx-5},${cy+4}`} fill={color} stroke="none" />
  return <circle key={`d-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={color} stroke="none" />
}

// ── MiniBar — mirrored accuracy bar ──────────────────────────────────────────
// Hermz fills left→right, Dust fills right→left. Leader at full opacity.
function MiniBar({ h, d }) {
  const hLeads = h > d, dLeads = d > h
  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-xs font-semibold w-8 text-right" style={{ color: HC }}>{h}%</span>
      {/* Hermz bar (L→R) */}
      <div className="flex-1 h-3 bg-stone-200 dark:bg-night-700 rounded-l-sm overflow-hidden">
        <div className="h-full rounded-l-sm transition-all"
          style={{ width: `${h}%`, backgroundColor: HC, opacity: hLeads ? 0.9 : 0.3 }} />
      </div>
      {/* Dust bar (R→L) */}
      <div className="flex-1 h-3 bg-stone-200 dark:bg-night-700 rounded-r-sm overflow-hidden flex flex-row-reverse">
        <div className="h-full rounded-r-sm transition-all"
          style={{ width: `${d}%`, backgroundColor: DC, opacity: dLeads ? 0.9 : 0.3 }} />
      </div>
      <span className="text-xs font-semibold w-8" style={{ color: DC }}>{d}%</span>
    </div>
  )
}

// ── SplitBar — head-to-head proportional bar ──────────────────────────────────
function SplitBar({ h, d }) {
  const hLeads = h > d, dLeads = d > h, tied = h === d
  const total = Math.max(h + d, 1)
  const hW = Math.round((h / total) * 100)
  const dW = 100 - hW
  return (
    <div className="flex flex-1 h-6 rounded overflow-hidden">
      <div className="flex items-center justify-center text-xs font-bold transition-all"
        style={{ width: `${hW}%`, backgroundColor: HC, opacity: hLeads ? 1 : 0.25, color: hLeads ? '#fff' : HC, minWidth: h ? 28 : 0 }}>
        {h > 5 ? `${h}%` : ''}
      </div>
      <div style={{ width: 2, backgroundColor: '#0a0a0f' }} />
      <div className="flex items-center justify-center text-xs font-bold transition-all flex-row-reverse"
        style={{ width: `${dW}%`, backgroundColor: DC, opacity: dLeads ? 1 : 0.25, color: dLeads ? '#fff' : DC, minWidth: d ? 28 : 0 }}>
        {d > 5 ? `${d}%` : ''}
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function OscarsStats() {
  const { isDark } = useTheme()
  const [years,       setYears]       = useState([])
  const [catData,     setCatData]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [catView,     setCatView]     = useState('accuracy')   // 'accuracy' | 'h2h'
  const [expandedCat, setExpandedCat] = useState(null)         // category id

  const gridColor  = isDark ? '#1e1e30' : '#e5e7eb'
  const axisColor  = isDark ? '#d1d5db' : '#9ca3af'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true); setError(null)
    try {
      const { data: yrData, error: yrErr } = await supabase
        .from('v_oscar_year_summary').select('*').order('year', { ascending: true })
      if (yrErr) throw yrErr

      // Include year + active_from/until so we can do drilldowns
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
            matt:   { correct: 0, total: 0 },
            dustin: { correct: 0, total: 0 },
            byYear: {},
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
        gap:         pct(c.matt.correct, c.matt.total) - pct(c.dustin.correct, c.dustin.total),
        isLegacy:    c.active_until !== null && c.active_until !== undefined,
        isNew:       c.active_from  !== null && c.active_from  > 2008,
      }))

      setYears(yrData || [])
      setCatData(cats)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="py-20 flex items-center justify-center"><span className="text-gray-400 animate-pulse">Crunching the numbers…</span></div>
  if (error)   return <div className="py-20 text-center text-red-500 dark:text-red-400">Error: {error}</div>

  // ── derived ──────────────────────────────────────────────────────────────────
  const sorted       = [...years].sort((a,b) => a.year - b.year)
  const mattWins     = years.filter(y => y.winner === 'matt').length
  const dustinWins   = years.filter(y => y.winner === 'dustin').length
  const tbYears      = years.filter(y => y.tiebreaker_used)
  const mattTbWins   = tbYears.filter(y => y.winner === 'matt').length
  const dustinTbWins = tbYears.filter(y => y.winner === 'dustin').length
  const mattAllTime   = years.reduce((s,y) => s + (y.matt_correct||0), 0)
  const dustinAllTime = years.reduce((s,y) => s + (y.dustin_correct||0), 0)
  const totalPossible = years.reduce((s,y) => s + (y.total_categories||0), 0)
  const streaks       = computeStreaks(sorted)
  const mattBest      = [...years].sort((a,b) => (b.matt_correct||0)   - (a.matt_correct||0))[0]
  const mattWorst     = [...years].sort((a,b) => (a.matt_correct||0)   - (b.matt_correct||0))[0]
  const dustinBest    = [...years].sort((a,b) => (b.dustin_correct||0) - (a.dustin_correct||0))[0]
  const dustinWorst   = [...years].sort((a,b) => (a.dustin_correct||0) - (b.dustin_correct||0))[0]

  const timelineData = sorted.map(y => ({ year: y.year, Hermz: y.matt_correct||0, Dust: y.dustin_correct||0, total: y.total_categories||0, tb: y.tiebreaker_used }))
  const marginData   = sorted.map(y => { const diff = (y.matt_correct||0)-(y.dustin_correct||0); return { year: y.year, diff, tb: y.tiebreaker_used } })

  // grouped categories
  const grouped = GROUP_ORDER.map(g => ({
    g, meta: GROUP_META[g],
    cats: catData.filter(c => (CAT_GROUP[c.name] || 'Craft') === g)
                 .sort((a,b) => a.order - b.order),
  })).filter(g => g.cats.length > 0)

  // h2h summary
  const hCW = catData.filter(c => c.mattPct > c.dustinPct).length
  const dCW = catData.filter(c => c.dustinPct > c.mattPct).length
  const tied = catData.filter(c => c.mattPct === c.dustinPct).length

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/oscars" className="text-gray-400 hover:text-gold-600 transition-colors dark:text-gray-500 dark:hover:text-gold-400 flex items-center gap-1">
          <OscarIcon size={14} /> Oscars
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-800 font-medium dark:text-white">Stats</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-3">
          <span>📊</span> All-Time Stats
        </h1>
        <p className="text-gray-500 dark:text-gray-200 mt-1 text-sm">{years.length} ceremonies · 2008–2026</p>
      </div>

      {/* ══ Section 1: Overall record + correct ══════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <p className="stat-label mb-4">Yearly Championship Record</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <PlayerStat name="Hermz" value={mattWins}   sub={pctStr(mattWins,   years.length)+' of years'} highlight={mattWins > dustinWins}   color="gold" />
            <div className="flex flex-col items-center justify-center">
              <span className="text-gray-400 dark:text-gray-200 font-display text-xl">vs</span>
              <span className="text-gray-400 dark:text-gray-200 text-xs mt-1">{years.length} years</span>
            </div>
            <PlayerStat name="Dust"  value={dustinWins} sub={pctStr(dustinWins, years.length)+' of years'} highlight={dustinWins > mattWins} color="film" />
          </div>
          {tbYears.length > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-night-700 text-center">
              <span className="badge-tiebreaker mr-2">{tbYears.length} tiebreaker{tbYears.length>1?'s':''}</span>
              <span className="text-xs text-gray-400 dark:text-gray-200">Hermz won {mattTbWins} · Dust won {dustinTbWins}</span>
            </div>
          )}
        </div>

        <div className="card">
          <p className="stat-label mb-4">All-Time Correct Guesses</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <PlayerStat name="Hermz" value={mattAllTime}   sub={pctStr(mattAllTime,   totalPossible)+' accuracy'} highlight={mattAllTime > dustinAllTime}   color="gold" />
            <div className="flex flex-col items-center justify-center">
              <span className="text-gray-400 dark:text-gray-200 font-display text-xl">vs</span>
              <span className="text-gray-400 dark:text-gray-200 text-xs mt-1">{totalPossible} possible</span>
            </div>
            <PlayerStat name="Dust"  value={dustinAllTime} sub={pctStr(dustinAllTime, totalPossible)+' accuracy'} highlight={dustinAllTime > mattAllTime} color="film" />
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-night-700 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xl font-bold font-display text-gray-800 dark:text-white">{(mattAllTime/years.length).toFixed(1)}</div>
              <div className="text-xs text-gray-400 dark:text-gray-200">Hermz avg / year</div>
            </div>
            <div>
              <div className="text-xl font-bold font-display text-gray-800 dark:text-white">{(dustinAllTime/years.length).toFixed(1)}</div>
              <div className="text-xs text-gray-400 dark:text-gray-200">Dust avg / year</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Section 2: Streaks + Peak seasons ════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <p className="stat-label mb-4">Win Streaks</p>
          <div className="space-y-4">
            <StreakRow label="Active streak" mattVal={streaks.mattCurrent} dustinVal={streaks.dustinCurrent} />
          </div>
        </div>
        <div className="card">
          <p className="stat-label mb-4">Peak &amp; Valley</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gold-600 dark:text-gold-400 uppercase tracking-wide mb-2">Hermz</div>
              <PeakRow label="Best"  year={mattBest?.year}   value={mattBest?.matt_correct}    total={mattBest?.total_categories} />
              <PeakRow label="Worst" year={mattWorst?.year}  value={mattWorst?.matt_correct}   total={mattWorst?.total_categories} isWorst />
            </div>
            <div>
              <div className="text-xs font-semibold text-film-600 dark:text-film-400 uppercase tracking-wide mb-2">Dust</div>
              <PeakRow label="Best"  year={dustinBest?.year}  value={dustinBest?.dustin_correct}  total={dustinBest?.total_categories} />
              <PeakRow label="Worst" year={dustinWorst?.year} value={dustinWorst?.dustin_correct} total={dustinWorst?.total_categories} isWorst />
            </div>
          </div>
        </div>
      </div>

      {/* ══ Section 3: Score Timeline ═════════════════════════════════════════ */}
      <div className="card">
        <p className="stat-label mb-1">Correct Guesses Over Time</p>
        <p className="text-xs text-gray-400 dark:text-gray-200 mb-5">Per ceremony 2008–2026. ◆ = tiebreaker year.</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={timelineData} margin={{ top:5, right:20, left:0, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="year" tick={{ fontSize:11, fill:axisColor }} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:axisColor }} tickLine={false} axisLine={false} domain={['dataMin - 1','dataMax + 1']} />
            <Tooltip content={<TimelineTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:12 }} />
            <Line type="monotone" dataKey="Hermz" stroke={HC} strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={HC} />} activeDot={{ r:5 }} />
            <Line type="monotone" dataKey="Dust"  stroke={DC} strokeWidth={2.5} dot={(p) => <ChartDot {...p} tb={p.payload.tb} color={DC} />} activeDot={{ r:5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ══ Section 4: Winning Margin ═════════════════════════════════════════ */}
      <div className="card">
        <p className="stat-label mb-1">Winning Margin by Year</p>
        <p className="text-xs text-gray-400 dark:text-gray-200 mb-5">Positive = Hermz won · Negative = Dust won · 0 = decided by tiebreaker.</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={marginData} margin={{ top:5, right:20, left:0, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize:11, fill:axisColor }} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:axisColor }} tickLine={false} axisLine={false} />
            <Tooltip content={<DiffTooltip />} />
            <ReferenceLine y={0} stroke={axisColor} strokeWidth={1} />
            <Bar dataKey="diff" radius={[3,3,0,0]} maxBarSize={32}>
              {marginData.map((e,i) => <Cell key={i} fill={e.diff>0 ? HC : e.diff<0 ? DC : '#6b7280'} opacity={e.tb ? 0.55 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ══ Section 5: Category Accuracy ══════════════════════════════════════ */}
      <div className="card p-0 overflow-hidden">

        {/* Header + view toggle */}
        <div className="px-6 pt-5 pb-3 border-b border-stone-100 dark:border-night-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="stat-label">Category Accuracy</p>
            <p className="text-xs text-gray-400 dark:text-gray-200 mt-0.5">All-time correct guesses per category · click any row to expand</p>
          </div>
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-night-700 rounded-lg p-1">
            {[['accuracy','Accuracy'],['h2h','Head-to-Head']].map(([val, label]) => (
              <button key={val} onClick={() => setCatView(val)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  catView === val
                    ? 'bg-white dark:bg-night-600 text-gray-800 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* H2H summary strip */}
        {catView === 'h2h' && (
          <div className="flex items-center justify-center gap-8 py-3 bg-stone-50 dark:bg-night-900/30 border-b border-stone-100 dark:border-night-700">
            <div className="text-center">
              <span className="text-2xl font-bold font-display" style={{ color: HC }}>{hCW}</span>
              <div className="text-xs text-gray-400 dark:text-gray-200">Hermz leads</div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold font-display text-gray-400 dark:text-gray-200">{tied}</span>
              <div className="text-xs text-gray-400 dark:text-gray-200">Tied</div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold font-display" style={{ color: DC }}>{dCW}</span>
              <div className="text-xs text-gray-400 dark:text-gray-200">Dust leads</div>
            </div>
          </div>
        )}

        {/* Accuracy legend */}
        {catView === 'accuracy' && (
          <div className="flex items-center gap-4 px-6 py-2 border-b border-stone-100 dark:border-night-700 text-xs text-gray-400 dark:text-gray-200">
            <span style={{ color: HC }}>■ Hermz fills left</span>
            <span style={{ color: DC }}>■ Dust fills right</span>
            <span className="text-gray-400 dark:text-gray-200">(brighter bar = category leader)</span>
          </div>
        )}

        {/* Grouped category rows */}
        <div className="px-4 py-4 space-y-5">
          {grouped.map(({ g, meta, cats }) => (
            <div key={g}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-2 pb-1"
                style={{ borderLeft: `3px solid ${meta.color}`, paddingLeft: 8 }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                  {meta.icon} {meta.label}
                </span>
              </div>

              {/* Category rows */}
              <div className="space-y-1">
                {cats.map(cat => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    view={catView}
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
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function PlayerStat({ name, value, sub, highlight, color }) {
  const bg       = highlight
    ? (color === 'gold' ? 'bg-gold-600 border border-gold-400' : 'bg-film-500 border border-film-400')
    : 'bg-slate-100 border border-slate-300 dark:bg-slate-700 dark:border-slate-500'
  const valColor = highlight ? 'text-white' : 'text-slate-700 dark:text-slate-100'
  const subColor = highlight
    ? (color === 'gold' ? 'text-gold-100' : 'text-film-100')
    : 'text-slate-500 dark:text-slate-400'
  return (
    <div className={`rounded-xl py-4 px-2 ${bg}`}>
      <div className={`text-3xl font-bold font-display ${valColor}`}>{value}</div>
      <div className={`text-xs uppercase tracking-wide mt-0.5 ${subColor}`}>{name}</div>
      {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
    </div>
  )
}

function StreakRow({ label, mattVal, dustinVal, mattSub, dustinSub }) {
  const mW = mattVal > 0 && mattVal >= dustinVal
  const dW = dustinVal > 0 && dustinVal > mattVal
  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-white mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg px-3 py-2 text-center border ${mW ? 'bg-gold-600 border-gold-400' : 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-500'}`}>
          <span className={`text-2xl font-bold font-display ${mW ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>{mattVal}</span>
          <span className={`text-xs ml-1 ${mW ? 'text-gold-100' : 'text-slate-500 dark:text-slate-400'}`}>{mattVal===1?'yr':'yrs'}</span>
          <div className={`text-xs ${mW ? 'text-gold-100' : 'text-slate-500 dark:text-slate-400'}`}>Hermz</div>
          {mattSub && <div className={`text-xs ${mW ? 'text-gold-100' : 'text-slate-500 dark:text-slate-400'}`}>{mattSub}</div>}
        </div>
        <div className={`rounded-lg px-3 py-2 text-center border ${dW ? 'bg-film-500 border-film-400' : 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-500'}`}>
          <span className={`text-2xl font-bold font-display ${dW ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>{dustinVal}</span>
          <span className={`text-xs ml-1 ${dW ? 'text-film-100' : 'text-slate-500 dark:text-slate-400'}`}>{dustinVal===1?'yr':'yrs'}</span>
          <div className={`text-xs ${dW ? 'text-film-100' : 'text-slate-500 dark:text-slate-400'}`}>Dust</div>
          {dustinSub && <div className={`text-xs ${dW ? 'text-film-100' : 'text-slate-500 dark:text-slate-400'}`}>{dustinSub}</div>}
        </div>
      </div>
    </div>
  )
}

function PeakRow({ label, year, value, total, isWorst }) {
  return (
    <Link to={`/oscars/${year}`}
      className="flex items-center justify-between rounded-lg px-3 py-2 mb-2 bg-stone-100 dark:bg-night-700/30 hover:bg-stone-200 dark:hover:bg-night-700 transition-colors group">
      <span className="text-xs text-gray-400 dark:text-gray-200">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-bold ${isWorst ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{value}</span>
        <span className="text-xs text-gray-400 dark:text-gray-200 ml-1">/ {total}</span>
        <span className="text-xs text-gray-400 dark:text-gray-200 ml-2 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">{year}</span>
      </div>
    </Link>
  )
}

// ── CategoryRow — single category line with optional drilldown ────────────────
function CategoryRow({ cat, view, expanded, onToggle }) {
  const { mattPct: h, dustinPct: d } = cat
  const hLeads = h > d, dLeads = d > h
  const edgeLabel = h > d ? 'Hermz' : d > h ? 'Dust' : 'Tied'
  const edgeColor = hLeads ? HC : dLeads ? DC : '#9ca3af'

  // isNew badge suppressed for Casting — it lives in Craft now, not the old "New" group
  const showNew      = cat.isNew && (CAT_GROUP[cat.name] !== 'Craft')
  const labelOpacity = cat.isLegacy || showNew ? 0.6 : 1
  const labelColor   = cat.isLegacy ? '#64748b' : undefined
  const suffix       = ''

  const yearRows = Object.values(cat.byYear).sort((a,b) => b.year - a.year)

  return (
    <>
      <div
        onClick={onToggle}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors
          ${expanded
            ? 'bg-stone-200/80 dark:bg-night-600/60'
            : 'hover:bg-stone-100 dark:hover:bg-night-700/50'
          }`}
        style={{ opacity: labelOpacity }}
      >
        {/* Category name */}
        <div className="w-40 flex-shrink-0 text-right">
          <span className="text-xs leading-tight" style={{ color: labelColor }}>
            {cat.name.replace('Best ', '')}{suffix}
          </span>
        </div>

        {/* Bar */}
        {view === 'accuracy'
          ? <MiniBar h={h} d={d} />
          : <SplitBar h={h} d={d} />
        }

        {/* Edge label */}
        <div className="w-14 flex-shrink-0 text-xs font-semibold text-right" style={{ color: edgeColor }}>
          {edgeLabel}
        </div>

        {/* Expand chevron */}
        <div className={`text-gray-400 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</div>
      </div>

      {/* ── Drilldown ── */}
      {expanded && (
        <div className="mx-3 mb-2 rounded-lg overflow-hidden border border-stone-200 dark:border-night-600">
          <div className="px-3 py-2 bg-stone-100 dark:bg-night-800 border-b border-stone-200 dark:border-night-600">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{cat.name} — Year by Year</span>
            <span className="text-xs text-gray-400 ml-3">
              Hermz {cat.matt.correct}/{cat.matt.total} · Dust {cat.dustin.correct}/{cat.dustin.total}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-50 dark:bg-night-900/40">
                <th className="px-3 py-1.5 text-left text-gray-400 font-medium">Year</th>
                <th className="px-3 py-1.5 text-left font-medium" style={{ color: HC }}>Hermz guess</th>
                <th className="px-3 py-1.5 text-left font-medium" style={{ color: DC }}>Dust guess</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map(row => (
                <tr key={row.year} className="border-t border-stone-100 dark:border-night-700 hover:bg-stone-50 dark:hover:bg-night-700/30">
                  <td className="px-3 py-1.5">
                    <Link to={`/oscars/${row.year}`}
                      className="text-gold-600 dark:text-gold-400 hover:underline font-medium"
                      onClick={e => e.stopPropagation()}>
                      {row.year}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">
                    {row.matt ? (
                      <span className={row.matt.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}>
                        {row.matt.correct ? '✓' : '✗'} {row.matt.guess}
                      </span>
                    ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    {row.dustin ? (
                      <span className={row.dustin.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}>
                        {row.dustin.correct ? '✓' : '✗'} {row.dustin.guess}
                      </span>
                    ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
