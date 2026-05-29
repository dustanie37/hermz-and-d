// hermz-and-d/src/pages/oscars/OscarsYear.jsx
// Phase 5 — Oscars Year detail, Projector "tile" redesign.
// Category-grouped poster-tile layout (Winner / Hermz / Dust) with the full
// nominee field kept underneath. All edit-mode logic preserved.

import { useState, useEffect, Fragment } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'

// ── category groups — matches OscarsStats exactly ────────────────────────────
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
  'Best Casting':                    'Craft',
  'Best Original Score':             'Music',
  'Best Original Song':              'Music',
  'Best Sound':                      'Music',
  'Best Animated Short Film':        'Shorts',
  'Best Documentary Short Film':     'Shorts',
  'Best Live Action Short Film':     'Shorts',
  'Best Sound Editing':              'Sound',
  'Best Sound Mixing':               'Sound',
}
const GROUP_META = {
  Major:   'Major Awards',
  Acting:  'Acting',
  Writing: 'Writing',
  Craft:   'Craft',
  Music:   'Music & Sound',
  Shorts:  'Short Films',
  Sound:   'Discontinued',
}
const GROUP_ORDER = ['Major', 'Acting', 'Writing', 'Craft', 'Music', 'Shorts', 'Sound']
function groupOf(name) { return CAT_GROUP[name] || 'Craft' }

// ── helpers (unchanged) ──────────────────────────────────────────────────────
function parseInterval(str) {
  if (!str) return null
  const parts = str.split(':')
  if (parts.length < 2) return null
  return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10), s: parseInt(parts[2] || 0, 10) }
}
function fmtRuntime(str) { const t = parseInterval(str); return t ? `${t.h}h ${t.m}m` : '—' }
function fmtMonologue(str) { const t = parseInterval(str); if (!t) return '—'; return t.h > 0 ? `${t.h}h ${t.m}m ${t.s}s` : `${t.m}m ${t.s}s` }
function runtimeDiff(actual, guess) {
  const a = parseInterval(actual), g = parseInterval(guess)
  if (!a || !g) return null
  const diff = Math.abs((a.h * 60 + a.m) - (g.h * 60 + g.m))
  return diff === 0 ? 'exact' : `off by ${diff}m`
}
function shortCeremony(name) { return !name ? '' : name.replace(/^The\s+/i, '').split(' - ')[0] }
function formatDate(name) { if (!name) return ''; return name.split(' - ')[1] || '' }
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
  const [posterMap,   setPosterMap]   = useState({})
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
    if (!yearNum || yearNum < 1990 || yearNum > 2100) { navigate('/oscars'); return }
    fetchData(yearNum)
  }, [yearNum])

  useEffect(() => { setEditMode(false) }, [yearNum])

  // ── data (fetch unchanged; poster lookup added at the end) ───────────────
  async function fetchData(yr) {
    setLoading(true); setError(null)
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

      // ADDITIVE: look up real posters for any title that matches a film.
      const names = new Set()
      for (const cat of sorted) {
        if (cat.winner) names.add(cat.winner)
        for (const n of cat.nominees) names.add(n.name)
        if (cat.guesses.matt?.guess)   names.add(cat.guesses.matt.guess)
        if (cat.guesses.dustin?.guess) names.add(cat.guesses.dustin.guess)
      }
      if (names.size) {
        const { data: films } = await supabase
          .from('films').select('title, poster_url').in('title', [...names])
        const map = {}
        for (const f of films || []) if (f.poster_url) map[f.title] = f.poster_url
        setPosterMap(map)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── edit handlers (UNCHANGED) ────────────────────────────────────────────
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
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING CEREMONY…</span>
    </div>
  )
  if (error) return <div className="py-20 text-center text-red-400">Error: {error}</div>
  if (!yearData) return null

  const mattTotal   = categories.filter(c => c.guesses.matt?.is_correct).length
  const dustinTotal = categories.filter(c => c.guesses.dustin?.is_correct).length
  const mattWon = yearData.winner === 'matt'
  const dustinWon = yearData.winner === 'dustin'
  const tb = yearData.tiebreaker_used

  // bucket categories into groups, preserving display_order within each group
  const groups = GROUP_ORDER
    .map(g => ({ name: g, cats: categories
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => groupOf(c.category.name) === g) }))
    .filter(g => g.cats.length > 0)

  return (
    <div>
      {/* ── HERO (compact) ──────────────────────────────────────────────── */}
      <FilmStill
        title={`Hermz and D Oscar ${yearNum}`}
        hue={yearHue(yearNum)}
        mood={mattWon ? 'warm' : 'cool'}
        className="w-full h-[300px] sm:h-[340px]"
      >
        <div className="absolute inset-0 scrim-bottom" />

        {/* Year nav — top-right */}
        <div className="absolute top-6 right-6 sm:right-10 flex items-center gap-2 z-10">
          {prevYear && <Link to={`/oscars/${prevYear}`} className="pill">← {prevYear}</Link>}
          <YearDropdown current={yearNum} allYears={allYears} />
          {nextYear && <Link to={`/oscars/${nextYear}`} className="pill">{nextYear} →</Link>}
          {isAuthenticated && (
            <button onClick={() => setEditMode(m => !m)} className={editMode ? 'pill-active' : 'btn-cinema text-xs'}>
              {editMode ? (saving ? '⏳ Saving…' : '✓ Done') : '✏️ Edit'}
            </button>
          )}
        </div>

        {/* Headline + floating score, sharing the hero baseline */}
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10
                        flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <Link to="/oscars" className="font-mono text-[11px] tracking-kicker text-gold-500
                                            hover:text-gold-400 transition-colors flex items-center gap-2">
                <OscarIcon size={12} /> OSCARS
              </Link>
              <span className="text-gray-600">/</span>
              <span className="font-mono text-[11px] tracking-kicker text-white">{yearNum}</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-wide
                           leading-[0.92] whitespace-nowrap">
              {shortCeremony(yearData.ceremony_name).toUpperCase()}
            </h1>
            <p className="font-serif italic text-base sm:text-lg text-gray-400 mt-2">
              {formatDate(yearData.ceremony_name)}
            </p>
          </div>

          <div className="hidden md:flex bg-night-950/70 backdrop-blur-md border border-white/[0.12]
                          rounded-2xl px-5 py-3.5 gap-4 items-center shadow-still-lg flex-shrink-0">
            <HeroYearScore who="matt"   score={mattTotal}   total={categories.length} winner={mattWon} tb={tb} />
            <span className="w-px h-12 bg-white/10" />
            <HeroYearScore who="dustin" score={dustinTotal} total={categories.length} winner={dustinWon} tb={tb} />
          </div>
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">

        {editMode && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-cinema-500/40 bg-cinema-500/10
                          text-cinema-400 text-sm flex items-center gap-2">
            <span className="font-semibold">Edit mode active.</span>
            <span className="opacity-80">Click a nominee to set the winner · use the dropdowns to change a guess.</span>
          </div>
        )}

        {tb && !editMode && <TiebreakerPanel yearData={yearData} mattWon={mattWon} />}

        {editMode && (
          <YearDetailsEdit
            yearData={yearData} yearEdit={yearEdit} setYearEdit={setYearEdit}
            mattTotal={mattTotal} dustinTotal={dustinTotal}
            saving={saving} onSave={saveYearDetails} onCalculateWinner={calculateWinner}
          />
        )}

        {/* Category groups — single column */}
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.name}>
              <div className="flex items-center gap-3 pb-2 mb-4 border-b border-night-700/60">
                <span className="font-mono text-sm tracking-cinema text-gold-500 uppercase">{GROUP_META[group.name] || group.name}</span>
                <span className="flex-1 h-px bg-night-700/60" />
                <span className="font-mono text-sm tracking-kicker text-gray-500">{group.cats.length} {group.cats.length === 1 ? 'category' : 'categories'}</span>
              </div>
              <div className="space-y-3">
                {group.cats.map(({ c, idx }) => (
                  <CategoryCard
                    key={c.category.id}
                    cat={c} idx={idx} yearNum={yearNum} editMode={editMode} posterMap={posterMap}
                    onToggleNominee={ni => toggleNomineeWinner(idx, ni)}
                    onChangeMatt={n => changeGuess(idx, 'matt', n)}
                    onChangeDustin={n => changeGuess(idx, 'dustin', n)}
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

// ── hero score ────────────────────────────────────────────────────────────────
function HeroYearScore({ who, score, total, winner, tb }) {
  const c = who === 'matt' ? 'text-gold-500' : 'text-film-500'
  const name = who === 'matt' ? 'HERMZ' : 'DUST'
  return (
    <div className="text-center px-1.5 relative">
      {winner && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px]
                         tracking-cinema ${c} px-1.5 py-px rounded bg-night-950/80 whitespace-nowrap`}>
          ● WINNER{tb && ' · TIEBREAKER'}
        </div>
      )}
      <div className={`font-mono text-xs tracking-cinema ${c} mb-1`}>{name}</div>
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="font-display text-4xl text-white leading-none tracking-wide">{score}</span>
        <span className="font-mono text-xs text-gray-500 tracking-kicker">/{total}</span>
      </div>
    </div>
  )
}

function YearDropdown({ current, allYears }) {
  const navigate = useNavigate()
  const sorted = [...allYears].sort((a, b) => b - a)
  return (
    <select value={current} onChange={e => navigate(`/oscars/${e.target.value}`)}
      className="bg-night-950/70 border border-white/[0.12] text-white font-mono text-[11px]
                 tracking-kicker px-3 py-1.5 rounded-full cursor-pointer backdrop-blur-md
                 hover:border-gold-500/60 transition-colors">
      {sorted.map(y => <option key={y} value={y} className="bg-night-900">{y}</option>)}
    </select>
  )
}

// ── CategoryCard — winner / hermz / dust tiles + nominee field ───────────────
function CategoryCard({ cat, idx, yearNum, editMode, posterMap, onToggleNominee, onChangeMatt, onChangeDustin }) {
  const { category, nominees, guesses, winner } = cat
  const mattG = guesses.matt || {}
  const dustinG = guesses.dustin || {}
  const isNew = category.active_from && category.active_from > 2008 && category.active_from === yearNum
  const isRetired = category.active_until && category.active_until === yearNum
  const label = category.name.replace(/^Best\s+/i, '').toUpperCase()

  return (
    <div className="rounded-xl border border-night-700/60 bg-night-800/40 overflow-hidden">
      {/* category header */}
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-center gap-2 flex-wrap
                      border-b border-night-700/50 bg-night-900/30">
        <span className="font-mono text-base tracking-cinema text-gold-500 uppercase">{label}</span>
        {isNew && <span className="text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-mono tracking-cinema">NEW</span>}
        {isRetired && <span className="text-sm bg-gray-700 text-gray-400 border border-gray-600 px-2 py-0.5 rounded font-mono tracking-cinema">FINAL YEAR</span>}
      </div>

      {/* three picks */}
      <div className="grid grid-cols-3 gap-4 px-4 py-4">
        <PickTile who="winner" name={winner} posterMap={posterMap} />
        <PickTile who="matt"   name={mattG.guess}   correct={mattG.is_correct}   posterMap={posterMap} />
        <PickTile who="dustin" name={dustinG.guess} correct={dustinG.is_correct} posterMap={posterMap} />
      </div>

      {/* nominee field — view OR edit */}
      {editMode ? (
        <EditField
          nominees={nominees} winner={winner}
          mattGuess={mattG.guess} dustinGuess={dustinG.guess}
          onToggleNominee={onToggleNominee} onChangeMatt={onChangeMatt} onChangeDustin={onChangeDustin}
        />
      ) : (
        nominees.length > 0 && (
          <div className="px-4 pb-4 pt-1 border-t border-night-700/40">
            <div className="font-mono text-sm tracking-cinema text-gray-500 uppercase mb-2">The Field</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {nominees.map((n, i) => (
                <span key={i} className={`text-base leading-snug ${
                  n.is_winner ? 'text-gold-400 font-semibold' : 'text-gray-400'
                }`}>
                  {n.is_winner && <span className="mr-0.5">★</span>}{n.name}
                  {i < nominees.length - 1 && <span className="text-gray-700 ml-3">·</span>}
                </span>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// one tile: label + name, with ✓/✗ for the two players
function PickTile({ who, name, correct, posterMap }) {
  const isWinner = who === 'winner'
  const labelColor = who === 'matt' ? 'text-gold-500' : who === 'dustin' ? 'text-film-500' : 'text-gold-400'
  const labelText  = who === 'matt' ? 'HERMZ' : who === 'dustin' ? 'DUST' : 'WINNER'
  const nameColor  = isWinner ? 'text-white'
    : correct === false ? 'text-gray-500 line-through' : 'text-white'

  return (
    <div className="min-w-0">
      <div className={`font-mono text-sm tracking-cinema uppercase mb-1 flex items-center gap-1.5 ${labelColor}`}>
        <span>{labelText}</span>
        {correct === true  && <span className="text-emerald-400">✓</span>}
        {correct === false && <span className="text-red-400">✗</span>}
      </div>
      <div className={`font-display text-lg leading-tight tracking-wide line-clamp-2 ${nameColor}`}>
        {(name || 'TBD').toUpperCase()}
      </div>
    </div>
  )
}

// edit controls: nominee buttons (set winner) + two guess selects
function EditField({ nominees, winner, mattGuess, dustinGuess, onToggleNominee, onChangeMatt, onChangeDustin }) {
  const names = nominees.map(n => n.name)
  const opts = g => (names.includes(g) ? names : g ? [g, ...names] : names)
  return (
    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-night-700/50">
      <div>
        <div className="font-mono text-sm tracking-cinema text-cinema-400 uppercase mb-2">Set Winner</div>
        <div className="flex flex-wrap gap-2">
          {nominees.map((n, i) => (
            <button key={i} onClick={() => onToggleNominee(i)}
              className={`text-base px-3 py-1.5 rounded transition-colors ${
                n.is_winner
                  ? 'text-gold-400 font-semibold bg-gold-500/10 ring-1 ring-gold-500/40'
                  : 'text-gray-400 bg-night-700/50 hover:bg-night-700 hover:text-gray-200'
              }`}>
              {n.is_winner && <span className="mr-1">★</span>}{n.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-mono text-sm tracking-cinema text-gold-500 uppercase mb-1.5">Hermz pick</div>
          <select value={mattGuess || ''} onChange={e => onChangeMatt(e.target.value)} className="select text-base py-1.5 px-2 w-full">
            {opts(mattGuess).map(n => <option key={n} value={n} className="bg-night-900">{n}</option>)}
          </select>
        </div>
        <div>
          <div className="font-mono text-sm tracking-cinema text-film-500 uppercase mb-1.5">Dust pick</div>
          <select value={dustinGuess || ''} onChange={e => onChangeDustin(e.target.value)} className="select text-base py-1.5 px-2 w-full">
            {opts(dustinGuess).map(n => <option key={n} value={n} className="bg-night-900">{n}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Tiebreaker + year-details edit (UNCHANGED from current file) ─────────────
function TiebreakerPanel({ yearData, mattWon }) {
  const dustinWon = !mattWon
  const mattDiff   = runtimeDiff(yearData.actual_runtime, yearData.matt_runtime_guess)
  const dustinDiff = runtimeDiff(yearData.actual_runtime, yearData.dustin_runtime_guess)
  const hasMonologue = yearData.actual_monologue
  return (
    <div className="border border-cinema-500/40 bg-cinema-500/[0.06] rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="badge-tiebreaker">Tiebreaker</span>
        <span className="font-mono text-[10px] tracking-kicker text-cinema-400 uppercase">tied score — decided by runtime guess</span>
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
        <span className="font-mono text-[11px] tracking-cinema text-cinema-400 uppercase">Year Details &amp; Tiebreaker</span>
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
        <YearInput label="Hermz Runtime Guess (H:MM)" value={runtimeVal('matt_runtime_guess')}    onChange={v => set('matt_runtime_guess', v)}    placeholder="3:22" />
        <YearInput label="Actual Runtime (H:MM)"       value={runtimeVal('actual_runtime')}        onChange={v => set('actual_runtime', v)}        placeholder="3:44" />
        <YearInput label="Dust Runtime Guess (H:MM)"   value={runtimeVal('dustin_runtime_guess')}  onChange={v => set('dustin_runtime_guess', v)}  placeholder="3:30" />
      </div>
      {showMonologue && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-cinema-500/20">
          <YearInput label="Hermz Monologue (M:SS)" value={monoVal('matt_monologue_guess')}   onChange={v => set('matt_monologue_guess', v)}   placeholder="12:30" />
          <YearInput label="Actual Monologue (M:SS)" value={monoVal('actual_monologue')}      onChange={v => set('actual_monologue', v)}       placeholder="14:00" />
          <YearInput label="Dust Monologue (M:SS)"   value={monoVal('dustin_monologue_guess')} onChange={v => set('dustin_monologue_guess', v)} placeholder="10:00" />
        </div>
      )}
    </div>
  )
}

function YearInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block font-mono text-[9px] tracking-kicker text-gray-400 uppercase mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
             className="input text-xs py-1.5 w-full" />
    </div>
  )
}
