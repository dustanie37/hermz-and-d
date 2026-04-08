import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import OscarIcon from '../../components/OscarIcon'

// ── helpers ──────────────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function shortCeremony(name) {
  // "The 80th Academy Awards - February 24, 2008" → "80th Academy Awards"
  if (!name) return ''
  return name.replace(/^The\s+/i, '').split(' - ')[0]
}

function formatDate(name) {
  // Extract date after " - "
  if (!name) return ''
  const parts = name.split(' - ')
  return parts[1] || ''
}

// ── component ─────────────────────────────────────────────────────────────────

export default function OscarsHome() {
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchSummary() {
      const { data, error } = await supabase
        .from('v_oscar_year_summary')
        .select('*')
        .order('year', { ascending: false })
      if (error) setError(error.message)
      else setYears(data || [])
      setLoading(false)
    }
    fetchSummary()
  }, [])

  // ── all-time stats ──
  const mattWins   = years.filter(y => y.winner === 'matt').length
  const dustinWins = years.filter(y => y.winner === 'dustin').length
  const tieYears   = years.filter(y => y.tiebreaker_used).length
  const mattTotal  = years.reduce((s, y) => s + (y.matt_correct  || 0), 0)
  const dustinTotal= years.reduce((s, y) => s + (y.dustin_correct|| 0), 0)

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="text-gray-500 animate-pulse">Loading ceremonies…</span>
    </div>
  )

  if (error) return (
    <div className="py-20 text-center text-red-400">Error: {error}</div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
          <OscarIcon size={36} className="text-gold-600 dark:text-gold-400" />
          Academy Awards
        </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {years.length} ceremonies · {years[years.length-1]?.year}–{years[0]?.year}
          </p>
        </div>
        <Link to="/oscars/stats"
          className="btn-ghost flex items-center gap-2 text-sm self-start mt-1">
          📊 All-Time Stats
        </Link>
      </div>

      {/* ── All-time scoreboard ── */}
      <div className="card mb-8">
        <p className="stat-label mb-4">All-Time Record</p>
        <div className="grid grid-cols-3 gap-4 text-center">

          {/* Matt */}
          <div className={`rounded-xl p-4 ${mattWins > dustinWins
            ? 'bg-gold-100 border border-gold-300 dark:bg-gold-900/30 dark:border-gold-700/40'
            : 'bg-stone-100 dark:bg-night-700/50'}`}>
            <div className={`text-3xl font-bold mb-0.5 ${mattWins > dustinWins ? 'text-gold-700 dark:text-gold-300' : 'text-gray-700 dark:text-white'}`}>{mattWins}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Hermz Wins</div>
            <div className="text-xs text-gray-500 mt-1">{mattTotal} correct all-time</div>
          </div>

          {/* vs */}
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-gray-400 dark:text-gray-600 font-display text-lg">vs</span>
            {tieYears > 0 && (
              <span className="badge-tiebreaker">{tieYears} tiebreakers</span>
            )}
          </div>

          {/* Dustin */}
          <div className={`rounded-xl p-4 ${dustinWins > mattWins
            ? 'bg-gold-100 border border-gold-300 dark:bg-gold-900/30 dark:border-gold-700/40'
            : 'bg-stone-100 dark:bg-night-700/50'}`}>
            <div className={`text-3xl font-bold mb-0.5 ${dustinWins > mattWins ? 'text-gold-700 dark:text-gold-300' : 'text-gray-700 dark:text-white'}`}>{dustinWins}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Dust Wins</div>
            <div className="text-xs text-gray-500 mt-1">{dustinTotal} correct all-time</div>
          </div>

        </div>
      </div>

      {/* ── Year grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {years.map(y => (
          <YearCard key={y.year} year={y} />
        ))}
      </div>

    </div>
  )
}

// ── YearCard ──────────────────────────────────────────────────────────────────

function YearCard({ year: y }) {
  const mattScore   = y.matt_correct   || 0
  const dustinScore = y.dustin_correct || 0
  const total       = y.total_categories || 24
  const isTie       = y.tiebreaker_used
  const mattWon     = y.winner === 'matt'
  const dustinWon   = y.winner === 'dustin'

  return (
    <Link to={`/oscars/${y.year}`} className="block group">
      <div className="card-hover h-full flex flex-col">

        {/* Year + ceremony */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-gold-600 dark:text-gold-400 font-display text-2xl font-bold group-hover:text-gold-500 dark:group-hover:text-gold-300 transition-colors">
              {y.year}
            </span>
            <p className="text-gray-500 text-xs mt-0.5">{shortCeremony(y.ceremony_name)}</p>
          </div>
          {isTie && <span className="badge-tiebreaker mt-1">Tiebreaker</span>}
        </div>

        {/* Scores */}
        <div className="flex items-center gap-3 mt-auto">

          {/* Matt */}
          <div className={`flex-1 text-center rounded-lg py-2 px-1 ${mattWon
            ? 'bg-gold-100 border border-gold-300 dark:bg-gold-900/40 dark:border-transparent'
            : 'bg-stone-100 dark:bg-night-700/50'}`}>
            <div className={`text-xl font-bold ${mattWon ? 'text-gold-700 dark:text-gold-300' : 'text-gray-700 dark:text-gray-300'}`}>
              {mattScore}
              {mattWon && <OscarIcon size={16} className="inline text-gold-600 dark:text-gold-500 ml-1" />}
            </div>
            <div className="text-xs text-gray-500">Hermz</div>
          </div>

          <div className="text-gray-400 text-xs font-medium">
            / {total}
          </div>

          {/* Dustin */}
          <div className={`flex-1 text-center rounded-lg py-2 px-1 ${dustinWon
            ? 'bg-gold-100 border border-gold-300 dark:bg-gold-900/40 dark:border-transparent'
            : 'bg-stone-100 dark:bg-night-700/50'}`}>
            <div className={`text-xl font-bold ${dustinWon ? 'text-gold-700 dark:text-gold-300' : 'text-gray-700 dark:text-gray-300'}`}>
              {dustinScore}
              {dustinWon && <OscarIcon size={16} className="inline text-gold-600 dark:text-gold-500 ml-1" />}
            </div>
            <div className="text-xs text-gray-500">Dust</div>
          </div>

        </div>

        {/* Date */}
        <p className="text-gray-600 text-xs mt-3 text-center">{formatDate(y.ceremony_name)}</p>

      </div>
    </Link>
  )
}
