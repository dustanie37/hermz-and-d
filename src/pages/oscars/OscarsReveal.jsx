// src/pages/oscars/OscarsReveal.jsx
// Phase 13d — The Guess Reveal Ceremony (per-person reveal, 2026-07-16).
// Opens once both ballots are locked. Categories come up one at a time; within
// each, EACH player's pick is its own sealed card you tap to unseal — so you
// never see both at once. Reveals go through the SECURITY DEFINER
// oscar_reveal_pick() so strict RLS holds. Realtime + polling keep both phones
// in sync; the ledger lives in the DB so progress survives closed tabs.

import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'
import { revealSequence, groupOf, fmtRuntime, fmtMonologue } from '../../lib/oscarSeason'

const PEOPLE = ['matt', 'dustin']   // HERMZ (gold, left) · DUST (film, right)
const MAJOR_GROUP = 'Major Awards'  // the 8 marquee categories — always revealed last, building to Best Picture

function yearHue(y) { return ((y * 17) + 11) % 360 }
function shortName(name) { return name.replace(/^Best\s+/i, '').replace(/^Achievement in\s+/i, '') }

export default function OscarsReveal() {
  const [yearRow,  setYearRow]  = useState(null)
  const [noneOpen, setNoneOpen] = useState(false)
  const [cats,     setCats]     = useState([])   // active categories w/ field size
  const [reveals,  setReveals]  = useState([])   // ledger rows (with username)
  const [picks,    setPicks]    = useState({})   // category_id -> { matt, dustin } (revealed only)
  const [ballots,  setBallots]  = useState([])   // finale tiebreakers (visible at revealed)
  const [posterMap,setPosterMap]= useState({})
  const [ids,      setIds]      = useState({})   // username -> user_id
  const [spotId,   setSpotId]   = useState(null) // category id in the spotlight (user-pickable)
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState(null)  // `${catId}:${username}` while unsealing
  const [error,    setError]    = useState(null)
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

      const [{ data: allCats, error: cErr }, { data: noms, error: nErr }, { data: profs }] = await Promise.all([
        supabase.from('oscar_categories').select('*').order('display_order'),
        supabase.from('oscar_nominees').select('category_id').eq('year_id', yr.id),
        supabase.from('profiles').select('id, username').in('username', PEOPLE),
      ])
      if (cErr || nErr) throw (cErr || nErr)
      const fieldSize = {}
      for (const n of noms || []) fieldSize[n.category_id] = (fieldSize[n.category_id] || 0) + 1
      setCats((allCats || []).filter(c => fieldSize[c.id]).map(c => ({ ...c, fieldSize: fieldSize[c.id] })))
      const idMap = {}
      for (const p of profs || []) idMap[p.username] = p.id
      setIds(idMap)

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
      supabase.from('oscar_reveals').select('*, profiles(username)').eq('year_id', yr.id).order('revealed_at'),
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

  // category_id -> Set of usernames whose pick is unsealed
  const revealedBy = useMemo(() => {
    const m = {}
    for (const r of reveals) {
      const u = r.profiles?.username
      if (!u) continue
      ;(m[r.category_id] ||= new Set()).add(u)
    }
    return m
  }, [reveals])

  const isRevealed = (catId, who) => !!revealedBy[catId]?.has(who)
  const isFull = (cat) => PEOPLE.every(who => isRevealed(cat.id, who))

  // categories still needing at least one card unsealed, in the default build order
  const remaining = useMemo(() => sequence.filter(c => !isFull(c)), [sequence, revealedBy])

  // Default the spotlight to the first still-sealed category; either of you can pick another.
  useEffect(() => {
    if (spotId === null && remaining.length) setSpotId(remaining[0].id)
  }, [remaining, spotId])

  const completedCats = useMemo(() => sequence.filter(isFull), [sequence, revealedBy])
  const agreeCount = useMemo(() => completedCats.filter(c => {
    const p = picks[c.id] || {}; return p.matt && p.dustin && p.matt === p.dustin
  }).length, [completedCats, picks])
  const splitCount = completedCats.length - agreeCount

  async function revealPick(cat, who) {
    const uid = ids[who]
    const key = `${cat.id}:${who}`
    if (!uid || busy || isRevealed(cat.id, who)) return
    setBusy(key)
    try {
      const { error: rpcErr } = await supabase
        .rpc('oscar_reveal_pick', { yid: yearRow.id, cid: cat.id, uid })
      if (rpcErr) throw rpcErr
      await refresh()
    } catch (err) {
      setError(`Reveal failed: ${err.message}`)
    } finally {
      setBusy(null)
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
  const progress = cats.length ? (completedCats.length / cats.length) * 100 : 0
  const nonMajorLeft = remaining.filter(c => groupOf(c) !== MAJOR_GROUP)
  const majorLeft    = remaining.filter(c => groupOf(c) === MAJOR_GROUP)   // sequence order = build to Best Picture
  const majorsUnlocked = nonMajorLeft.length === 0
  let spotCat = done ? null : (cats.find(c => c.id === spotId) || remaining[0] || null)
  // the Major 8 are reserved for the finale — never spotlight one while lesser categories remain
  if (spotCat && groupOf(spotCat) === MAJOR_GROUP && !majorsUnlocked) spotCat = nonMajorLeft[0] || spotCat
  const spotFull = spotCat ? isFull(spotCat) : false
  const suggested = remaining.find(c => c.id !== spotCat?.id) || null  // next, respecting the build order
  const boardCats = [...completedCats].reverse().filter(c => c.id !== spotCat?.id)

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
          <p className="font-sans text-gray-400 mt-2 text-base">
            {done ? 'Every pick is on the table. See you on ceremony night.' : 'Unseal one pick at a time — reveal the categories in any order you like.'}
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
            {done ? `ALL ${cats.length} CATEGORIES REVEALED` : `CATEGORY ${Math.min(completedCats.length + 1, cats.length)} OF ${cats.length}`}
          </span>
          <span className="font-mono text-xs tracking-kicker text-gray-400">
            AGREED {agreeCount} · SPLIT {splitCount}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-night-700 overflow-hidden mb-8">
          <div className="h-full bg-gold-500 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>

        {/* spotlight — the category in play, one sealed card per player */}
        {spotCat && (
          <div className="mb-8">
            <div className="text-center mb-4">
              <div className="font-mono text-sm tracking-cinema text-gold-500 uppercase">{shortName(spotCat.name)}</div>
              <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1">
                {groupOf(spotCat)?.toUpperCase()} · {spotCat.fieldSize} NOMINEES IN THE FIELD
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PEOPLE.map(who => (
                <RevealCard
                  key={who}
                  who={who}
                  revealed={isRevealed(spotCat.id, who)}
                  pick={picks[spotCat.id]?.[who]}
                  poster={posterMap[picks[spotCat.id]?.[who]]}
                  busy={busy === `${spotCat.id}:${who}`}
                  onReveal={() => revealPick(spotCat, who)}
                />
              ))}
            </div>

            {/* flourish + advance, only once BOTH are unsealed */}
            {spotFull && (
              <div className="flex flex-col items-center gap-3 mt-5">
                <Flourish same={picks[spotCat.id]?.matt && picks[spotCat.id]?.matt === picks[spotCat.id]?.dustin} />
                {suggested ? (
                  <button onClick={() => setSpotId(suggested.id)} className="btn-gold text-base px-8 py-3">
                    On to {shortName(suggested.name)} →
                  </button>
                ) : (
                  <span className="font-mono text-[10px] tracking-kicker text-gray-500">Unseal the last card for the finale…</span>
                )}
              </div>
            )}
            {!spotFull && (
              <p className="text-center font-mono text-[10px] tracking-kicker text-gray-500 mt-4">
                TAP EACH CARD TO UNSEAL — ONE PICK AT A TIME
              </p>
            )}
          </div>
        )}

        {/* category picker — free-pick the lesser categories; the Major 8 stay locked for the finale */}
        {!done && remaining.length > 0 && (
          <CategoryPicker
            nonMajor={nonMajorLeft}
            major={majorLeft}
            majorsUnlocked={majorsUnlocked}
            revealedBy={revealedBy}
            currentId={spotCat?.id}
            onPick={setSpotId}
          />
        )}

        {/* finale */}
        {done && <Finale yearRow={yearRow} ballots={ballots} agreeCount={agreeCount} splitCount={splitCount} total={cats.length} />}

        {/* the board so far */}
        {boardCats.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-3 pb-2 mb-4 border-b border-night-700/60">
              <span className="font-mono text-sm tracking-cinema text-gold-500 uppercase">The Board So Far</span>
              <span className="flex-1 h-px bg-night-700/60" />
              <span className="font-mono text-sm tracking-kicker text-gray-500">{completedCats.length} revealed</span>
            </div>
            <div className="space-y-1.5">
              {boardCats.map(cat => {
                const p = picks[cat.id] || {}
                const same = p.matt && p.dustin && p.matt === p.dustin
                return (
                  <div key={cat.id}
                       className={`grid grid-cols-[1fr_auto_1fr] gap-3 items-center rounded-lg px-3 py-2 ${
                         same ? 'bg-emerald-500/[0.06] border border-emerald-500/20' : 'bg-night-800/40'
                       }`}>
                    <span className="text-sm text-gold-400 text-right truncate">{p.matt || '— no guess —'}</span>
                    <span className={`font-mono text-[10px] tracking-kicker text-center whitespace-nowrap ${
                      same ? 'text-emerald-400' : 'text-gray-500'
                    }`}>
                      {shortName(cat.name).toUpperCase()} · {same ? 'SAME' : 'SPLIT'}
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

// ── category picker: free-pick the lesser categories; Major 8 locked for the finale ─
function CategoryPicker({ nonMajor, major, majorsUnlocked, revealedBy, currentId, onPick }) {
  const chipClass = (c, clickable) => {
    const isCurrent = c.id === currentId
    const base = 'px-3 py-1.5 rounded-full border font-mono text-[11px] tracking-kicker transition-colors'
    if (isCurrent) return `${base} border-gold-500/70 bg-gold-500/10 text-gold-300`
    if (clickable) return `${base} border-night-600 text-gray-300 hover:border-gold-500/50 hover:text-white`
    return `${base} border-night-700 text-gray-500`
  }
  const label = (c) => {
    const opened = revealedBy[c.id]?.size || 0
    return (
      <>{shortName(c.name).toUpperCase()}{opened === 1 && <span className="ml-1.5 text-cinema-400">◐ 1/2</span>}</>
    )
  }
  const Head = ({ title, right }) => (
    <div className="flex items-center gap-3 pb-2 mb-3 border-b border-night-700/60">
      <span className="font-mono text-sm tracking-cinema text-gold-500 uppercase">{title}</span>
      <span className="flex-1 h-px bg-night-700/60" />
      <span className="font-mono text-sm tracking-kicker text-gray-500">{right}</span>
    </div>
  )
  return (
    <div className="mb-10 space-y-6">
      {nonMajor.length > 0 && (
        <div>
          <Head title="Up Next — Pick Any Order" right={`${nonMajor.length} left`} />
          <div className="flex flex-wrap gap-2">
            {nonMajor.map(c => (
              <button key={c.id} onClick={() => onPick(c.id)} className={chipClass(c, true)}>{label(c)}</button>
            ))}
          </div>
        </div>
      )}
      {major.length > 0 && (
        <div>
          <Head title="The Majors — Building to Best Picture" right={majorsUnlocked ? 'in order' : 'locked'} />
          <div className="flex flex-wrap gap-2">
            {major.map(c => (
              <span key={c.id} className={chipClass(c, false)}>{label(c)}</span>
            ))}
          </div>
          {!majorsUnlocked && (
            <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2">
              🔒 REVEALED LAST — FINISH THE OTHER CATEGORIES FIRST
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── a single player's card: sealed → tap → unsealed pick ────────────────────
function RevealCard({ who, revealed, pick, poster, busy, onReveal }) {
  const gold = who === 'matt'
  const label = gold ? 'HERMZ' : 'DUST'
  const accent = gold ? 'text-gold-500' : 'text-film-500'
  const border = gold ? 'border-gold-500/40' : 'border-film-500/40'

  if (!revealed) {
    return (
      <button
        onClick={onReveal}
        disabled={busy}
        className={`group w-full rounded-xl border border-dashed ${border} bg-night-800/40 hover:bg-night-800/70
                    p-5 text-center transition-colors disabled:opacity-60 min-h-[168px] flex flex-col items-center justify-center gap-3`}>
        <span className={`font-mono text-[11px] tracking-cinema uppercase ${accent}`}>{label}’s pick</span>
        <span className="font-display text-2xl text-gray-500 group-hover:text-gray-300 tracking-wide transition-colors">
          {busy ? 'UNSEALING…' : 'SEALED'}
        </span>
        <span className="font-mono text-[10px] tracking-kicker text-gray-600">TAP TO UNSEAL</span>
      </button>
    )
  }
  return (
    <div className={`rounded-xl border ${border} bg-night-800/60 p-5 text-center min-h-[168px] flex flex-col items-center justify-center`}>
      <div className={`font-mono text-[11px] tracking-cinema uppercase mb-3 ${accent}`}>{label} PICKS</div>
      {poster && (
        <img src={poster} alt="" className="w-16 h-24 object-cover rounded-md mx-auto mb-3 border border-white/10" />
      )}
      <div className="font-display text-2xl text-white tracking-wide leading-tight">
        {(pick || 'NO GUESS').toUpperCase()}
      </div>
    </div>
  )
}

function Flourish({ same }) {
  return same ? (
    <span className="font-mono text-[11px] tracking-kicker text-emerald-400 px-4 py-1.5 rounded-full
                     bg-emerald-500/10 border border-emerald-500/40">
      ✨ GREAT MINDS — SAME PICK
    </span>
  ) : (
    <span className="font-mono text-[11px] tracking-kicker text-cinema-400 px-4 py-1.5 rounded-full
                     bg-cinema-500/10 border border-cinema-500/40">
      ⚔ SPLIT DECISION
    </span>
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
