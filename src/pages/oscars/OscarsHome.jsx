import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import OscarIcon from '../../components/OscarIcon'

// ── helpers ──────────────────────────────────────────────────────────────────

function shortCeremony(name) {
  if (!name) return ''
  return name.replace(/^The\s+/i, '').split(' - ')[0]
}

function formatDate(name) {
  if (!name) return ''
  const parts = name.split(' - ')
  return parts[1] || ''
}

// ── component ─────────────────────────────────────────────────────────────────

export default function OscarsHome() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchSummary() }, [])

  async function fetchSummary() {
    const { data, error } = await supabase
      .from('v_oscar_year_summary')
      .select('*')
      .order('year', { ascending: false })
    if (error) setError(error.message)
    else setYears(data || [])
    setLoading(false)
  }

  async function handleDelete(year) {
    if (!window.confirm(`Delete the ${year} ceremony and all its data? This cannot be undone.`)) return
    setDeleting(true)
    try {
      // Get year id
      const { data: yrRow } = await supabase.from('oscar_years').select('id').eq('year', year).single()
      if (yrRow) {
        await supabase.from('oscar_guesses').delete().eq('year_id', yrRow.id)
        await supabase.from('oscar_nominees').delete().eq('year_id', yrRow.id)
        await supabase.from('oscar_years').delete().eq('id', yrRow.id)
      }
      await fetchSummary()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  async function handleMarkComplete(year) {
    await supabase.from('oscar_years').update({ status: 'complete' }).eq('year', year)
    await fetchSummary()
  }

  // ── split upcoming vs complete ──
  const upcoming = years.filter(y => y.status === 'upcoming')
  const complete = years.filter(y => y.status !== 'upcoming')

  // ── all-time stats (complete only) ──
  const mattWins    = complete.filter(y => y.winner === 'matt').length
  const dustinWins  = complete.filter(y => y.winner === 'dustin').length
  const tieYears    = complete.filter(y => y.tiebreaker_used).length
  const mattTotal   = complete.reduce((s, y) => s + (y.matt_correct   || 0), 0)
  const dustinTotal = complete.reduce((s, y) => s + (y.dustin_correct || 0), 0)

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="text-gray-500 animate-pulse">Loading ceremonies…</span>
    </div>
  )

  if (error) return (
    <div className="py-20 text-center text-red-400">Error: {error}</div>
  )

  const oldestYear = complete[complete.length - 1]?.year
  const newestYear = complete[0]?.year

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
            {complete.length} ceremonies · {oldestYear}–{newestYear}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start mt-1">
          <Link to="/oscars/stats" className="btn-ghost flex items-center gap-2 text-sm">
            📊 All-Time Stats
          </Link>
          {isAuthenticated && (
            <Link to="/oscars/new" className="btn-ghost flex items-center gap-2 text-sm border-gold-400/40 hover:border-gold-500 dark:border-gold-700/40 dark:hover:border-gold-600">
              ＋ New Year
            </Link>
          )}
        </div>
      </div>

      {/* ── Upcoming Ceremony ── */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Upcoming Ceremony
            </h2>
            <div className="flex-1 border-t border-stone-200 dark:border-night-700" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map(y => (
              <UpcomingCard
                key={y.year}
                year={y}
                isAuthenticated={isAuthenticated}
                deleting={deleting}
                onDelete={() => handleDelete(y.year)}
                onMarkComplete={() => handleMarkComplete(y.year)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── All-time scoreboard ── */}
      <div className="card mb-8">
        <p className="stat-label mb-4">All-Time Record</p>
        <div className="grid grid-cols-3 gap-4 text-center">

          {/* Matt */}
          <div className={`rounded-xl p-4 border ${mattWins > dustinWins
            ? 'bg-gold-600 border-gold-400'
            : 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-500'}`}>
            <div className={`text-3xl font-bold mb-0.5 ${mattWins > dustinWins ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>{mattWins}</div>
            <div className={`text-xs uppercase tracking-wide ${mattWins > dustinWins ? 'text-gold-100' : 'text-slate-500 dark:text-slate-400'}`}>Hermz Wins</div>
            <div className={`text-xs mt-1 ${mattWins > dustinWins ? 'text-gold-100' : 'text-slate-500 dark:text-slate-400'}`}>{mattTotal} correct all-time</div>
          </div>

          {/* vs */}
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-gray-400 dark:text-gray-600 font-display text-lg">vs</span>
            {tieYears > 0 && (
              <span className="badge-tiebreaker">{tieYears} tiebreakers</span>
            )}
          </div>

          {/* Dustin */}
          <div className={`rounded-xl p-4 border ${dustinWins > mattWins
            ? 'bg-film-500 border-film-400'
            : 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-500'}`}>
            <div className={`text-3xl font-bold mb-0.5 ${dustinWins > mattWins ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>{dustinWins}</div>
            <div className={`text-xs uppercase tracking-wide ${dustinWins > mattWins ? 'text-film-100' : 'text-slate-500 dark:text-slate-400'}`}>Dust Wins</div>
            <div className={`text-xs mt-1 ${dustinWins > mattWins ? 'text-film-100' : 'text-slate-500 dark:text-slate-400'}`}>{dustinTotal} correct all-time</div>
          </div>

        </div>
      </div>

      {/* ── Year grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {complete.map(y => (
          <YearCard key={y.year} year={y} />
        ))}
      </div>

    </div>
  )
}

// ── UpcomingCard ──────────────────────────────────────────────────────────────

function UpcomingCard({ year: y, isAuthenticated, deleting, onDelete, onMarkComplete }) {
  return (
    <div className="card border-2 border-dashed border-gold-300 dark:border-gold-700/50 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-gold-600 dark:text-gold-400 font-display text-2xl font-bold">
            {y.year}
          </span>
          <p className="text-gray-600 dark:text-gray-300 text-xs mt-0.5">{shortCeremony(y.ceremony_name)}</p>
          {formatDate(y.ceremony_name) && (
            <p className="text-gray-400 text-xs mt-0.5">{formatDate(y.ceremony_name)}</p>
          )}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold-100 text-gold-700 border border-gold-300
                         dark:bg-gold-900/30 dark:text-gold-400 dark:border-gold-700/40">
          Upcoming
        </span>
      </div>

      <Link
        to={`/oscars/${y.year}`}
        className="btn-ghost text-xs text-center py-1.5"
      >
        View / Edit Nominees & Guesses →
      </Link>

      {isAuthenticated && (
        <div className="flex gap-2 pt-1 border-t border-stone-100 dark:border-night-700">
          <button
            onClick={onMarkComplete}
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-100 border border-emerald-400 text-emerald-700 font-medium
                       hover:bg-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700/40 dark:text-emerald-300 transition-colors"
          >
            ✓ Mark Complete
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 border border-red-300 text-red-600 font-medium
                       hover:bg-red-100 dark:bg-red-900/20 dark:border-red-700/40 dark:text-red-400 transition-colors disabled:opacity-50"
          >
            🗑 Delete
          </button>
        </div>
      )}
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
            <p className="text-gray-600 dark:text-white text-xs mt-0.5">{shortCeremony(y.ceremony_name)}</p>
          </div>
          {isTie && <span className="badge-tiebreaker mt-1">Tiebreaker</span>}
        </div>

        {/* Scores */}
        <div className="flex items-center gap-3 mt-auto">

          {/* Matt */}
          <div className={`flex-1 text-center rounded-lg py-2 px-1 border ${mattWon
            ? 'bg-gold-600 border-gold-400'
            : 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-500'}`}>
            <div className={`text-xl font-bold ${mattWon ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>
              {mattScore}
            </div>
            <div className={`text-xs ${mattWon ? 'text-gold-100' : 'text-slate-500 dark:text-slate-400'}`}>Hermz</div>
          </div>

          <div className="text-gray-400 text-xs font-medium">
            / {total}
          </div>

          {/* Dustin */}
          <div className={`flex-1 text-center rounded-lg py-2 px-1 border ${dustinWon
            ? 'bg-film-500 border-film-400'
            : 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-500'}`}>
            <div className={`text-xl font-bold ${dustinWon ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>
              {dustinScore}
            </div>
            <div className={`text-xs ${dustinWon ? 'text-film-100' : 'text-slate-500 dark:text-slate-400'}`}>Dust</div>
          </div>

        </div>

        {/* Date */}
        <p className="text-gray-600 dark:text-white text-xs mt-3 text-center">{formatDate(y.ceremony_name)}</p>

      </div>
    </Link>
  )
}
