// hermz-and-d/src/pages/oscars/OscarsYear.jsx
// Phase 5 — Oscars Year detail, Projector "tile" redesign.
// Category-grouped poster-tile layout (Winner / Hermz / Dust) with the full
// nominee field kept underneath. All edit-mode logic preserved.

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'
import { fetchWikidataNominees, PERSON_CATEGORIES } from '../../lib/oscarCategories'
import {
  GROUP_META, GROUP_ORDER, groupOf, isRevealed,
  parseInterval, fmtRuntime, fmtMonologue,
  runtimeInputValue, monologueInputValue, toRuntimeInterval, toMonologueInterval,
} from '../../lib/oscarSeason'

// ── helpers ──────────────────────────────────────────────────────────────────
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
  const { isAuthenticated, profile } = useAuth()
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
  // Phase 13c — nominee management (pre-reveal): re-fetch/merge + add/rename/remove
  const [manageMode,  setManageMode]  = useState(false)
  const [wdBusy,      setWdBusy]      = useState(false)
  const [wdMsg,       setWdMsg]       = useState(null)

  useEffect(() => {
    supabase.from('oscar_years').select('year').order('year', { ascending: true })
      .then(({ data }) => setAllYears(data?.map(r => r.year) || []))
  }, [])

  useEffect(() => {
    if (!yearNum || yearNum < 1990 || yearNum > 2100) { navigate('/oscars'); return }
    fetchData(yearNum)
  }, [yearNum])

  useEffect(() => { setEditMode(false) }, [yearNum])

  // Phase 13e — ceremony night is live: while the year is 'revealed', winner
  // flips and score changes made on one device push to the other in seconds.
  useEffect(() => {
    if (!yearData || yearData.status !== 'revealed' || editMode) return
    const channel = supabase
      .channel(`oscar-year-${yearData.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'oscar_nominees', filter: `year_id=eq.${yearData.id}` },
        () => fetchData(yearNum, true))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'oscar_years', filter: `id=eq.${yearData.id}` },
        () => fetchData(yearNum, true))
      .subscribe()
    const poll = setInterval(() => fetchData(yearNum, true), 15000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [yearData?.id, yearData?.status, editMode])

  // ── data (quiet=true refreshes in place without the loading screen) ──────
  async function fetchData(yr, quiet = false) {
    if (!quiet) setLoading(true)
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
        if (!catMap[cid]) catMap[cid] = { category: n.oscar_categories, nominees: [], guesses: {}, winner: null, winnerFilm: null }
        catMap[cid].nominees.push({ id: n.id, name: n.nominee_name, is_winner: n.is_winner, order: n.display_order,
                                    film: n.film_title, detail: n.detail })
        if (n.is_winner) { catMap[cid].winner = n.nominee_name; catMap[cid].winnerFilm = n.film_title || n.nominee_name }
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

      // ADDITIVE: look up real posters — film_title gives a far better hit rate
      // than nominee names (people/songs never matched a films row).
      // Sources: films (Canon, curated) wins over film_posters (OMDB cache for
      // everything else — backfilled 2026-07-12, self-heals below).
      const names = new Set()
      const winnerFilms = new Set()
      for (const cat of sorted) {
        if (cat.winnerFilm) { names.add(cat.winnerFilm); winnerFilms.add(cat.winnerFilm) }
        for (const n of cat.nominees) { names.add(n.name); if (n.film) names.add(n.film) }
      }
      if (names.size) {
        const [{ data: cachedPosters }, { data: films }] = await Promise.all([
          supabase.from('film_posters').select('title, poster_url').in('title', [...names]),
          supabase.from('films').select('title, poster_url').in('title', [...names]),
        ])
        const map = {}
        for (const f of cachedPosters || []) if (f.poster_url) map[f.title] = f.poster_url
        for (const f of films || []) if (f.poster_url) map[f.title] = f.poster_url
        const negativeCache = new Set((cachedPosters || []).map(f => f.title))
        setPosterMap(map)
        // self-heal: a future winner not in either source gets an OMDB lookup once,
        // cached even when OMDB has nothing (null row) so we never loop.
        const missing = [...winnerFilms].filter(t => !map[t] && !negativeCache.has(t))
        if (missing.length && isAuthenticated) {
          const omdbKey = import.meta.env.VITE_OMDB_API_KEY
          const healed = {}
          for (const title of missing.slice(0, 24)) {
            let poster = null
            try {
              let d = await fetch(`https://www.omdbapi.com/?apikey=${omdbKey}&t=${encodeURIComponent(title)}&y=${yr - 1}`).then(r => r.json())
              if (d.Response !== 'True' || !d.Poster || d.Poster === 'N/A')
                d = await fetch(`https://www.omdbapi.com/?apikey=${omdbKey}&t=${encodeURIComponent(title)}`).then(r => r.json())
              if (d.Response === 'True' && d.Poster && d.Poster !== 'N/A') poster = d.Poster
            } catch { /* offline / rate-limited — try again next visit */ continue }
            await supabase.from('film_posters').upsert({ title, poster_url: poster })
            if (poster) healed[title] = poster
          }
          if (Object.keys(healed).length) setPosterMap(prev => ({ ...prev, ...healed }))
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── nominee management (Phase 13c) ──────────────────────────────────────
  async function refetchFromWikidata() {
    setWdBusy(true); setWdMsg(null)
    try {
      const { byCat, films } = await fetchWikidataNominees(yearNum, { withFilms: true })
      let added = 0
      for (const cat of categories) {
        const wd = byCat[cat.category.name] || []
        if (!wd.length) continue
        const existing = new Set(cat.nominees.map(n => n.name.toLowerCase()))
        const newOnes = wd.filter(n => !existing.has(n.toLowerCase()))
        if (!newOnes.length) continue
        const rows = newOnes.map((name, i) => ({
          year_id: yearData.id, category_id: cat.category.id,
          nominee_name: name, is_winner: false, display_order: cat.nominees.length + i,
          film_title: films[`${cat.category.name}|${name}`] || null,
        }))
        const { error: insErr } = await supabase.from('oscar_nominees').insert(rows)
        if (insErr) throw insErr
        added += newOnes.length
      }
      setWdMsg(added > 0
        ? `✓ Merged ${added} new nominee${added === 1 ? '' : 's'} from Wikidata — existing entries and picks untouched.`
        : 'No new nominees found — everything Wikidata has is already here.')
      if (added > 0) await fetchData(yearNum)
    } catch (err) {
      setWdMsg(`Wikidata fetch failed: ${err.message}`)
    } finally {
      setWdBusy(false)
    }
  }

  async function renameNominee(nomineeId, newName) {
    const { error: rpcErr } = await supabase.rpc('oscar_rename_nominee', { nom_id: nomineeId, new_name: newName })
    if (rpcErr) { alert(`Rename failed: ${rpcErr.message}`); return }
    await fetchData(yearNum)
  }

  async function deleteNominee(nomineeId) {
    if (!window.confirm('Remove this nominee from the field?')) return
    const { data, error: rpcErr } = await supabase.rpc('oscar_delete_nominee', { nom_id: nomineeId })
    if (rpcErr) { alert(`Delete failed: ${rpcErr.message}`); return }
    if (data === 'blocked') {
      alert('That nominee is picked on a ballot — the pick has to change before it can be removed.')
      return
    }
    await fetchData(yearNum)
  }

  async function addNominee(cat, name, film = '') {
    if (!name.trim()) return
    const { error: insErr } = await supabase.from('oscar_nominees').insert({
      year_id: yearData.id, category_id: cat.category.id,
      nominee_name: name.trim(), is_winner: false, display_order: cat.nominees.length,
      film_title: film.trim() || null,
    })
    if (insErr) { alert(`Add failed: ${insErr.message}`); return }
    await fetchData(yearNum)
  }

  // film is display metadata only — direct update, no cascade needed
  async function setNomineeFilm(nomineeId, film) {
    const { error: updErr } = await supabase.from('oscar_nominees')
      .update({ film_title: film || null }).eq('id', nomineeId)
    if (updErr) { alert(`Film update failed: ${updErr.message}`); return }
    await fetchData(yearNum)
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
      const toRuntime = toRuntimeInterval
      const toMono    = toMonologueInterval
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
      <span className="font-mono text-xs tracking-kicker text-gray-400 animate-pulse">LOADING CEREMONY…</span>
    </div>
  )
  if (error) return <div className="py-20 text-center text-red-400">Error: {error}</div>
  if (!yearData) return null

  const mattTotal   = categories.filter(c => c.guesses.matt?.is_correct).length
  const dustinTotal = categories.filter(c => c.guesses.dustin?.is_correct).length
  const mattWon = yearData.winner === 'matt'
  const dustinWon = yearData.winner === 'dustin'
  const tb = yearData.tiebreaker_used
  // Phase 13b — picks stay sealed (RLS-enforced) until the reveal
  const sealed = !isRevealed(yearData.status)
  const myUsername = profile?.username

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

        {/* Year nav — top-right */}
        <div className="absolute top-6 right-6 sm:right-10 flex items-center gap-2 z-10">
          {prevYear && <Link to={`/oscars/${prevYear}`} className="pill">← {prevYear}</Link>}
          <YearDropdown current={yearNum} allYears={allYears} />
          {nextYear && <Link to={`/oscars/${nextYear}`} className="pill">{nextYear} →</Link>}
          {isAuthenticated && !sealed && (
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
              <Link to="/oscars" className="font-mono text-xs tracking-kicker text-gold-500
                                            hover:text-gold-400 transition-colors flex items-center gap-2">
                <OscarIcon size={12} /> OSCARS
              </Link>
              <span className="text-gray-600">/</span>
              <span className="font-mono text-xs tracking-kicker text-white">{yearNum}</span>
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
            {sealed ? (
              <div className="text-center px-2">
                <div className="font-display text-2xl text-white tracking-wide leading-none">🔒</div>
                <div className="font-mono text-xs tracking-cinema text-gold-500 mt-1.5">BALLOTS SEALED</div>
              </div>
            ) : (
              <>
                <HeroYearScore who="matt"   score={mattTotal}   total={categories.length} winner={mattWon} tb={tb} />
                <span className="w-px h-12 bg-white/10" />
                <HeroYearScore who="dustin" score={dustinTotal} total={categories.length} winner={dustinWon} tb={tb} />
              </>
            )}
          </div>
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">

        {sealed && (
          <div className="mb-6 px-5 py-4 rounded-xl border border-gold-500/40 bg-gold-500/[0.06]
                          flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">
                  {yearData.status === 'locked'
                    ? 'Both ballots are locked. The reveal awaits.'
                    : yearData.status === 'ballots'
                    ? 'Ballots are open — picks stay hidden from each other until the reveal.'
                    : 'Nominees are being set up. Ballots open once they\'re saved.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isAuthenticated && yearData.status === 'ballots' && (
                <Link to="/oscars/ballot" className="btn-gold text-xs px-4">🗳 My Ballot →</Link>
              )}
              {isAuthenticated && yearData.status === 'locked' && (
                <Link to="/oscars/reveal" className="btn-gold text-xs px-4">🎭 The Reveal →</Link>
              )}
              {isAuthenticated && (
                <button onClick={() => setManageMode(m => !m)}
                        className={manageMode ? 'pill-active' : 'btn-cinema text-xs'}>
                  {manageMode ? '✓ Done Managing' : '⚙ Manage Nominees'}
                </button>
              )}
            </div>
          </div>
        )}

        {sealed && manageMode && (
          <div className="card mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-display text-lg text-white tracking-wide mb-1">RE-FETCH FROM WIKIDATA</p>
                <p className="text-xs text-gray-400 max-w-md">
                  Merges anything new for the {yearNum} ceremony into the field below — never removes
                  or duplicates existing nominees, and never touches picks. Run it again whenever
                  Wikidata catches up after the nominations announcement.
                </p>
              </div>
              <button type="button" onClick={refetchFromWikidata} disabled={wdBusy}
                      className="btn-cinema text-sm flex items-center gap-2 shrink-0">
                {wdBusy ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Fetching…
                  </>
                ) : (<>🌐 Re-fetch & Merge</>)}
              </button>
            </div>
            {wdMsg && (
              <div className={`mt-3 px-3 py-2.5 rounded-lg text-sm border ${
                wdMsg.startsWith('✓')
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                  : wdMsg.startsWith('Wikidata fetch failed')
                    ? 'bg-red-500/10 text-red-400 border-red-500/40'
                    : 'bg-cinema-500/10 text-cinema-400 border-cinema-500/40'
              }`}>
                {wdMsg}
              </div>
            )}
          </div>
        )}

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
                <span className="font-mono text-sm tracking-kicker text-gray-400">{group.cats.length} {group.cats.length === 1 ? 'category' : 'categories'}</span>
              </div>
              <div className="space-y-3">
                {group.cats.map(({ c, idx }) => (
                  <CategoryCard
                    key={c.category.id}
                    cat={c} idx={idx} yearNum={yearNum} editMode={editMode} posterMap={posterMap}
                    sealed={sealed} myUsername={myUsername}
                    manageMode={sealed && manageMode}
                    onToggleNominee={ni => toggleNomineeWinner(idx, ni)}
                    onChangeMatt={n => changeGuess(idx, 'matt', n)}
                    onChangeDustin={n => changeGuess(idx, 'dustin', n)}
                    onRenameNominee={renameNominee}
                    onDeleteNominee={deleteNominee}
                    onAddNominee={(name, film) => addNominee(c, name, film)}
                    onSetNomineeFilm={setNomineeFilm}
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

// ── hero score — winner treatment lives inside its own column (no overlay,
//    2026-07-12: the floating "WINNER · TIEBREAKER" chip overlapped the other score)
function HeroYearScore({ who, score, total, winner, tb }) {
  const c = who === 'matt' ? 'text-gold-500' : 'text-film-500'
  const name = who === 'matt' ? 'HERMZ' : 'DUST'
  return (
    <div className={`text-center px-3 py-1.5 rounded-xl ${winner ? 'ring-1 ring-gold-500/50 bg-gold-500/[0.07]' : ''}`}>
      <div className={`font-mono text-xs tracking-cinema ${c} mb-1`}>{name}</div>
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="font-display text-4xl text-white leading-none tracking-wide">{score}</span>
        <span className="font-mono text-xs text-gray-400 tracking-kicker">/{total}</span>
      </div>
      {winner && (
        <div className="font-mono text-xs tracking-cinema text-gold-400 mt-1 whitespace-nowrap">
          ★ WINNER{tb ? ' · TB' : ''}
        </div>
      )}
    </div>
  )
}

function YearDropdown({ current, allYears }) {
  const navigate = useNavigate()
  const sorted = [...allYears].sort((a, b) => b - a)
  return (
    <select value={current} onChange={e => navigate(`/oscars/${e.target.value}`)}
      className="bg-night-950/70 border border-white/[0.12] text-white font-mono text-xs
                 tracking-kicker px-3 py-1.5 rounded-full cursor-pointer backdrop-blur-md
                 hover:border-gold-500/60 transition-colors">
      {sorted.map(y => <option key={y} value={y} className="bg-night-900">{y}</option>)}
    </select>
  )
}

// ── CategoryCard — nominee list is the star (2026-07-12 redesign) ────────────
// Every nominee is a full row (person/song + film, or film + craft detail).
// The winner gets the gold row + a poster anchor; picks appear as HERMZ/DUST
// badges directly on the nominee each player chose.
const SONG_CAT = 'Best Original Song'

function CategoryCard({ cat, idx, yearNum, editMode, posterMap, sealed, myUsername, manageMode,
                        onToggleNominee, onChangeMatt, onChangeDustin,
                        onRenameNominee, onDeleteNominee, onAddNominee, onSetNomineeFilm }) {
  const { category, nominees, guesses, winner, winnerFilm } = cat
  const mattG = guesses.matt || {}
  const dustinG = guesses.dustin || {}
  const isNew = category.active_from && category.active_from > 2008 && category.active_from === yearNum
  const isRetired = category.active_until && category.active_until === yearNum
  const label = category.name.replace(/^Best\s+/i, '').toUpperCase()

  // agreement chip — only meaningful once the winner is known and both picked
  let chip = null
  if (!sealed && winner && mattG.guess && dustinG.guess) {
    if (mattG.guess === dustinG.guess) {
      chip = mattG.is_correct
        ? { text: 'BOTH CORRECT', cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' }
        : { text: 'BOTH MISSED',  cls: 'text-red-400 border-red-500/40 bg-red-500/10' }
    } else {
      chip = { text: 'SPLIT PICK', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' }
    }
  }

  const posterUrl = winnerFilm ? posterMap[winnerFilm] || posterMap[winner] : null

  return (
    <div className="rounded-xl border border-night-700/60 bg-night-800/40 overflow-hidden">
      {/* category header */}
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-between gap-2 flex-wrap
                      border-b border-night-700/50 bg-night-900/30">
        <span className="font-mono text-base tracking-cinema text-gold-500 uppercase">{label}</span>
        <span className="flex items-center gap-2">
          {isNew && <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-mono tracking-cinema">NEW</span>}
          {isRetired && <span className="text-xs bg-gray-700 text-gray-400 border border-gray-600 px-2 py-0.5 rounded font-mono tracking-cinema">FINAL YEAR</span>}
          {chip && <span className={`font-mono text-xs tracking-cinema px-2.5 py-0.5 rounded-full border ${chip.cls}`}>{chip.text}</span>}
        </span>
      </div>

      {/* winner poster + nominee rows */}
      <div className="flex gap-4 px-4 py-4">
        {!sealed && winner && (
          <div className="flex-shrink-0 w-32 hidden sm:block">
            <div className="w-32 h-48 rounded-lg overflow-hidden border border-night-700/60 bg-night-700/40 shadow-still-lg">
              {posterUrl ? (
                <img src={posterUrl} alt={winnerFilm} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2">
                  <span className="text-gold-500 text-2xl leading-none">★</span>
                  <span className="font-serif text-sm text-gray-400 text-center leading-tight line-clamp-4">{winnerFilm}</span>
                </div>
              )}
            </div>
            <div className="font-mono text-xs tracking-cinema text-gold-400 text-center mt-2">WINNER</div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {nominees.map(n => (
            <NomineeRow key={n.id ?? n.name} nominee={n} catName={category.name}
                        winner={winner} sealed={sealed} myUsername={myUsername}
                        mattG={mattG} dustinG={dustinG} />
          ))}
          {nominees.length === 0 && (
            <p className="font-serif italic text-sm text-gray-500 py-2">Nominees not entered yet.</p>
          )}
        </div>
      </div>

      {/* manage / edit panels below the field */}
      {manageMode && (
        <NomineeEditor
          nominees={nominees}
          onRename={onRenameNominee} onDelete={onDeleteNominee} onAdd={onAddNominee}
          onSetFilm={onSetNomineeFilm}
        />
      )}
      {!manageMode && editMode && (
        <EditField
          nominees={nominees} winner={winner}
          mattGuess={mattG.guess} dustinGuess={dustinG.guess}
          onToggleNominee={onToggleNominee} onChangeMatt={onChangeMatt} onChangeDustin={onChangeDustin}
        />
      )}
    </div>
  )
}

// one nominee row: name + film/detail, gold winner treatment, pick badges.
// sealed (Phase 13b): only your own pick badge shows pre-reveal — the other
// player's pick is RLS-hidden anyway, so their badge simply can't render.
function NomineeRow({ nominee, catName, winner, sealed, myUsername, mattG, dustinG }) {
  const isWinner = !sealed && nominee.is_winner
  const isSong = catName === SONG_CAT
  const personOrSong = isSong || PERSON_CATEGORIES.has(catName)
  const secondary = personOrSong
    ? nominee.film
    : (nominee.detail || (nominee.film && nominee.film !== nominee.name ? nominee.film : null))

  const mattPicked   = mattG.guess === nominee.name && (!sealed || myUsername === 'matt')
  const dustinPicked = dustinG.guess === nominee.name && (!sealed || myUsername === 'dustin')
  const missedHere = !isWinner && winner && (mattPicked || dustinPicked)

  return (
    <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg flex-wrap ${
      isWinner ? 'bg-gold-500/[0.08] border-l-2 border-gold-500'
      : missedHere ? 'bg-red-500/[0.05]' : ''
    }`}>
      <span className={`w-3.5 flex-shrink-0 text-gold-400 ${isWinner ? '' : 'opacity-0'}`}>★</span>
      <span className="flex-1 min-w-[10rem]">
        <span className={`font-display text-base sm:text-lg leading-snug tracking-wide ${
          isWinner ? 'text-gold-300' : missedHere ? 'text-gray-400 line-through decoration-red-400/50' : 'text-gray-300'
        }`}>
          {isSong ? `“${nominee.name}”` : nominee.name}
        </span>
        {secondary && (
          <span className={`font-serif italic text-sm ml-1.5 ${isWinner ? 'text-gray-300' : 'text-gray-400'}`}>
            — {secondary}
          </span>
        )}
      </span>
      {(mattPicked || dustinPicked) && (
        <span className="flex items-center gap-1.5 flex-shrink-0">
          {mattPicked && <PickBadge who="matt" correct={sealed ? null : mattG.is_correct} />}
          {dustinPicked && <PickBadge who="dustin" correct={sealed ? null : dustinG.is_correct} />}
        </span>
      )}
    </div>
  )
}

function PickBadge({ who, correct }) {
  const isMatt = who === 'matt'
  return (
    <span className={`font-mono text-xs tracking-kicker px-2 py-0.5 rounded-full border ${
      isMatt ? 'text-gold-400 border-gold-500/40' : 'text-film-400 border-film-500/40'
    }`}>
      {isMatt ? 'HERMZ' : 'DUST'}
      {correct === true  && <span className="text-emerald-400 ml-1">✓</span>}
      {correct === false && <span className="text-red-400 ml-1">✗</span>}
    </span>
  )
}

// nominee management (Phase 13c): rename / remove / add — renames cascade to
// both players' picks via a SECURITY DEFINER fn; removes are blocked while picked.
// 2026-07-12: each row also edits the nominee's film (display-only, no cascade).
function NomineeEditor({ nominees, onRename, onDelete, onAdd, onSetFilm }) {
  const [addVal, setAddVal]   = useState('')
  const [addFilm, setAddFilm] = useState('')
  const submitAdd = () => { onAdd(addVal, addFilm); setAddVal(''); setAddFilm('') }
  return (
    <div className="px-4 pb-4 pt-2 space-y-2 border-t border-night-700/50">
      <div className="font-mono text-sm tracking-cinema text-cinema-400 uppercase mb-1">Edit the Field</div>
      {nominees.map(n => (
        <NomineeEditRow key={n.id} nominee={n} onRename={onRename} onDelete={onDelete} onSetFilm={onSetFilm} />
      ))}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <input value={addVal} onChange={e => setAddVal(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAdd() } }}
               placeholder="Add a nominee…" className="input text-sm py-1.5 flex-1 min-w-[10rem]" />
        <input value={addFilm} onChange={e => setAddFilm(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAdd() } }}
               placeholder="Film (optional)" className="input text-sm py-1.5 w-44" />
        <button type="button" onClick={submitAdd}
                disabled={!addVal.trim()}
                className="btn-cinema text-xs disabled:opacity-40">+ Add</button>
      </div>
    </div>
  )
}

function NomineeEditRow({ nominee, onRename, onDelete, onSetFilm }) {
  const [val, setVal]   = useState(nominee.name)
  const [film, setFilm] = useState(nominee.film || '')
  const dirtyName = val.trim() !== nominee.name && val.trim() !== ''
  const dirtyFilm = film.trim() !== (nominee.film || '')
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input value={val} onChange={e => setVal(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter' && dirtyName) { e.preventDefault(); onRename(nominee.id, val.trim()) } }}
             className="input text-sm py-1.5 flex-1 min-w-[10rem]" />
      <input value={film} onChange={e => setFilm(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter' && dirtyFilm) { e.preventDefault(); onSetFilm(nominee.id, film.trim()) } }}
             placeholder="Film" className="input text-sm py-1.5 w-44" />
      {(dirtyName || dirtyFilm) && (
        <button type="button"
                onClick={() => { if (dirtyName) onRename(nominee.id, val.trim()); if (dirtyFilm) onSetFilm(nominee.id, film.trim()) }}
                className="btn-gold text-xs px-3">Save</button>
      )}
      <button type="button" onClick={() => onDelete(nominee.id)}
              className="text-gray-500 hover:text-red-400 transition-colors text-sm flex-shrink-0"
              title="Remove nominee">
        ✕
      </button>
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

// ── Tiebreaker — one compact strip: the fact, the numbers, the verdict ───────
// (2026-07-12 redesign — the old three-column panel repeated "tiebreaker" four
//  ways and dwarfed the categories below it.)
function TiebreakerPanel({ yearData, mattWon }) {
  const mattDiff   = runtimeDiff(yearData.actual_runtime, yearData.matt_runtime_guess)
  const dustinDiff = runtimeDiff(yearData.actual_runtime, yearData.dustin_runtime_guess)
  const hasMonologue = yearData.actual_monologue
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 mb-6">
      <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
        <span className="badge-tiebreaker flex-shrink-0">⚖ Tiebreaker</span>
        <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase">
          Runtime <span className="text-white font-semibold">{fmtRuntime(yearData.actual_runtime)}</span>
        </span>
        <span className="font-mono text-xs tracking-kicker uppercase">
          <span className="text-gold-400">Hermz {fmtRuntime(yearData.matt_runtime_guess)}</span>
          {mattDiff && <span className="text-gray-400"> ({mattDiff})</span>}
        </span>
        <span className="font-mono text-xs tracking-kicker uppercase">
          <span className="text-film-400">Dust {fmtRuntime(yearData.dustin_runtime_guess)}</span>
          {dustinDiff && <span className="text-gray-400"> ({dustinDiff})</span>}
        </span>
        <span className={`font-mono text-xs tracking-cinema uppercase sm:ml-auto font-semibold ${mattWon ? 'text-gold-400' : 'text-film-400'}`}>
          → {mattWon ? 'Hermz' : 'Dust'} wins the year
        </span>
      </div>
      {hasMonologue && (
        <p className="font-mono text-xs tracking-kicker text-gray-400 uppercase mt-2 pt-2 border-t border-amber-500/15">
          Monologue backup (unused) — actual {fmtMonologue(yearData.actual_monologue)} ·
          Hermz {fmtMonologue(yearData.matt_monologue_guess)} ·
          Dust {fmtMonologue(yearData.dustin_monologue_guess)}
        </p>
      )}
    </div>
  )
}

function YearDetailsEdit({ yearData, yearEdit, setYearEdit, mattTotal, dustinTotal, saving, onSave, onCalculateWinner }) {
  const runtimeVal = f => f in yearEdit ? yearEdit[f] : runtimeInputValue(yearData[f])
  const monoVal    = f => f in yearEdit ? yearEdit[f] : monologueInputValue(yearData[f])
  const set = (f, v) => setYearEdit(prev => ({ ...prev, [f]: v }))
  const showMonologue = yearData.year >= 2026

  return (
    <div className="mb-6 rounded-xl border border-cinema-500/40 bg-cinema-500/[0.06] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <span className="font-mono text-xs tracking-cinema text-cinema-400 uppercase">Year Details &amp; Tiebreaker</span>
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
      <label className="block font-mono text-xs tracking-kicker text-gray-300 uppercase mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
             className="input text-sm py-1.5 w-full" />
    </div>
  )
}
