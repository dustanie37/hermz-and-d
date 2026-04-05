import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── helpers ──────────────────────────────────────────────────────────────────

function parseInterval(str) {
  if (!str) return null
  const parts = str.split(':')
  if (parts.length < 2) return null
  return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10), s: parseInt(parts[2] || 0, 10) }
}

function fmtRuntime(str) {
  const t = parseInterval(str)
  if (!t) return '—'
  return `${t.h}h ${t.m}m`
}

function fmtMonologue(str) {
  const t = parseInterval(str)
  if (!t) return '—'
  if (t.h > 0) return `${t.h}h ${t.m}m ${t.s}s`
  return `${t.m}m ${t.s}s`
}

function runtimeDiff(actual, guess) {
  const a = parseInterval(actual)
  const g = parseInterval(guess)
  if (!a || !g) return null
  const diff = Math.abs((a.h * 60 + a.m) - (g.h * 60 + g.m))
  return diff === 0 ? 'exact' : `off by ${diff}m`
}

function shortCeremony(name) {
  if (!name) return ''
  return name.replace(/^The\s+/i, '').split(' - ')[0]
}

function formatDate(name) {
  if (!name) return ''
  const parts = name.split(' - ')
  return parts[1] || ''
}

const YEARS = Array.from({ length: 19 }, (_, i) => 2008 + i)

// ── main component ────────────────────────────────────────────────────────────

export default function OscarsYear() {
  const { year } = useParams()
  const navigate = useNavigate()
  const yearNum  = parseInt(year, 10)

  const [yearData,   setYearData]   = useState(null)
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    if (!yearNum || yearNum < 2008 || yearNum > 2026) {
      navigate('/oscars')
      return
    }
    fetchData(yearNum)
  }, [yearNum])

  async function fetchData(yr) {
    setLoading(true)
    setError(null)
    try {
      // 1 — year row
      const { data: yrRow, error: yrErr } = await supabase
        .from('oscar_years')
        .select('*')
        .eq('year', yr)
        .single()
      if (yrErr) throw yrErr

      // 2 — guesses with category + profile
      const { data: guesses, error: gErr } = await supabase
        .from('oscar_guesses')
        .select('*, oscar_categories(*), profiles(username, display_name)')
        .eq('year_id', yrRow.id)
      if (gErr) throw gErr

      // 3 — nominees with category
      const { data: nominees, error: nErr } = await supabase
        .from('oscar_nominees')
        .select('*, oscar_categories(*)')
        .eq('year_id', yrRow.id)
        .order('display_order')
      if (nErr) throw nErr

      // Build per-category map
      const catMap = {}

      for (const g of guesses) {
        const cid = g.category_id
        if (!catMap[cid]) {
          catMap[cid] = {
            category: g.oscar_categories,
            nominees: [],
            guesses:  {},
            winner:   null,
          }
        }
        catMap[cid].guesses[g.profiles.username] = {
          guess:      g.guess,
          is_correct: g.is_correct,
        }
      }

      for (const n of nominees) {
        const cid = n.category_id
        if (!catMap[cid]) {
          catMap[cid] = {
            category: n.oscar_categories,
            nominees: [],
            guesses:  {},
            winner:   null,
          }
        }
        catMap[cid].nominees.push({
          name:     n.nominee_name,
          is_winner: n.is_winner,
          order:    n.display_order,
        })
        if (n.is_winner) catMap[cid].winner = n.nominee_name
      }

      // Fallback: infer winner from correct guesses
      for (const cat of Object.values(catMap)) {
        if (!cat.winner) {
          const correct = cat.guesses.matt?.is_correct  ? cat.guesses.matt.guess
                        : cat.guesses.dustin?.is_correct ? cat.guesses.dustin.guess
                        : null
          cat.winner = correct
        }
      }

      const sorted = Object.values(catMap).sort(
        (a, b) => a.category.display_order - b.category.display_order
      )

      setYearData(yrRow)
      setCategories(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const prevYear = yearNum > 2008 ? yearNum - 1 : null
  const nextYear = yearNum < 2026 ? yearNum + 1 : null

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="text-gray-500 animate-pulse">Loading ceremony…</span>
    </div>
  )

  if (error) return (
    <div className="py-20 text-center text-red-400">Error: {error}</div>
  )

  if (!yearData) return null

  const mattTotal   = categories.filter(c => c.guesses.matt?.is_correct).length
  const dustinTotal = categories.filter(c => c.guesses.dustin?.is_correct).length
  const mattWon     = yearData.winner === 'matt'
  const dustinWon   = yearData.winner === 'dustin'
  const tb          = yearData.tiebreaker_used

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* ── Breadcrumb + Year nav ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/oscars" className="text-gray-500 hover:text-gold-400 transition-colors">
            🏆 Oscars
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-white font-medium">{yearNum}</span>
        </div>
        <div className="flex items-center gap-2">
          {prevYear && (
            <Link to={`/oscars/${prevYear}`}
              className="btn-ghost text-xs px-3 py-1.5">
              ← {prevYear}
            </Link>
          )}
          <YearDropdown current={yearNum} />
          {nextYear && (
            <Link to={`/oscars/${nextYear}`}
              className="btn-ghost text-xs px-3 py-1.5">
              {nextYear} →
            </Link>
          )}
        </div>
      </div>

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="page-title">{shortCeremony(yearData.ceremony_name)}</h1>
        <p className="text-gray-500 text-sm mt-1">{formatDate(yearData.ceremony_name)}</p>
      </div>

      {/* ── Score banner ── */}
      <ScoreBanner
        mattTotal={mattTotal}
        dustinTotal={dustinTotal}
        total={categories.length}
        mattWon={mattWon}
        dustinWon={dustinWon}
        tiebreaker={tb}
      />

      {/* ── Tiebreaker detail ── */}
      {tb && (
        <TiebreakerPanel yearData={yearData} mattWon={mattWon} />
      )}

      {/* ── Category table ── */}
      <div className="card p-0 overflow-hidden mt-6">
        <table className="w-full">
          <thead>
            <tr className="bg-night-900/70">
              <th className="table-header w-48">Category</th>
              <th className="table-header">Nominees</th>
              <th className="table-header text-gold-500/80 w-44">
                Hermz
              </th>
              <th className="table-header text-film-400/80 w-44">
                Dust
              </th>
              <th className="table-header w-44">Winner</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, idx) => (
              <CategoryRow key={cat.category.id} cat={cat} idx={idx} year={yearNum} yearNum={yearNum} />
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

// ── ScoreBanner ───────────────────────────────────────────────────────────────

function ScoreBanner({ mattTotal, dustinTotal, total, mattWon, dustinWon, tiebreaker }) {
  return (
    <div className="card flex items-center gap-4 flex-wrap mb-4">

      {/* Matt */}
      <div className={`flex-1 min-w-[120px] text-center rounded-xl py-4 px-3
        ${mattWon ? 'bg-gold-900/40 border border-gold-700/30' : 'bg-night-700/40'}`}>
        <div className={`text-4xl font-bold font-display ${mattWon ? 'text-gold-300' : 'text-white'}`}>
          {mattTotal}
        </div>
        <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Hermz</div>
        {mattWon && (
          <div className="mt-2">
            <span className="badge-gold">
              {tiebreaker ? '🏆 Won (tiebreaker)' : '🏆 Winner'}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="text-center flex flex-col gap-1 px-2">
        <span className="text-gray-600 font-display text-2xl">–</span>
        <span className="text-gray-600 text-xs">of {total}</span>
      </div>

      {/* Dustin */}
      <div className={`flex-1 min-w-[120px] text-center rounded-xl py-4 px-3
        ${dustinWon ? 'bg-gold-900/40 border border-gold-700/30' : 'bg-night-700/40'}`}>
        <div className={`text-4xl font-bold font-display ${dustinWon ? 'text-gold-300' : 'text-white'}`}>
          {dustinTotal}
        </div>
        <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Dust</div>
        {dustinWon && (
          <div className="mt-2">
            <span className="badge-gold">
              {tiebreaker ? '🏆 Won (tiebreaker)' : '🏆 Winner'}
            </span>
          </div>
        )}
      </div>

    </div>
  )
}

// ── TiebreakerPanel ───────────────────────────────────────────────────────────

function TiebreakerPanel({ yearData, mattWon }) {
  const dustinWon = !mattWon
  const mattDiff   = runtimeDiff(yearData.actual_runtime, yearData.matt_runtime_guess)
  const dustinDiff = runtimeDiff(yearData.actual_runtime, yearData.dustin_runtime_guess)

  const hasMonologue = yearData.actual_monologue

  return (
    <div className="border border-amber-700/40 bg-amber-900/10 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="badge-tiebreaker">Tiebreaker</span>
        <span className="text-amber-300 text-sm font-medium">Tied score — decided by runtime guess</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        {/* Matt */}
        <div className={`rounded-lg p-3 ${mattWon ? 'bg-amber-900/40' : 'bg-night-700/40'}`}>
          <div className="text-xs text-gray-500 mb-1">Hermz guessed</div>
          <div className={`font-bold ${mattWon ? 'text-amber-300' : 'text-gray-300'}`}>
            {fmtRuntime(yearData.matt_runtime_guess)}
          </div>
          {mattDiff && <div className="text-xs text-gray-500 mt-1">{mattDiff}</div>}
          {mattWon && <div className="text-xs text-amber-400 mt-1 font-medium">✓ closer</div>}
        </div>

        {/* Actual */}
        <div className="rounded-lg p-3 bg-night-800">
          <div className="text-xs text-gray-500 mb-1">Actual runtime</div>
          <div className="font-bold text-white">{fmtRuntime(yearData.actual_runtime)}</div>
        </div>

        {/* Dustin */}
        <div className={`rounded-lg p-3 ${dustinWon ? 'bg-amber-900/40' : 'bg-night-700/40'}`}>
          <div className="text-xs text-gray-500 mb-1">Dust guessed</div>
          <div className={`font-bold ${dustinWon ? 'text-amber-300' : 'text-gray-300'}`}>
            {fmtRuntime(yearData.dustin_runtime_guess)}
          </div>
          {dustinDiff && <div className="text-xs text-gray-500 mt-1">{dustinDiff}</div>}
          {dustinWon && <div className="text-xs text-amber-400 mt-1 font-medium">✓ closer</div>}
        </div>
      </div>

      {/* Monologue tiebreaker (2026+) */}
      {hasMonologue && (
        <div className="mt-3 pt-3 border-t border-amber-700/20">
          <p className="text-xs text-gray-500 mb-2">Opening monologue backup tiebreaker (not needed)</p>
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-500">
            <div>Hermz: {fmtMonologue(yearData.matt_monologue_guess)}</div>
            <div>Actual: {fmtMonologue(yearData.actual_monologue)}</div>
            <div>Dust: {fmtMonologue(yearData.dustin_monologue_guess)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CategoryRow ───────────────────────────────────────────────────────────────

function CategoryRow({ cat, idx, yearNum }) {
  const { category, nominees, guesses, winner } = cat
  const mattG   = guesses.matt   || {}
  const dustinG = guesses.dustin || {}

  // Show NEW badge only in the category's first tracked year (and only if after 2008)
  const isNew     = category.active_from && category.active_from > 2008 && category.active_from === yearNum
  // Show FINAL YEAR badge only in the last year the category was active
  const isRetired = category.active_until !== null && category.active_until !== undefined && category.active_until === yearNum

  const rowBg = idx % 2 === 0 ? 'bg-night-800' : 'bg-night-800/50'

  return (
    <tr className={`${rowBg} table-row-hover`}>

      {/* Category */}
      <td className="table-cell align-top">
        <div className="font-medium text-gray-200 leading-snug">{category.name}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {isNew && (
            <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded text-[10px]">
              NEW
            </span>
          )}
          {isRetired && (
            <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded text-[10px]">
              FINAL YEAR
            </span>
          )}
        </div>
      </td>

      {/* Nominees */}
      <td className="table-cell align-top">
        {nominees.length > 0 ? (
          <ul className="space-y-0.5">
            {nominees.map((n, i) => (
              <li key={i}
                className={`text-xs leading-relaxed ${
                  n.is_winner
                    ? 'text-gold-300 font-semibold'
                    : 'text-gray-500'
                }`}>
                {n.is_winner && <span className="mr-1">★</span>}
                {n.name}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>

      {/* Matt's guess */}
      <td className="table-cell align-top">
        <GuessCell guess={mattG.guess} isCorrect={mattG.is_correct} />
      </td>

      {/* Dustin's guess */}
      <td className="table-cell align-top">
        <GuessCell guess={dustinG.guess} isCorrect={dustinG.is_correct} />
      </td>

      {/* Winner */}
      <td className="table-cell align-top">
        {winner
          ? <span className="text-gold-300 text-sm font-medium">{winner}</span>
          : <span className="text-gray-600 text-xs">—</span>
        }
      </td>

    </tr>
  )
}

// ── GuessCell ─────────────────────────────────────────────────────────────────

function GuessCell({ guess, isCorrect }) {
  if (!guess) return <span className="text-gray-600 text-xs">—</span>
  return (
    <div className="flex items-start gap-1.5">
      <span className={`mt-0.5 flex-shrink-0 text-xs font-bold ${isCorrect ? 'text-emerald-400' : 'text-red-500'}`}>
        {isCorrect ? '✓' : '✗'}
      </span>
      <span className={`text-sm leading-snug ${isCorrect ? 'text-gray-200' : 'text-gray-400'}`}>
        {guess}
      </span>
    </div>
  )
}

// ── YearDropdown ──────────────────────────────────────────────────────────────

function YearDropdown({ current }) {
  const navigate = useNavigate()
  return (
    <select
      value={current}
      onChange={e => navigate(`/oscars/${e.target.value}`)}
      className="select text-xs px-2 py-1.5"
    >
      {[...YEARS].reverse().map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  )
}
