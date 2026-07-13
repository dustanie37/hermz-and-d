// src/pages/oscars/OscarsReveal.jsx
// Phase 13d — The Guess Reveal Ceremony (layout approved 2026-07-11).
// Opens once both ballots are locked. Categories reveal one at a time, building
// to Best Picture; either player can tap; reveals go through the SECURITY DEFINER
// oscar_reveal_category() so strict RLS holds. Realtime + polling keep devices
// in sync; the ledger lives in the DB so progress survives closed tabs.

import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'
import { revealSequence, GROUP_META, groupOf, fmtRuntime, fmtMonologue } from '../../lib/oscarSeason'

function yearHue(y) { return ((y * 17) + 11) % 360 }

export default function OscarsReveal() {
  const [yearRow,   setYearRow]   = useState(null)
  const [noneOpen,  setNoneOpen]  = useState(false)
  const [cats,      setCats]      = useState([])   // active categories w/ field size
  const [reveals,   setReveals]   = useState([])   // ledger rows
  const [picks,     setPicks]     = useState({})   // category_id -> {matt, dustin}
  const [ballots,   setBallots]   = useState([])   // finale tiebreakers (visible at revealed)
  const [posterMap, setPosterMap] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [revealing, setRevealing] = useState(false)
  const [error,     setError]     = useState(null)
  const yearRef = useRef(null)

  useEffect(() => { load() }, [])

  // realtime + polling while locked
  useEffect(() => {
    if (!yearRow || yearRow.status !== 'locked') return
    const channel = supabase
      .channel(`oscar-reveal-${yearRow.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'oscar_reveals', filter: `year_id=eq.${yearRow.id}` },
        () => refresh())
      .subscribe()
    const poll = setInterval(() => refresh(), 10000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [yearRow?.id, yearRow?.status])

  async function load() {
    setLoading(true); setError(null)
    try {
      const { data: yr, error: yErr } = await supabase
        .from('oscar_years').select('*')
        .in('status', ['locked', 'revealed'])
        .order('year', { ascending: false })
        .limit(1).maybeSingle()
      if (yErr) throw yErr
      if (!yr) { setNoneOpen(true); setLoading(false); return }
      yearRef.current = yr
      setYearRow(yr)

      const [{ data: allCats, error: cErr }, { data: noms, error: nErr }] = await Promise.all([
        supabase.from('oscar_categories').select('*').order('display_order'),
        supabase.from('oscar_nominees').select('category_id').eq('year_id', yr.id),
      ])
      if (cErr || nErr) throw (cErr || nErr)
      const fieldSize = {}
      for (const n of noms || []) fieldSize[n.category_id] = (fieldSize[n.category_id] || 0) + 1
      setCats((allCats || []).filter(c => fieldSize[c.id]).map(c => ({ ...c, fieldSize: fieldSize[c.id] })))

      await refresh(yr)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function refresh(yrArg) {
    const yr = yrArg || yearRef.current
    if (!yr) return
    const [{ data: rev }, { data: pk }] = await Promise.all([
      supabase.from('oscar_reveals').select('*').eq('year_id', yr.id).order('revealed_at'),
      supabase.rpc('oscar_revealed_picks', { yid: yr.id }),
    ])
    setReveals(rev || [])
    const map = {}
    for (const p of pk || []) {
      if (!map[p.category_id]) map[p.category_id] = {}
      map[p.category_id][p.username] = p.guess
    }
    setPicks(map)
    // posters for anything revealed
    const names = [...new Set((pk || []).map(p => p.guess))]
    if (names.length) {
      const { data: films } = await supabase.from('films').select('title, poster_url').in('title', names)
      const pmap = {}
      for (const f of films || []) if (f.poster_url) pmap[f.title] = f.poster_url
      setPosterMap(prev => ({ ...prev, ...pmap }))
    }
    // year may have flipped to revealed (possibly from the other device)
    const { data: freshYear } = await supabase.from('oscar_years').select('*').eq('id', yr.id).single()
    if (freshYear) {
      yearRef.current = freshYear
      setYearRow(freshYear)
      if (freshYear.status === 'revealed') {
        const { data: b } = await supabase
          .from('oscar_ballots').select('*, profiles(username)').eq('year_id', yr.id)
        setBallots(b || [])
      }
    }
  }

  const sequence = useMemo(() => revealSequence(cats), [cats])
  const revealedIds = useMemo(() => new Set(reveals.map(r => r.category_id)), [reveals])
  const next = sequence.find(c => !revealedIds.has(c.id))
  const lastReveal = reveals.length ? reveals[reveals.length - 1] : null
  const spotlight = lastReveal ? cats.find(c => c.id === lastReveal.category_id) : null

  const agreeCount = useMemo(() => Object.values(picks)
    .filter(p => p.matt && p.dustin && p.matt === p.dustin).length, [picks])
  const splitCount = Object.keys(picks).length - agreeCount

  async function revealNext() {
    if (!next || revealing) return
    setRevealing(true)
    try {
      const { data, error: rpcErr } = await supabase
        .rpc('oscar_reveal_category', { yid: yearRow.id, cid: next.id })
      if (rpcErr) throw rpcErr
      if (data === 'not_locked') await refresh()
      else await refresh()
    } catch (err) {
      setError(`Reveal failed: ${err.message}`)
    } finally {
      setRevealing(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">DIMMING THE LIGHTS…</span>
    </div>
  )

  if (noneOpen) return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="font-display text-3xl text-white tracking-wide mb-3">NO REVEAL PENDING</p>
      <p className="text-gray-400 text-sm mb-6">The ceremony opens once both ballots are locked.</p>
      <Link to="/oscars" className="btn-gold text-sm px-5">← Back to Ceremonies</Link>
    </div>
  )

  const done = yearRow.status === 'revealed'
  const progress = cats.length ? (reveals.length / cats.length) * 100 : 0
  const boardRows = [...reveals].reverse()
    .filter(r => !spotlight || done || r.category_id !== spotlight.id)

  return (
    <div>
      <FilmStill title={`Hermz and D Reveal ${yearRow.year}`} hue={yearHue(yearRow.year)} mood="warm"
                 className="w-full h-[180px] sm:h-[220px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/oscars" className="font-mono text-[11px] tracking-kicker text-gold-500
                                          hover:text-gold-400 transition-colors flex items-center gap-2">
              <OscarIcon size={12} /> OSCARS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white">{yearRow.year} · THE REVEAL</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-white tracking-wide leading-none">
            {done ? 'ALL BALLOTS UNSEALED' : 'THE REVEAL CEREMONY'}
          </h1>
          <p className="font-serif text-gray-400 mt-2 text-base">
            {done ? 'Every pick is on the table. See you on ceremony night.' : 'Two ballots. One category at a time. Building to Best Picture.'}
          </p>
        </div>
      </FilmStill>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* progress strip */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <span className="font-display text-2xl text-white tracking-wide">
            {done ? `ALL ${cats.length} CATEGORIES REVEALED` : `CATEGORY ${Math.min(reveals.length + 1, cats.length)} OF ${cats.length}`}
          </span>
          <span className="font-mono text-xs tracking-kicker text-gray-400">
            AGREED {agreeCount} · SPLIT {splitCount}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-night-700 overflow-hidden mb-8">
          <div className="h-full bg-gold-500 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>

        {/* spotlight — the most recent reveal */}
        {spotlight && !done && (
          <Spotlight cat={spotlight} picks={picks[spotlight.id] || {}} posterMap={posterMap} />
        )}

        {/* reveal CTA */}
        {!done && next && (
          <div className="flex flex-col items-center gap-2 mb-10">
            <button onClick={revealNext} disabled={revealing}
                    className="btn-gold text-base px-8 py-3 disabled:opacity-50">
              {revealing ? 'Unsealing…'
                : reveals.length === 0 ? `🎬 Begin — Reveal ${shortName(next.name)}`
                : `On to ${shortName(next.name)} →`}
            </button>
            <span className="font-mono text-[10px] tracking-kicker text-gray-500">
              {GROUP_META[groupOf(next.name)]?.toUpperCase()} · {next.fieldSize} IN THE FIELD
            </span>
          </div>
        )}

        {/* finale */}
        {done && <Finale yearRow={yearRow} ballots={ballots} agreeCount={agreeCount} splitCount={splitCount} total={cats.length} />}

        {/* the board so far */}
        {boardRows.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-3 pb-2 mb-4 border-b border-night-700/60">
              <span className="font-mono text-sm tracking-cinema text-gold-500 uppercase">The Board So Far</span>
              <span className="flex-1 h-px bg-night-700/60" />
              <span className="font-mono text-sm tracking-kicker text-gray-500">{reveals.length} revealed</span>
            </div>
            <div className="space-y-1.5">
              {boardRows.map(r => {
                const cat = cats.find(c => c.id === r.category_id)
                const p = picks[r.category_id] || {}
                const same = p.matt && p.dustin && p.matt === p.dustin
                return (
                  <div key={r.id}
                       className={`grid grid-cols-[1fr_auto_1fr] gap-3 items-center rounded-lg px-3 py-2 ${
                         same ? 'bg-emerald-500/[0.06] border border-emerald-500/20' : 'bg-night-800/40'
                       }`}>
                    <span className="text-sm text-gold-400 text-right truncate">{p.matt || '— no guess —'}</span>
                    <span className={`font-mono text-[10px] tracking-kicker text-center whitespace-nowrap ${
                      same ? 'text-emerald-400' : 'text-gray-500'
                    }`}>
                      {shortName(cat?.name || '').toUpperCase()} · {same ? 'SAME' : 'SPLIT'}
                    </span>
                    <span className="text-sm text-film-400 truncate">{p.dustin || '— no guess —'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function shortName(name) { return name.replace(/^Best\s+/i, '').replace(/^Achievement in\s+/i, '') }

// ── spotlight: two pick cards + flourish ─────────────────────────────────────
function Spotlight({ cat, picks, posterMap }) {
  const same = picks.matt && picks.dustin && picks.matt === picks.dustin
  return (
    <div className="mb-8">
      <div className="text-center mb-4">
        <div className="font-mono text-sm tracking-cinema text-gold-500 uppercase">{shortName(cat.name)}</div>
        <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1">
          {GROUP_META[groupOf(cat.name)]?.toUpperCase()} · {cat.fieldSize} NOMINEES IN THE FIELD
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PickCard who="matt"   pick={picks.matt}   poster={posterMap[picks.matt]} />
        <PickCard who="dustin" pick={picks.dustin} poster={posterMap[picks.dustin]} />
      </div>
      <div className="text-center mt-4">
        {same ? (
          <span className="font-mono text-[11px] tracking-kicker text-emerald-400 px-4 py-1.5 rounded-full
                           bg-emerald-500/10 border border-emerald-500/40">
            ✨ GREAT MINDS — SAME PICK
          </span>
        ) : (
          <span className="font-mono text-[11px] tracking-kicker text-cinema-400 px-4 py-1.5 rounded-full
                           bg-cinema-500/10 border border-cinema-500/40">
            ⚔ SPLIT DECISION
          </span>
        )}
      </div>
    </div>
  )
}

function PickCard({ who, pick, poster }) {
  const gold = who === 'matt'
  return (
    <div className={`rounded-xl border bg-night-800/60 p-5 text-center ${
      gold ? 'border-gold-500/40' : 'border-film-500/40'
    }`}>
      <div className={`font-mono text-[11px] tracking-cinema uppercase mb-3 ${gold ? 'text-gold-500' : 'text-film-500'}`}>
        {gold ? 'HERMZ PICKS' : 'DUST PICKS'}
      </div>
      {poster && (
        <img src={poster} alt="" className="w-16 h-24 object-cover rounded-md mx-auto mb-3 border border-white/10" />
      )}
      <div className="font-display text-2xl text-white tracking-wide leading-tight">
        {(pick || 'NO GUESS').toUpperCase()}
      </div>
    </div>
  )
}

// ── finale: tiebreakers unsealed + handoff to ceremony night ────────────────
function Finale({ yearRow, ballots, agreeCount, splitCount, total }) {
  const byUser = {}
  for (const b of ballots) byUser[b.profiles?.username] = b
  return (
    <div className="mb-10">
      <div className="rounded-xl border border-gold-500/40 bg-gold-500/[0.06] p-6 text-center mb-6">
        <p className="font-display text-3xl text-white tracking-wide mb-2">THE ENVELOPES ARE EMPTY</p>
        <p className="text-sm text-gray-300">
          {agreeCount} of {total} categories picked the same · {splitCount} split decisions to settle on ceremony night.
        </p>
      </div>

      <div className="card mb-6">
        <div className="font-mono text-sm tracking-cinema text-cinema-400 uppercase mb-4 text-center">
          Tiebreakers · Unsealed
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg p-4 bg-night-700/60">
            <div className="font-mono text-[10px] tracking-kicker text-gold-500 mb-1">HERMZ RUNTIME</div>
            <div className="font-display text-2xl text-white tracking-wide">{fmtRuntime(byUser.matt?.runtime_guess)}</div>
            <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2">MONOLOGUE {fmtMonologue(byUser.matt?.monologue_guess)}</div>
          </div>
          <div className="rounded-lg p-4 bg-night-700/60">
            <div className="font-mono text-[10px] tracking-kicker text-film-500 mb-1">DUST RUNTIME</div>
            <div className="font-display text-2xl text-white tracking-wide">{fmtRuntime(byUser.dustin?.runtime_guess)}</div>
            <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2">MONOLOGUE {fmtMonologue(byUser.dustin?.monologue_guess)}</div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link to={`/oscars/${yearRow.year}`} className="btn-gold text-sm px-6">
          🏆 To the Ceremony Page — winners go in live →
        </Link>
      </div>
    </div>
  )
}
