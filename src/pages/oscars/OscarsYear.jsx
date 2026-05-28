import { useState, useEffect, Fragment } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'

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

function yearHue(y) { return ((y * 17) + 11) % 360 }

// ── main component ────────────────────────────────────────────────────────────

export default function OscarsYear() {
  const { year } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const yearNum = parseInt(year, 10)

  const [yearData,    setYearData]    = useState(null)
  const [categories,  setCategories]  = useState([])
  const [allYears,    setAllYears]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [editMode,    setEditMode]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [yearEdit,    setYearEdit]    = useState({})

  useEffect(() => {
    supabase.from('oscar_years').select('year').order('year', { ascending: true })
      .then(({ data }) => setAllYears(data?.map(r => r.year) || []))
  }, [])

  useEffect(() => {
    if (!yearNum || yearNum < 1990 || yearNum > 2100) {
      navigate('/oscars')
      return
    }
    fetchData(yearNum)
  }, [yearNum])

  useEffect(() => { setEditMode(false) }, [yearNum])

  // ── data ────────────────────────────────────────────────────────────────
  async function fetchData(yr) {
    setLoading(true)
    setError(null)
    try {
      const { data: yrRow, error: yrErr } = await supabase
        .from('oscar_years').select('*').eq('year', yr).single()
      if (yrErr) throw yrErr

      const [
        { data: guesses,  error: gErr },
        { data: nominees, error: nErr },
      ] = await Promise.all([
        supabase.from('oscar_guesses')
          .select('*, oscar_categories(*), profiles(username, display_name)')
          .eq('year_id', yrRow.id),
        supabase.from('oscar_nominees')
          .select('*, oscar_categories(*)')
          .eq('year_id', yrRow.id)
          .order('display_order'),
      ])
      if (gErr) throw gErr
      if (nErr) throw nErr

      const catMap = {}
      for (const g of guesses) {
        const cid = g.category_id
        if (!catMap[cid]) catMap[cid] = { category: g.oscar_categories, nominees: [], guesses: {}, winner: null }
        catMap[cid].guesses[g.profiles.username] = { id: g.id, guess: g.guess, is_correct: g.is_correct }
      }
      for (const n of nominees) {
        const cid = n.category_id
        if (!catMap[cid]) catMap[cid] = { category: n.oscar_categories, nominees: [], guesses: {}, winner: null }
        catMap[cid].nominees.push({ id: n.id, name: n.nominee_name, is_winner: n.is_winner, order: n.display_order })
        if (n.is_winner) catMap[cid].winner = n.nominee_name
      }
      for (const cat of Object.values(catMap)) {
        if (!cat.winner) {
          const correct = cat.guesses.matt?.is_correct   ? cat.guesses.matt.guess
                        : cat.guesses.dustin?.is_correct ? cat.guesses.dustin.guess
                        : null
          cat.winner = correct
        }
      }
      const sorted = Object.values(catMap).sort((a, b) => a.category.display_order - b.category.display_order)
      setYearData(yrRow)
      setCategories(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── edit handlers (unchanged logic) ─────────────────────────────────────
  async function toggleNomineeWinner(categoryIdx, nomineeIdx) {
    if (saving) return
    const cat = categories[categoryIdx]
    const nominee = cat.nominees[nomineeIdx]
    const newIsWinner = !nominee.is_winner
    const newWinner = newIsWinner ? nominee.name : null

    setCategories(prev => prev.map((c, ci) => {
      if (ci !== categoryIdx) return c
      const updatedGuesses = {}
      for (const [user, g] of Object.entries(c.guesses)) {
        updatedGuesses[user] = { ...g, is_correct: newWinner ? g.guess === newWinner : false }
      }
      return {
        ...c,
        nominees: c.nominees.map((n, ni) => ({ ...n, is_winner: newIsWinner ? ni === nomineeIdx : false })),
        winner: newWinner,
        guesses: updatedGuesses,
      }
    }))

    setSaving(true)
    try {
      const { error: clearErr } = await supabase
        .from('oscar_nominees').update({ is_winner: false })
        .eq('year_id', yearData.id).eq('category_id', cat.category.id)
      if (clearErr) throw clearErr
      if (newIsWinner) {
        const { error: setErr } = await supabase
          .from('oscar_nominees').update({ is_winner: true }).eq('id', nominee.id)
        if (setErr) throw setErr
      }
      for (const g of Object.values(cat.guesses)) {
        if (g.id) {
          const { error: gErr } = await supabase
            .from('oscar_guesses')
            .update({ is_correct: newWinner ? g.guess === newWinner : false })
            .eq('id', g.id)
          if (gErr) throw gErr
        }
      }
    } catch (err) {
      console.error('Failed to update nominee winner:', err)
      fetchData(yearNum)
    } finally {
      setSaving(false)
    }
  }

  async function changeGuess(categoryIdx, username, newGuessName) {
    if (saving) return
    const cat = categories[categoryIdx]
    const guess = cat.guesses[username]
    if (!guess?.id) return
    const newIsCorrect = newGuessName === cat.winner

    setCategories(prev => prev.map((c, ci) => {
      if (ci !== categoryIdx) return c
      return {
        ...c,
        guesses: { ...c.guesses, [username]: { ...c.guesses[username], guess: newGuessName, is_correct: newIsCorrect } },
      }
    }))

    setSaving(true)
    try {
      const { error: updErr } = await supabase
        .from('oscar_guesses').update({ guess: newGuessName, is_correct: newIsCorrect }).eq('id', guess.id)
      if (updErr) throw updErr
    } catch (err) {
      console.error('Failed to update guess:', err)
      fetchData(yearNum)
    } finally {
      setSaving(false)
    }
  }

  async function saveYearDetails() {
    if (saving) return
    setSaving(true)
    try {
      const toRuntime = s => { if (!s) return null; const p = s.trim().split(':'); return p.length === 2 ? `${p[0]}:${p[1]}:00` : s }
      const toMono    = s => { if (!s) return null; const p = s.trim().split(':'); return p.length === 2 ? `0:${p[0]}:${p[1]}` : s }
      const patch = {}
      if ('actual_runtime'         in yearEdit) patch.actual_runtime         = toRuntime(yearEdit.actual_runtime)
      if ('matt_runtime_guess'     in yearEdit) patch.matt_runtime_guess     = toRuntime(yearEdit.matt_runtime_guess)
      if ('dustin_runtime_guess'   in yearEdit) patch.dustin_runtime_guess   = toRuntime(yearEdit.dustin_runtime_guess)
      if ('actual_monologue'       in yearEdit) patch.actual_monologue       = toMono(yearEdit.actual_monologue)
      if ('matt_monologue_guess'   in yearEdit) patch.matt_monologue_guess   = toMono(yearEdit.matt_monologue_guess)
      if ('dustin_monologue_guess' in yearEdit) patch.dustin_monologue_guess = toMono(yearEdit.dustin_monologue_guess)
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase.from('oscar_years').update(patch).eq('id', yearData.id)
        if (upErr) throw upErr
      }
      await fetchData(yearNum)
      setYearEdit({})
    } catch (err) {
      console.error('Failed to save year details:', err)
    } finally {
      setSaving(false)
    }
  }

  async function calculateWinner() {
    if (saving) return
    setSaving(true)
    try {
      const mattScore   = categories.filter(c => c.guesses.matt?.is_correct).length
      const dustinScore = categories.filter(c => c.guesses.dustin?.is_correct).length
      let winner = 'pending'
      let tiebreakerUsed = false
      if (mattScore > dustinScore) winner = 'matt'
      else if (dustinScore > mattScore) winner = 'dustin'
      else {
        tiebreakerUsed = true
        const toMins = s => { const t = parseInterval(s); return t ? t.h * 60 + t.m : null }
        const a = toMins(yearData.actual_runtime)
        const m = toMins(yearData.matt_runtime_guess)
        const d = toMins(yearData.dustin_runtime_guess)
        if (a !== null && m !== null && d !== null) {
          const md = Math.abs(a - m), dd = Math.abs(a - d)
          winner = md < dd ? 'matt' : dd < md ? 'dustin' : 'tied'
        } else winner = 'tied'
      }
      const { error: upErr } = await supabase
        .from('oscar_years').update({ winner, tiebreaker_used: tiebreakerUsed }).eq('id', yearData.id)
      if (upErr) throw upErr
      setYearData(prev => ({ ...prev, winner, tiebreaker_used: tiebreakerUsed }))
    } catch (err) {
      console.error('Failed to calculate winner:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── render ──────────────────────────────────────────────────────────────
  const sortedYears = [...allYears].sort((a, b) => a - b)
  const currIdx = sortedYears.indexOf(yearNum)
  const prevYear = currIdx > 0 ? sortedYears[currIdx - 1] : null
  const nextYear = currIdx < sortedYears.length - 1 ? sortedYears[currIdx + 1] : null

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">
        LOADING CEREMONY…
      </span>
    </div>
  )
  if (error) return <div className="py-20 text-center text-red-400">Error: {error}</div>
  if (!yearData) return null

  const mattTotal   = categories.filter(c => c.guesses.matt?.is_correct).length
  const dustinTotal = categories.filter(c => c.guesses.dustin?.is_correct).length
  const mattWon = yearData.winner === 'matt'
  const dustinWon = yearData.winner === 'dustin'
  const tb = yearData.tiebreaker_used

  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <FilmStill
        title={`Hermz and D Oscar ${yearNum}`}
        hue={yearHue(yearNum)}
        mood={mattWon ? 'warm' : 'cool'}
        className="w-full h-[300px] sm:h-[340px]"
      >
        <div className="absolute inset-0 scrim-bottom" />

        {/* Breadcrumb + year nav */}
        <div className="absolute top-6 right-6 sm:right-10 flex items-center gap-2 z-10">
          {prevYear && <Link to={`/oscars/${prevYear}`} className="pill">← {prevYear}</Link>}
          <YearDropdown current={yearNum} allYears={allYears} />
          {nextYear && <Link to={`/oscars/${nextYear}`} className="pill">{nextYear} →</Link>}
          {isAuthenticated && (
            <button
              onClick={() => setEditMode(m => !m)}
              className={editMode ? 'pill-active' : 'btn-cinema text-xs'}
            >
              {editMode ? (saving ? '⏳ Saving…' : '✓ Done') : '✏️ Edit'}
            </button>
          )}
        </div>

        {/* Headline */}
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-8 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/oscars" className="font-mono text-[11px] tracking-kicker text-gold-500
                                          hover:text-gold-400 transition-colors flex items-center gap-2">
              <OscarIcon size={12} /> OSCARS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white">{yearNum}</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white tracking-wide leading-[0.92] whitespace-nowrap">
            {shortCeremony(yearData.ceremony_name).toUpperCase()}
          </h1>
          <p className="font-serif italic text-lg sm:text-xl text-gray-400 mt-3">
            {formatDate(yearData.ceremony_name)}
          </p>
        </div>

        {/* Floating score panel */}
        <div className="hidden md:flex absolute bottom-24 right-10 z-10
                        bg-night-950/70 backdrop-blur-md border border-white/[0.12]
                        rounded-2xl px-6 py-4 gap-4 items-center shadow-still-lg">
          <HeroYearScore who="matt"   score={mattTotal}   total={categories.length} winner={mattWon} tb={tb} />
          <span className="w-px h-14 bg-white/10" />
          <HeroYearScore who="dustin" score={dustinTotal} total={categories.length} winner={dustinWon} tb={tb} />
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">

        {/* Edit-mode banner */}
        {editMode && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-cinema-500/40 bg-cinema-500/10
                          text-cinema-400 text-sm flex items-center gap-2">
            <span className="font-semibold">Edit mode active.</span>
            <span className="opacity-80">
              Click a nominee to set winner (✓/✗ updates automatically) · use dropdowns to change a guess.
            </span>
          </div>
        )}

        {/* Tiebreaker detail */}
        {tb && !editMode && <TiebreakerPanel yearData={yearData} mattWon={mattWon} />}

        {/* Edit form */}
        {editMode && (
          <YearDetailsEdit
            yearData={yearData} yearEdit={yearEdit} setYearEdit={setYearEdit}
            mattTotal={mattTotal} dustinTotal={dustinTotal}
            saving={saving} onSave={saveYearDetails} onCalculateWinner={calculateWinner}
          />
        )}

        {/* Category list */}
        <div className={`card p-0 overflow-hidden ${editMode ? 'ring-2 ring-cinema-500/40' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr>
                  <th className="table-header">Nominees</th>
                  <th className="table-header text-gold-500 w-44">Hermz</th>
                  <th className="table-header text-film-500 w-44">Dust</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, idx) => (
                  <CategoryBlock
                    key={cat.category.id}
                    cat={cat} idx={idx} yearNum={yearNum} editMode={editMode}
                    onToggleNominee={ni => toggleNomineeWinner(idx, ni)}
                    onChangeMatt={n => changeGuess(idx, 'matt', n)}
                    onChangeDustin={n => changeGuess(idx, 'dustin', n)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
function HeroYearScore({ who, score, total, winner, tb }) {
  const c = who === 'matt' ? 'text-gold-500' : 'text-film-500'
  const name = who === 'matt' ? 'HERMZ' : 'DUST'
  return (
    <div className="text-center px-2 relative">
      {winner && (
        <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 font-mono text-[8px]
                         tracking-cinema ${c} px-1.5 py-px rounded bg-night-950/80 whitespace-nowrap`}>
          ● WINNER{tb && ' · TIEBREAKER'}
        </div>
      )}
      <div className={`font-mono text-[9px] tracking-cinema ${c} mb-1.5`}>{name}</div>
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="font-display text-5xl text-white leading-none tracking-wide">{score}</span>
        <span className="font-mono text-xs text-gray-500 tracking-kicker">/{total}</span>
      </div>
    </div>
  )
}

function YearDropdown({ current, allYears }) {
  const navigate = useNavigate()
  const sorted = [...allYears].sort((a, b) => b - a)
  return (
    <select
      value={current}
      onChange={e => navigate(`/oscars/${e.target.value}`)}
      className="bg-night-950/70 border border-white/[0.12] text-white font-mono text-[11px]
                 tracking-kicker px-3 py-1.5 rounded-full cursor-pointer
                 backdrop-blur-md hover:border-gold-500/60 transition-colors"
    >
      {sorted.map(y => <option key={y} value={y} className="bg-night-900">{y}</option>)}
    </select>
  )
}

function TiebreakerPanel({ yearData, mattWon }) {
  const dustinWon = !mattWon
  const mattDiff   = runtimeDiff(yearData.actual_runtime, yearData.matt_runtime_guess)
  const dustinDiff = runtimeDiff(yearData.actual_runtime, yearData.dustin_runtime_guess)
  const hasMonologue = yearData.actual_monologue
  return (
    <div className="border border-cinema-500/40 bg-cinema-500/[0.06] rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="badge-tiebreaker">Tiebreaker</span>
        <span className="font-mono text-[10px] tracking-kicker text-cinema-400 uppercase">
          tied score — decided by runtime guess
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center text-sm">
        <TBCol who="matt"   value={fmtRuntime(yearData.matt_runtime_guess)}   diff={mattDiff}   winner={mattWon} />
        <div className="rounded-lg p-3 bg-night-700/60">
          <div className="kicker-dim mb-1">ACTUAL RUNTIME</div>
          <div className="font-display text-2xl text-white tracking-wide leading-none">{fmtRuntime(yearData.actual_runtime)}</div>
        </div>
        <TBCol who="dustin" value={fmtRuntime(yearData.dustin_runtime_guess)} diff={dustinDiff} winner={dustinWon} />
      </div>
      {hasMonologue && (
        <div className="mt-4 pt-3 border-t border-cinema-500/20">
          <p className="kicker-dim mb-2">OPENING MONOLOGUE · BACKUP TIEBREAKER (NOT NEEDED)</p>
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

function TBCol({ who, value, diff, winner }) {
  const c = who === 'matt' ? 'text-gold-400' : 'text-film-400'
  const name = who === 'matt' ? 'HERMZ GUESSED' : 'DUST GUESSED'
  return (
    <div className={`rounded-lg p-3 ${winner ? 'bg-cinema-500/10 border border-cinema-500/40' : 'bg-night-700/60'}`}>
      <div className={`kicker-dim mb-1 ${winner ? 'text-cinema-400' : ''}`}>{name}</div>
      <div className={`font-display text-2xl tracking-wide leading-none ${winner ? c : 'text-gray-400'}`}>{value}</div>
      {diff && <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1">{diff}</div>}
      {winner && <div className="font-mono text-[9px] tracking-cinema text-cinema-400 mt-1.5">✓ CLOSER</div>}
    </div>
  )
}

// ── CategoryBlock — one category, two rows: header + data ────────────────────
function CategoryBlock({ cat, idx, yearNum, editMode, onToggleNominee, onChangeMatt, onChangeDustin }) {
  const { category, nominees, guesses, winner } = cat
  const mattG = guesses.matt || {}
  const dustinG = guesses.dustin || {}
  const isNew = category.active_from && category.active_from > 2008 && category.active_from === yearNum
  const isRetired = category.active_until && category.active_until === yearNum
  const stripe = idx % 2 === 0 ? 'bg-night-800/40' : 'bg-night-900/40'

  return (
    <Fragment>
      <tr className="table-category-header">
        <td colSpan={3} className="px-4 py-2.5 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-cinema text-gold-500 uppercase">
              {category.name.replace(/^Best\s+/i, '').toUpperCase()}
            </span>
            {isNew && (
              <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/40
                               px-1.5 py-0.5 rounded font-mono tracking-cinema">NEW</span>
            )}
            {isRetired && (
              <span className="text-[9px] bg-gray-700 text-gray-400 border border-gray-600
                               px-1.5 py-0.5 rounded font-mono tracking-cinema">FINAL YEAR</span>
            )}
          </div>
        </td>
      </tr>
      <tr className={`${stripe} table-row-hover`}>
        <td className="table-cell align-top py-4 px-5">
          {nominees.length > 0 ? (
            <ul className="space-y-1">
              {nominees.map((n, i) => (
                editMode ? (
                  <li key={i}>
                    <button
                      onClick={() => onToggleNominee(i)}
                      className={`text-sm leading-snug text-left w-full px-2 py-1 rounded transition-colors ${
                        n.is_winner
                          ? 'text-gold-400 font-semibold bg-gold-500/10 ring-1 ring-gold-500/40'
                          : 'text-gray-400 hover:bg-night-700/60 hover:text-gray-200'
                      }`}
                    >
                      {n.is_winner && <span className="mr-1.5">★</span>}{n.name}
                    </button>
                  </li>
                ) : (
                  <li key={i} className={`text-sm leading-snug ${
                    n.is_winner ? 'text-gold-400 font-semibold' : 'text-gray-500'
                  }`}>
                    {n.is_winner && <span className="mr-1.5">★</span>}{n.name}
                  </li>
                )
              ))}
            </ul>
          ) : (
            <span className="text-gray-600 text-sm">—</span>
          )}
        </td>
        <td className="table-cell align-top py-4 px-5 w-44">
          <GuessCell guess={mattG.guess} isCorrect={mattG.is_correct} nominees={nominees}
                     winner={winner} editMode={editMode} onChange={onChangeMatt} player="matt" />
        </td>
        <td className="table-cell align-top py-4 px-5 w-44">
          <GuessCell guess={dustinG.guess} isCorrect={dustinG.is_correct} nominees={nominees}
                     winner={winner} editMode={editMode} onChange={onChangeDustin} player="dustin" />
        </td>
      </tr>
    </Fragment>
  )
}

const PLAYER_TEXT = { matt: 'text-gold-400', dustin: 'text-film-400' }
const PLAYER_MARK = { matt: 'text-gold-500', dustin: 'text-film-500' }

function GuessCell({ guess, isCorrect, nominees, winner, editMode, onChange, player }) {
  if (!guess) return <span className="text-gray-600 text-sm">—</span>
  const text = PLAYER_TEXT[player] || 'text-gray-300'
  const mark = PLAYER_MARK[player] || 'text-emerald-400'

  if (editMode) {
    const names = nominees.map(n => n.name)
    const options = names.includes(guess) ? names : [guess, ...names]
    const derivedCorrect = winner ? guess === winner : false
    return (
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 flex-shrink-0 text-sm font-bold ${derivedCorrect ? mark : 'text-red-400'}`}>
          {derivedCorrect ? '✓' : '✗'}
        </span>
        <select value={guess} onChange={e => onChange(e.target.value)} className="select text-xs py-1 px-2 w-full">
          {options.map(name => <option key={name} value={name} className="bg-night-900">{name}</option>)}
        </select>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 flex-shrink-0 text-sm font-bold ${isCorrect ? mark : 'text-red-400'}`}>
        {isCorrect ? '✓' : '✗'}
      </span>
      <span className={`text-sm leading-snug ${isCorrect ? text : 'text-gray-500'}`}>{guess}</span>
    </div>
  )
}

function YearDetailsEdit({ yearData, yearEdit, setYearEdit, mattTotal, dustinTotal, saving, onSave, onCalculateWinner }) {
  function fmtForInput(s) { const t = parseInterval(s); return t ? `${t.h}:${String(t.m).padStart(2,'0')}` : '' }
  function fmtMono(s) { const t = parseInterval(s); return t ? `${t.m}:${String(t.s).padStart(2,'0')}` : '' }
  const runtimeVal = f => f in yearEdit ? yearEdit[f] : fmtForInput(yearData[f])
  const monoVal    = f => f in yearEdit ? yearEdit[f] : fmtMono(yearData[f])
  const set = (f, v) => setYearEdit(prev => ({ ...prev, [f]: v }))
  const showMonologue = yearData.year >= 2026

  return (
    <div className="mb-6 rounded-xl border border-cinema-500/40 bg-cinema-500/[0.06] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <span className="font-mono text-[11px] tracking-cinema text-cinema-400 uppercase">
          Year Details &amp; Tiebreaker
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onCalculateWinner} disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-medium hover:bg-emerald-500/20 transition-colors">
            🏆 Calculate Winner ({mattTotal} vs {dustinTotal})
          </button>
          <button onClick={onSave} disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg bg-cinema-500/15 border border-cinema-500/40 text-cinema-400 font-medium hover:bg-cinema-500/20 transition-colors">
            {saving ? '⏳ Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
        <span className="font-mono tracking-kicker uppercase">Status:</span>
        <span className={`font-semibold ${yearData.winner === 'pending' ? 'text-gray-500' : 'text-emerald-400'}`}>
          {yearData.winner === 'pending' ? 'Pending' :
           yearData.winner === 'tied'    ? 'Tied' :
           yearData.winner === 'matt'    ? '🏆 Hermz wins' :
           yearData.winner === 'dustin'  ? '🏆 Dust wins' : yearData.winner}
        </span>
        {yearData.tiebreaker_used && <span className="badge-tiebreaker">Tiebreaker</span>}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <EditField label="Hermz Runtime Guess (H:MM)" value={runtimeVal('matt_runtime_guess')}    onChange={v => set('matt_runtime_guess', v)}    placeholder="3:22" />
        <EditField label="Actual Runtime (H:MM)"       value={runtimeVal('actual_runtime')}        onChange={v => set('actual_runtime', v)}        placeholder="3:44" />
        <EditField label="Dust Runtime Guess (H:MM)"   value={runtimeVal('dustin_runtime_guess')}  onChange={v => set('dustin_runtime_guess', v)}  placeholder="3:30" />
      </div>
      {showMonologue && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-cinema-500/20">
          <EditField label="Hermz Monologue (M:SS)" value={monoVal('matt_monologue_guess')}   onChange={v => set('matt_monologue_guess', v)}   placeholder="12:30" />
          <EditField label="Actual Monologue (M:SS)" value={monoVal('actual_monologue')}      onChange={v => set('actual_monologue', v)}       placeholder="14:00" />
          <EditField label="Dust Monologue (M:SS)"   value={monoVal('dustin_monologue_guess')} onChange={v => set('dustin_monologue_guess', v)} placeholder="10:00" />
        </div>
      )}
    </div>
  )
}

function EditField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block font-mono text-[9px] tracking-kicker text-gray-400 uppercase mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
             className="input text-xs py-1.5 w-full" />
    </div>
  )
}
