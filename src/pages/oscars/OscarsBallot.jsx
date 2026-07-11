// src/pages/oscars/OscarsBallot.jsx
// Phase 13b — My Ballot: each player fills their own Oscar picks privately.
// RLS keeps the other player's rows invisible until the year is revealed;
// this page only ever reads/writes the signed-in player's own rows.

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'
import {
  GROUP_META, GROUP_ORDER, groupOf,
  toRuntimeInterval, toMonologueInterval, runtimeInputValue, monologueInputValue,
} from '../../lib/oscarSeason'

function yearHue(y) { return ((y * 17) + 11) % 360 }

export default function OscarsBallot() {
  const { profile } = useAuth()
  const me = profile?.id
  const myName = profile?.username

  const [yearRow,    setYearRow]    = useState(null)   // the open ballot year
  const [noOpenYear, setNoOpenYear] = useState(false)
  const [categories, setCategories] = useState([])     // active categories w/ nominees
  const [picks,      setPicks]      = useState({})     // category_id -> guess string
  const [ballot,     setBallot]     = useState(null)   // my oscar_ballots row
  const [runtimeIn,  setRuntimeIn]  = useState('')
  const [monoIn,     setMonoIn]     = useState('')
  const [tbDirty,    setTbDirty]    = useState(false)
  const [progress,   setProgress]   = useState([])     // both players, counts only
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  useEffect(() => { if (me) load() }, [me])

  async function load() {
    setLoading(true); setError(null)
    try {
      const { data: yr, error: yErr } = await supabase
        .from('oscar_years').select('*')
        .in('status', ['ballots', 'locked'])
        .order('year', { ascending: false })
        .limit(1).maybeSingle()
      if (yErr) throw yErr
      if (!yr) { setNoOpenYear(true); setLoading(false); return }
      setYearRow(yr)

      const [{ data: cats, error: cErr }, { data: noms, error: nErr },
             { data: myGuesses, error: gErr }, { data: myBallot, error: bErr },
             { data: prog, error: pErr }] = await Promise.all([
        supabase.from('oscar_categories').select('*').order('display_order'),
        supabase.from('oscar_nominees').select('category_id, nominee_name, display_order')
          .eq('year_id', yr.id).order('display_order'),
        supabase.from('oscar_guesses').select('category_id, guess, locked')
          .eq('year_id', yr.id).eq('user_id', me),
        supabase.from('oscar_ballots').select('*')
          .eq('year_id', yr.id).eq('user_id', me).maybeSingle(),
        supabase.rpc('oscar_ballot_progress', { yid: yr.id }),
      ])
      if (cErr || nErr || gErr || bErr || pErr) throw (cErr || nErr || gErr || bErr || pErr)

      const nomsByCat = {}
      for (const n of noms || []) {
        if (!nomsByCat[n.category_id]) nomsByCat[n.category_id] = []
        nomsByCat[n.category_id].push(n.nominee_name)
      }
      const active = (cats || []).filter(c => {
        const from = c.active_from ?? 0
        const until = c.active_until ?? 9999
        return yr.year >= from && yr.year <= until && (nomsByCat[c.id]?.length > 0)
      }).map(c => ({ ...c, nominees: nomsByCat[c.id] }))
      setCategories(active)

      const p = {}
      for (const g of myGuesses || []) p[g.category_id] = g.guess
      setPicks(p)
      setBallot(myBallot || null)
      setRuntimeIn(runtimeInputValue(myBallot?.runtime_guess))
      setMonoIn(monologueInputValue(myBallot?.monologue_guess))
      setTbDirty(false)
      setProgress(prog || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const iAmLocked = !!ballot?.locked_at
  const readOnly = iAmLocked || yearRow?.status === 'locked'
  const other = progress.find(pr => pr.username !== myName)
  const pickedCount = Object.keys(picks).length

  // ── writes (own rows only — RLS enforces it too) ─────────────────────────
  async function setPick(catId, nominee) {
    if (readOnly || saving) return
    const prev = picks[catId]
    const clearing = prev === nominee
    setPicks(p => {
      const n = { ...p }
      if (clearing) delete n[catId]; else n[catId] = nominee
      return n
    })
    try {
      if (clearing) {
        const { error: dErr } = await supabase.from('oscar_guesses')
          .delete().match({ year_id: yearRow.id, category_id: catId, user_id: me })
        if (dErr) throw dErr
      } else {
        const { error: uErr } = await supabase.from('oscar_guesses')
          .upsert({ year_id: yearRow.id, category_id: catId, user_id: me,
                    guess: nominee, is_correct: null, locked: false },
                  { onConflict: 'year_id,category_id,user_id' })
        if (uErr) throw uErr
      }
    } catch (err) {
      console.error('Pick save failed:', err)
      setPicks(p => { const n = { ...p }; if (prev) n[catId] = prev; else delete n[catId]; return n })
      setError(`Save failed: ${err.message}`)
    }
  }

  async function saveTiebreakers() {
    if (readOnly || saving) return
    setSaving(true); setError(null)
    try {
      const { data, error: uErr } = await supabase.from('oscar_ballots')
        .upsert({ year_id: yearRow.id, user_id: me,
                  runtime_guess: toRuntimeInterval(runtimeIn),
                  monologue_guess: toMonologueInterval(monoIn) },
                { onConflict: 'year_id,user_id' })
        .select().single()
      if (uErr) throw uErr
      setBallot(data); setTbDirty(false)
    } catch (err) {
      setError(`Tiebreaker save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function lockBallot() {
    if (readOnly || saving) return
    const missing = categories.length - pickedCount
    const msg = missing > 0
      ? `Lock your ballot with ${missing} categor${missing === 1 ? 'y' : 'ies'} skipped? You can't change anything after locking.`
      : `Lock your ballot? You can't change anything after locking.`
    if (!window.confirm(msg)) return
    setSaving(true); setError(null)
    try {
      if (tbDirty) await saveTiebreakers()
      const { error: gErr } = await supabase.from('oscar_guesses')
        .update({ locked: true }).eq('year_id', yearRow.id).eq('user_id', me)
      if (gErr) throw gErr
      const { data: b, error: bErr } = await supabase.from('oscar_ballots')
        .upsert({ year_id: yearRow.id, user_id: me,
                  runtime_guess: toRuntimeInterval(runtimeIn),
                  monologue_guess: toMonologueInterval(monoIn),
                  locked_at: new Date().toISOString() },
                { onConflict: 'year_id,user_id' })
        .select().single()
      if (bErr) throw bErr
      setBallot(b)
      // both locked? → year advances to 'locked'
      const { data: prog } = await supabase.rpc('oscar_ballot_progress', { yid: yearRow.id })
      setProgress(prog || [])
      const bothLocked = (prog || []).length === 2 && (prog || []).every(pr => pr.locked_at)
      if (bothLocked) {
        await supabase.from('oscar_years').update({ status: 'locked' }).eq('id', yearRow.id)
        setYearRow(y => ({ ...y, status: 'locked' }))
      }
    } catch (err) {
      setError(`Lock failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── grouped categories ────────────────────────────────────────────────────
  const groups = useMemo(() => (
    GROUP_ORDER
      .map(g => ({ name: g, cats: categories.filter(c => groupOf(c.name) === g) }))
      .filter(g => g.cats.length > 0)
  ), [categories])

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">OPENING YOUR BALLOT…</span>
    </div>
  )

  if (noOpenYear) return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="font-display text-3xl text-white tracking-wide mb-3">NO OPEN BALLOT</p>
      <p className="text-gray-400 text-sm mb-6">
        Ballots open once a new ceremony's nominees are saved.
      </p>
      <Link to="/oscars" className="btn-gold text-sm px-5">← Back to Ceremonies</Link>
    </div>
  )

  const otherLabel = other?.username === 'matt' ? 'HERMZ' : 'DUST'
  const bothLocked = yearRow.status === 'locked'

  return (
    <div>
      {/* Hero */}
      <FilmStill title={`Hermz and D Ballot ${yearRow.year}`} hue={yearHue(yearRow.year)} mood="cool"
                 className="w-full h-[180px] sm:h-[220px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/oscars" className="font-mono text-[11px] tracking-kicker text-gold-500
                                          hover:text-gold-400 transition-colors flex items-center gap-2">
              <OscarIcon size={12} /> OSCARS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white">{yearRow.year} · MY BALLOT</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-white tracking-wide leading-none">
            {iAmLocked ? 'BALLOT LOCKED' : 'MY BALLOT'}
          </h1>
          <p className="font-serif italic text-gray-400 mt-2 text-base">
            {iAmLocked
              ? bothLocked ? 'Both ballots are in. The reveal awaits.' : `Waiting on ${otherLabel === 'HERMZ' ? 'Hermz' : 'Dust'}…`
              : 'Your picks are sealed from each other until the reveal.'}
          </p>
        </div>
      </FilmStill>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Sticky progress strip */}
        <div className="sticky top-14 z-30 -mx-2 px-2 py-3 bg-night-950/90 backdrop-blur-md rounded-b-xl
                        flex items-center gap-3 flex-wrap border-b border-night-700/60 mb-6">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-white leading-none">{pickedCount}</span>
            <span className="font-mono text-xs text-gray-400 tracking-kicker">/ {categories.length} PICKS</span>
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-night-700 overflow-hidden min-w-[80px]">
            <div className="h-full bg-gold-500 transition-all"
                 style={{ width: `${categories.length ? (pickedCount / categories.length) * 100 : 0}%` }} />
          </div>
          <span className={`font-mono text-xs tracking-kicker px-2.5 py-1 rounded-full border ${
            other?.locked_at
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40'
              : 'text-gray-400 bg-night-800 border-night-600'
          }`}>
            {otherLabel} {other?.locked_at ? '🔒 LOCKED' : '· FILLING IN'}
          </span>
          {!readOnly && (
            <button onClick={lockBallot} disabled={saving || pickedCount === 0}
                    className="btn-gold text-sm px-5 disabled:opacity-40">
              {saving ? 'Locking…' : '🔒 Lock Ballot'}
            </button>
          )}
          {iAmLocked && (
            <span className="font-mono text-xs tracking-kicker text-gold-400 px-2.5 py-1 rounded-full
                             bg-gold-500/10 border border-gold-500/40">🔒 LOCKED</span>
          )}
        </div>

        {/* Tiebreakers */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="font-mono text-sm tracking-cinema text-cinema-400 uppercase">Tiebreakers</span>
            {!readOnly && tbDirty && (
              <button onClick={saveTiebreakers} disabled={saving}
                      className="text-xs px-3 py-1.5 rounded-lg bg-cinema-500/15 border border-cinema-500/40
                                 text-cinema-400 font-medium hover:bg-cinema-500/20 transition-colors">
                {saving ? '⏳ Saving…' : '💾 Save Tiebreakers'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] tracking-kicker text-gray-300 uppercase mb-1.5">
                Ceremony Runtime Guess (H:MM)
              </label>
              <input type="text" value={runtimeIn} placeholder="3:30" disabled={readOnly}
                     onChange={e => { setRuntimeIn(e.target.value); setTbDirty(true) }}
                     className="input w-full text-sm disabled:opacity-50" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-kicker text-gray-300 uppercase mb-1.5">
                Opening Monologue Guess (M:SS)
              </label>
              <input type="text" value={monoIn} placeholder="12:30" disabled={readOnly}
                     onChange={e => { setMonoIn(e.target.value); setTbDirty(true) }}
                     className="input w-full text-sm disabled:opacity-50" />
            </div>
          </div>
          <p className="font-mono text-[10px] tracking-kicker text-gray-400 mt-2">
            RUNTIME BREAKS TIED SCORES · MONOLOGUE IS THE BACKUP
          </p>
        </div>

        {/* Category groups */}
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.name}>
              <div className="flex items-center gap-3 pb-2 mb-4 border-b border-night-700/60">
                <span className="font-mono text-sm tracking-cinema text-gold-500 uppercase">
                  {GROUP_META[group.name] || group.name}
                </span>
                <span className="flex-1 h-px bg-night-700/60" />
                <span className="font-mono text-sm tracking-kicker text-gray-500">
                  {group.cats.filter(c => picks[c.id]).length}/{group.cats.length} picked
                </span>
              </div>
              <div className="space-y-3">
                {group.cats.map(cat => (
                  <div key={cat.id} className="rounded-xl border border-night-700/60 bg-night-800/40 overflow-hidden">
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-sm tracking-cinema text-gold-500 uppercase">
                        {cat.name.replace(/^Best\s+/i, '')}
                      </span>
                      {picks[cat.id]
                        ? <span className="font-mono text-[10px] tracking-kicker text-emerald-400">✓ PICKED</span>
                        : <span className="font-mono text-[10px] tracking-kicker text-gray-500">NO GUESS</span>}
                    </div>
                    <div className="px-4 pb-4 flex flex-wrap gap-2">
                      {cat.nominees.map(name => {
                        const selected = picks[cat.id] === name
                        return (
                          <button key={name} type="button" onClick={() => setPick(cat.id, name)}
                                  disabled={readOnly}
                                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors disabled:cursor-default ${
                                    selected
                                      ? 'text-gold-400 font-semibold bg-gold-500/10 ring-1 ring-gold-500/40'
                                      : readOnly
                                        ? 'text-gray-600 bg-night-800/60'
                                        : 'text-gray-300 bg-night-700/50 hover:bg-night-700 hover:text-gray-100'
                                  }`}>
                            {selected && <span className="mr-1">★</span>}{name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom lock */}
        {!readOnly && (
          <div className="mt-8 flex justify-end">
            <button onClick={lockBallot} disabled={saving || pickedCount === 0}
                    className="btn-gold text-sm px-6 disabled:opacity-40">
              {saving ? 'Locking…' : '🔒 Lock Ballot'}
            </button>
          </div>
        )}
        {iAmLocked && (
          <div className="mt-8 text-center">
            <p className="font-serif italic text-gray-400">
              {bothLocked ? 'Both ballots locked. See you at the reveal.' : 'Your ballot is in. No peeking allowed.'}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              {bothLocked && (
                <Link to="/oscars/reveal" className="btn-gold text-xs px-4">🎭 The Reveal Ceremony →</Link>
              )}
              <Link to={`/oscars/${yearRow.year}`} className="btn-ghost text-xs">
                View the ceremony page →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
