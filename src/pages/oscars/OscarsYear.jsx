import { useState, useEffect, Fragment } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import OscarIcon from '../../components/OscarIcon'

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
  const navigate  = useNavigate()
  const { isAuthenticated } = useAuth()
  const yearNum   = parseInt(year, 10)

  const [yearData,    setYearData]    = useState(null)
  const [categories,  setCategories]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [editMode,    setEditMode]    = useState(false)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (!yearNum || yearNum < 2008 || yearNum > 2026) {
      navigate('/oscars')
      return
    }
    fetchData(yearNum)
  }, [yearNum])

  // Exit edit mode when navigating to a different year
  useEffect(() => {
    setEditMode(false)
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
          catMap[cid] = { category: g.oscar_categories, nominees: [], guesses: {}, winner: null }
        }
        catMap[cid].guesses[g.profiles.username] = {
          id:         g.id,
          guess:      g.guess,
          is_correct: g.is_correct,
        }
      }

      for (const n of nominees) {
        const cid = n.category_id
        if (!catMap[cid]) {
          catMap[cid] = { category: n.oscar_categories, nominees: [], guesses: {}, winner: null }
        }
        catMap[cid].nominees.push({
          id:        n.id,
          name:      n.nominee_name,
          is_winner: n.is_winner,
          order:     n.display_order,
        })
        if (n.is_winner) catMap[cid].winner = n.nominee_name
      }

      // Fallback: infer winner from correct guesses
      for (const cat of Object.values(catMap)) {
        if (!cat.winner) {
          const correct = cat.guesses.matt?.is_correct   ? cat.guesses.matt.guess
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

  // ── Edit handlers ─────────────────────────────────────────────────────────

  async function toggleNomineeWinner(categoryIdx, nomineeIdx) {
    if (saving) return
    const cat     = categories[categoryIdx]
    const nominee = cat.nominees[nomineeIdx]
    const newIsWinner = !nominee.is_winner

    // Optimistic update — if setting as winner, unset all others in category
    setCategories(prev => prev.map((c, ci) => {
      if (ci !== categoryIdx) return c
      return {
        ...c,
        nominees: c.nominees.map((n, ni) => ({
          ...n,
          is_winner: newIsWinner ? ni === nomineeIdx : false,
        })),
        winner: newIsWinner ? nominee.name : null,
      }
    }))

    setSaving(true)
    try {
      // Clear all winners in this category first
      const { error: clearErr } = await supabase
        .from('oscar_nominees')
        .update({ is_winner: false })
        .eq('year_id', yearData.id)
        .eq('category_id', cat.category.id)
      if (clearErr) throw clearErr

      // Set the new winner
      if (newIsWinner) {
        const { error: setErr } = await supabase
          .from('oscar_nominees')
          .update({ is_winner: true })
          .eq('id', nominee.id)
        if (setErr) throw setErr
      }
    } catch (err) {
      console.error('Failed to update nominee winner:', err)
      // Revert optimistic update by refetching
      fetchData(yearNum)
    } finally {
      setSaving(false)
    }
  }

  async function toggleGuessCorrect(categoryIdx, username) {
    if (saving) return
    const cat     = categories[categoryIdx]
    const guess   = cat.guesses[username]
    if (!guess?.id) return
    const newIsCorrect = !guess.is_correct

    // Optimistic update
    setCategories(prev => prev.map((c, ci) => {
      if (ci !== categoryIdx) return c
      return {
        ...c,
        guesses: {
          ...c.guesses,
          [username]: { ...c.guesses[username], is_correct: newIsCorrect },
        },
      }
    }))

    setSaving(true)
    try {
      const { error: updErr } = await supabase
        .from('oscar_guesses')
        .update({ is_correct: newIsCorrect })
        .eq('id', guess.id)
      if (updErr) throw updErr
    } catch (err) {
      console.error('Failed to update guess:', err)
      fetchData(yearNum)
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const prevYear = yearNum > 2008 ? yearNum - 1 : null
  const nextYear = yearNum < 2026 ? yearNum + 1 : null

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="text-gray-400 animate-pulse">Loading ceremony…</span>
    </div>
  )

  if (error) return (
    <div className="py-20 text-center text-red-500 dark:text-red-400">Error: {error}</div>
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
          <Link to="/oscars" className="text-gray-400 hover:text-gold-600 transition-colors dark:text-gray-500 dark:hover:text-gold-400 flex items-center gap-1">
            <OscarIcon size={14} /> Oscars
          </Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-gray-800 font-medium dark:text-white">{yearNum}</span>
        </div>
        <div className="flex items-center gap-2">
          {prevYear && (
            <Link to={`/oscars/${prevYear}`} className="btn-ghost text-xs px-3 py-1.5">
              ← {prevYear}
            </Link>
          )}
          <YearDropdown current={yearNum} />
          {nextYear && (
            <Link to={`/oscars/${nextYear}`} className="btn-ghost text-xs px-3 py-1.5">
              {nextYear} →
            </Link>
          )}
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">{shortCeremony(yearData.ceremony_name)}</h1>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-500">{formatDate(yearData.ceremony_name)}</p>
        </div>

        {/* Edit toggle — authenticated only */}
        {isAuthenticated && (
          <button
            onClick={() => setEditMode(m => !m)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors self-start mt-1 ${
              editMode
                ? 'bg-amber-100 border-amber-400 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:border-amber-600/60 dark:text-amber-300 dark:hover:bg-amber-900/60'
                : 'btn-ghost'
            }`}
          >
            {editMode ? (saving ? '⏳ Saving…' : '✓ Done Editing') : '✏️ Edit Results'}
          </button>
        )}
      </div>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-700
                        dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-300 text-sm flex items-center gap-2">
          <span className="font-semibold">Edit mode active.</span>
          <span className="text-amber-600 dark:text-amber-400">
            Click a nominee to toggle winner · Click ✓ or ✗ to flip a guess result.
          </span>
        </div>
      )}

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
      <div className={`card p-0 overflow-hidden mt-6 ${editMode ? 'ring-2 ring-amber-300/60 dark:ring-amber-700/40' : ''}`}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Nominees</th>
              <th className="table-header text-gold-600/80 w-44 dark:text-gold-500/80">Hermz</th>
              <th className="table-header text-film-600/80 w-44 dark:text-film-400/80">Dust</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, idx) => (
              <CategoryBlock
                key={cat.category.id}
                cat={cat}
                idx={idx}
                yearNum={yearNum}
                editMode={editMode}
                onToggleNominee={nomineeIdx => toggleNomineeWinner(idx, nomineeIdx)}
                onToggleMatt={() => toggleGuessCorrect(idx, 'matt')}
                onToggleDustin={() => toggleGuessCorrect(idx, 'dustin')}
              />
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
        ${mattWon
          ? 'bg-gold-100 border border-gold-300 dark:bg-gold-900/40 dark:border-gold-700/30'
          : 'bg-stone-100 dark:bg-night-700/40'
        }`}>
        <div className={`text-4xl font-bold font-display
          ${mattWon ? 'text-gold-700 dark:text-gold-300' : 'text-gray-800 dark:text-white'}`}>
          {mattTotal}
        </div>
        <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Hermz</div>
        {mattWon && (
          <div className="mt-2">
            <span className="badge-gold flex items-center gap-1">
              <OscarIcon size={12} />
              {tiebreaker ? 'Won (tiebreaker)' : 'Winner'}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="text-center flex flex-col gap-1 px-2">
        <span className="text-gray-400 font-display text-2xl dark:text-gray-600">–</span>
        <span className="text-gray-500 text-xs dark:text-gray-600">of {total}</span>
      </div>

      {/* Dustin */}
      <div className={`flex-1 min-w-[120px] text-center rounded-xl py-4 px-3
        ${dustinWon
          ? 'bg-gold-100 border border-gold-300 dark:bg-gold-900/40 dark:border-gold-700/30'
          : 'bg-stone-100 dark:bg-night-700/40'
        }`}>
        <div className={`text-4xl font-bold font-display
          ${dustinWon ? 'text-gold-700 dark:text-gold-300' : 'text-gray-800 dark:text-white'}`}>
          {dustinTotal}
        </div>
        <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Dust</div>
        {dustinWon && (
          <div className="mt-2">
            <span className="badge-gold flex items-center gap-1">
              <OscarIcon size={12} />
              {tiebreaker ? 'Won (tiebreaker)' : 'Winner'}
            </span>
          </div>
        )}
      </div>

    </div>
  )
}

// ── TiebreakerPanel ───────────────────────────────────────────────────────────

function TiebreakerPanel({ yearData, mattWon }) {
  const dustinWon  = !mattWon
  const mattDiff   = runtimeDiff(yearData.actual_runtime, yearData.matt_runtime_guess)
  const dustinDiff = runtimeDiff(yearData.actual_runtime, yearData.dustin_runtime_guess)
  const hasMonologue = yearData.actual_monologue

  return (
    <div className="border border-amber-300 bg-amber-100/80 rounded-xl p-4 mb-4
                    dark:border-amber-700/40 dark:bg-amber-900/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="badge-tiebreaker">Tiebreaker</span>
        <span className="text-amber-700 text-sm font-medium dark:text-amber-300">
          Tied score — decided by runtime guess
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        {/* Matt */}
        <div className={`rounded-lg p-3 ${mattWon
          ? 'bg-amber-100 dark:bg-amber-900/40'
          : 'bg-stone-100 dark:bg-night-700/40'}`}>
          <div className="text-xs text-gray-400 mb-1">Hermz guessed</div>
          <div className={`font-bold ${mattWon
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-gray-600 dark:text-gray-300'}`}>
            {fmtRuntime(yearData.matt_runtime_guess)}
          </div>
          {mattDiff && <div className="text-xs text-gray-400 mt-1">{mattDiff}</div>}
          {mattWon && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">✓ closer</div>}
        </div>

        {/* Actual */}
        <div className="rounded-lg p-3 bg-stone-100 dark:bg-night-800">
          <div className="text-xs text-gray-400 mb-1">Actual runtime</div>
          <div className="font-bold text-gray-800 dark:text-white">{fmtRuntime(yearData.actual_runtime)}</div>
        </div>

        {/* Dustin */}
        <div className={`rounded-lg p-3 ${dustinWon
          ? 'bg-amber-100 dark:bg-amber-900/40'
          : 'bg-stone-100 dark:bg-night-700/40'}`}>
          <div className="text-xs text-gray-400 mb-1">Dust guessed</div>
          <div className={`font-bold ${dustinWon
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-gray-600 dark:text-gray-300'}`}>
            {fmtRuntime(yearData.dustin_runtime_guess)}
          </div>
          {dustinDiff && <div className="text-xs text-gray-400 mt-1">{dustinDiff}</div>}
          {dustinWon && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">✓ closer</div>}
        </div>
      </div>

      {/* Monologue tiebreaker (2026+) */}
      {hasMonologue && (
        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700/20">
          <p className="text-xs text-gray-400 mb-2">Opening monologue backup tiebreaker (not needed)</p>
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-400">
            <div>Hermz: {fmtMonologue(yearData.matt_monologue_guess)}</div>
            <div>Actual: {fmtMonologue(yearData.actual_monologue)}</div>
            <div>Dust: {fmtMonologue(yearData.dustin_monologue_guess)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CategoryBlock — two rows per category ─────────────────────────────────────

function CategoryBlock({ cat, idx, yearNum, editMode, onToggleNominee, onToggleMatt, onToggleDustin }) {
  const { category, nominees, guesses } = cat
  const mattG   = guesses.matt   || {}
  const dustinG = guesses.dustin || {}

  const isNew     = category.active_from && category.active_from > 2008 && category.active_from === yearNum
  const isRetired = category.active_until !== null && category.active_until !== undefined && category.active_until === yearNum

  // Alternating light/dark stripe on the data row
  const stripe = idx % 2 === 0
    ? 'bg-white dark:bg-night-800'
    : 'bg-stone-50/70 dark:bg-night-800/50'

  return (
    <Fragment>
      {/* ── Category header row ── */}
      <tr className="table-category-header">
        <td colSpan={3} className="px-4 py-2 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-gray-700 dark:text-gray-200 tracking-wide">
              {category.name}
            </span>
            {isNew && (
              <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300
                               dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700/40
                               px-1.5 py-0.5 rounded text-[10px] font-semibold">
                NEW
              </span>
            )}
            {isRetired && (
              <span className="text-xs bg-stone-100 text-gray-500 border border-stone-300
                               dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700
                               px-1.5 py-0.5 rounded text-[10px] font-semibold">
                FINAL YEAR
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* ── Data row: nominees | hermz | dust ── */}
      <tr className={`${stripe} table-row-hover`}>

        {/* Nominees */}
        <td className="table-cell align-middle py-4 px-5">
          {nominees.length > 0 ? (
            <ul className="space-y-1.5">
              {nominees.map((n, i) => (
                editMode ? (
                  <li key={i}>
                    <button
                      onClick={() => onToggleNominee(i)}
                      className={`text-sm leading-snug text-left w-full px-2 py-1 rounded transition-colors ${
                        n.is_winner
                          ? 'text-gold-700 font-semibold dark:text-gold-300 bg-gold-50 dark:bg-gold-900/30 ring-1 ring-gold-400 dark:ring-gold-600'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-night-700 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {n.is_winner && <span className="mr-1.5">★</span>}
                      {n.name}
                    </button>
                  </li>
                ) : (
                  <li key={i}
                    className={`text-sm leading-snug ${
                      n.is_winner
                        ? 'text-gold-700 font-semibold dark:text-gold-300'
                        : 'text-gray-500 dark:text-gray-500'
                    }`}>
                    {n.is_winner && <span className="mr-1.5">★</span>}
                    {n.name}
                  </li>
                )
              ))}
            </ul>
          ) : (
            <span className="text-gray-300 text-sm dark:text-gray-600">—</span>
          )}
        </td>

        {/* Matt's guess */}
        <td className="table-cell align-middle py-4 px-5 w-44">
          <GuessCell
            guess={mattG.guess}
            isCorrect={mattG.is_correct}
            editMode={editMode}
            onToggle={onToggleMatt}
          />
        </td>

        {/* Dustin's guess */}
        <td className="table-cell align-middle py-4 px-5 w-44">
          <GuessCell
            guess={dustinG.guess}
            isCorrect={dustinG.is_correct}
            editMode={editMode}
            onToggle={onToggleDustin}
          />
        </td>

      </tr>
    </Fragment>
  )
}

// ── GuessCell ─────────────────────────────────────────────────────────────────

function GuessCell({ guess, isCorrect, editMode, onToggle }) {
  if (!guess) return <span className="text-gray-300 text-sm dark:text-gray-600">—</span>

  if (editMode) {
    return (
      <div className="flex items-start gap-2">
        <button
          onClick={onToggle}
          title="Click to toggle correct/incorrect"
          className={`mt-0.5 flex-shrink-0 text-sm font-bold w-5 h-5 rounded transition-colors flex items-center justify-center
            ${isCorrect
              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
              : 'text-red-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
        >
          {isCorrect ? '✓' : '✗'}
        </button>
        <span className={`text-sm leading-snug
          ${isCorrect
            ? 'text-gray-800 dark:text-gray-200'
            : 'text-gray-500 dark:text-gray-400'
          }`}>
          {guess}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 flex-shrink-0 text-sm font-bold
        ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
        {isCorrect ? '✓' : '✗'}
      </span>
      <span className={`text-sm leading-snug
        ${isCorrect
          ? 'text-gray-800 dark:text-gray-200'
          : 'text-gray-500 dark:text-gray-400'
        }`}>
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
