// MoviesCeremony.jsx — Phase 12f: THE REVEAL CEREMONY
//
// Countdown from #list_size to #1, two reveals per rank (first revealer
// alternates; Dustin opens). Every reveal is a DB row written through the
// SECURITY DEFINER ceremony_reveal() — the other player's list leaks exactly
// one pick at a time, never earlier. All open screens stay in sync via
// Supabase realtime on event_reveals (plus a polling fallback), so it works
// on one shared screen or two devices. Progress lives in the DB: close the
// tab, come back next week, the countdown resumes.
// When #1 lands, the event flips to 'revealed' and the finale plays: the new
// combined list, generated live, seen for the first time.
// Layout per the approved mockup (scope §8 + STYLESHEET ceremony patterns).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import FilmStill from '../../components/FilmStill'
import { totalOf, TEN_FIELDS, IMPACT } from '../../lib/eventScoring'
import { TestBadge } from './MoviesEventAdmin'

const CHIPS = [
  { key: 'score_direction', label: 'Dir' }, { key: 'score_screenplay', label: 'Scr' },
  { key: 'score_lead_performance', label: 'Lead' }, { key: 'score_supp_performance', label: 'Supp' },
  { key: 'score_cinematography', label: 'Cine' }, { key: 'score_production_design', label: 'Prod' },
  { key: 'score_influence', label: 'Inf' }, { key: 'score_acclaim', label: 'Acc' },
]

// ── Score chip strip ──────────────────────────────────────────────────────────

function ScoreChips({ pick }) {
  return (
    <div className="flex flex-wrap gap-1 mt-3">
      {CHIPS.map(c => (
        <span key={c.key} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-night-700 border border-night-600">
          <span className="text-gray-500">{c.label} </span>
          <span className="text-white">{pick[c.key] ?? '—'}</span>
        </span>
      ))}
      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#2a2440] border border-[#4c4370]">
        <span className="text-gray-400">Imp </span>
        <span className="text-white">{pick[IMPACT.key] ?? '—'}</span>
      </span>
      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-gold-500 text-night-950 font-bold">
        {totalOf(pick)} /100
      </span>
    </div>
  )
}

// ── Trajectory sparkline ──────────────────────────────────────────────────────

function Sparkline({ years, priorRanks, currentRank, color }) {
  const W = 150, H = 44, PAD = 7
  const points = [...years.map(y => ({ label: y, rank: priorRanks[y] ?? null })), { label: 'now', rank: currentRank }]
  const defined = points.filter(p => p.rank != null)
  const maxRank = Math.max(10, ...defined.map(p => p.rank))
  const x = i => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = r => PAD + ((r - 1) / Math.max(1, maxRank - 1)) * (H - PAD * 2)
  const path = points.map((p, i) => ({ ...p, i })).filter(p => p.rank != null)
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(' ')

  const priorsDefined = years.map(yr => priorRanks[yr]).filter(r => r != null)
  const lastPrior = priorsDefined.length ? priorsDefined[priorsDefined.length - 1] : null
  const tag = lastPrior == null
    ? { text: '★ first appearance', cls: 'text-gold-400' }
    : currentRank < lastPrior
    ? { text: `▴ rising (was #${lastPrior})`, cls: 'text-emerald-400' }
    : currentRank > lastPrior
    ? { text: `▾ falling (was #${lastPrior})`, cls: 'text-red-400' }
    : { text: `＝ holds #${lastPrior}`, cls: 'text-gray-400' }

  return (
    <div className="mt-3">
      <svg width={W} height={H} className="block">
        {defined.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />}
        {points.map((p, i) =>
          p.rank == null ? (
            <circle key={i} cx={x(i)} cy={H - PAD} r="2.5" fill="none" stroke="#3a3a55" strokeWidth="1.2" />
          ) : (
            <circle key={i} cx={x(i)} cy={y(p.rank)} r={p.label === 'now' ? 4 : 2.8}
                    fill={p.label === 'now' ? '#fcd34d' : color} />
          ),
        )}
      </svg>
      <p className={`font-mono text-[10px] tracking-kicker uppercase mt-1 ${tag.cls}`}>{tag.text}</p>
    </div>
  )
}

// ── Player reveal card ────────────────────────────────────────────────────────

function PlayerCard({ who, pick, film, onBothLists, years, priorRanks, canReveal, onReveal, revealing, sameFilmMatch }) {
  const isD = who === 'dustin'
  const border = isD ? 'border-t-film-500' : 'border-t-gold-500'
  const nameCls = isD ? 'text-film-300' : 'text-gold-300'
  const lineColor = isD ? '#6170f5' : '#f59e0b'

  return (
    <div className={`card p-5 border-t-2 ${border} ${sameFilmMatch ? 'ring-1 ring-gold-500/60 shadow-[0_0_24px_rgba(245,158,11,0.15)]' : ''}`}>
      <p className={`font-display text-lg tracking-wide leading-none mb-3 ${nameCls}`}>
        {isD ? 'DUSTIN' : 'HERMZ'}
      </p>

      {pick ? (
        <div className="flex gap-4">
          <FilmStill src={film?.poster_url} title={film?.title ?? ''}
                     className="w-24 h-36 rounded-lg border border-white/10 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl text-white tracking-wide leading-none">
              {film?.title?.toUpperCase() ?? '…'}
            </h3>
            <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-1.5">
              {film?.release_year ?? '—'}{film?.director && ` · ${film.director}`}
            </p>
            <span className={`inline-block mt-2 font-mono text-[9px] tracking-cinema uppercase px-1.5 py-px rounded border
              ${onBothLists
                ? 'bg-cinema-500/10 border-cinema-500/30 text-cinema-300'
                : isD ? 'bg-film-500/10 border-film-500/30 text-film-300' : 'bg-gold-500/10 border-gold-500/30 text-gold-300'}`}>
              {onBothLists ? 'on both lists' : isD ? 'only on D\'s list' : 'only on Hermz\'s list'}
            </span>
            <ScoreChips pick={pick} />
            <Sparkline years={years} priorRanks={priorRanks} currentRank={pick.rank} color={lineColor} />
          </div>
        </div>
      ) : (
        <div className="flex gap-4 items-center">
          <div className="w-24 h-36 rounded-lg border-2 border-dashed border-[#3a3a55] flex items-center justify-center flex-shrink-0">
            <span className="font-display text-4xl text-[#3a3a55]">?</span>
          </div>
          <div className="flex-1 text-center">
            {canReveal ? (
              <button onClick={onReveal} disabled={revealing} className="btn-gold text-sm disabled:opacity-50">
                {revealing ? 'Revealing…' : `Reveal ${isD ? 'Dustin' : 'Hermz'}'s pick`}
              </button>
            ) : (
              <p className="font-serif italic text-sm text-gray-600">waits its turn…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MoviesCeremony() {
  const { session } = useAuth()
  const user = session?.user

  const [event, setEvent]       = useState(undefined)
  const [players, setPlayers]   = useState([])
  const [profiles, setProfiles] = useState([])
  const [picks, setPicks]       = useState([])
  const [films, setFilms]       = useState({})     // id -> film
  const [history, setHistory]   = useState([])     // individual_rankings (both players)
  const [years, setYears]       = useState([])
  const [membership, setMembership] = useState({}) // film_id -> Set(user_id)
  const [finale, setFinale]     = useState(null)   // combined rows once revealed
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [revealing, setRevealing] = useState(false)
  const [stay, setStay]         = useState(null)   // pacing: hold a completed rank on screen
  const filmsRef = useRef({})

  const dustinId = useMemo(() => profiles.find(p => p.username === 'dustin')?.id, [profiles])
  const mattId   = useMemo(() => profiles.find(p => p.username === 'matt')?.id, [profiles])

  // ── fetch helpers ────────────────────────────────────────────────────────
  const fetchFilms = useCallback(async ids => {
    const missing = ids.filter(id => !filmsRef.current[id])
    if (!missing.length) return
    const { data } = await supabase
      .from('films').select('id, title, release_year, director, poster_url').in('id', missing)
    const next = { ...filmsRef.current }
    for (const f of data || []) next[f.id] = f
    filmsRef.current = next
    setFilms(next)
  }, [])

  const refresh = useCallback(async (ev) => {
    const eventId = ev?.id
    if (!eventId) return
    const [pkRes, evRes] = await Promise.all([
      supabase.rpc('ceremony_picks', { p_event_id: eventId }),
      supabase.from('ranking_events').select('*').eq('id', eventId).single(),
    ])
    if (pkRes.error) { setError(pkRes.error.message); return }
    setPicks(pkRes.data || [])
    if (evRes.data) setEvent(evRes.data)
    await fetchFilms((pkRes.data || []).map(p => p.film_id))
  }, [fetchFilms])

  // ── initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true); setError(null)
      const { data: events, error: evErr } = await supabase
        .from('ranking_events').select('*').neq('status', 'published')
        .order('created_at', { ascending: false }).limit(1)
      if (evErr) { setError(evErr.message); setLoading(false); return }
      const ev = events?.[0] ?? null
      setEvent(ev)
      if (!ev) { setLoading(false); return }

      const [plRes, prRes, poolRes, histRes, yrRes] = await Promise.all([
        supabase.from('event_players').select('*').eq('event_id', ev.id),
        supabase.from('profiles').select('id, username, display_name'),
        supabase.from('event_pool').select('user_id, film_id').eq('event_id', ev.id).eq('bucket', 'in'),
        supabase.from('individual_rankings').select('user_id, film_id, rank, ranking_events (year, status)'),
        supabase.from('ranking_events').select('year').eq('status', 'published').order('year'),
      ])
      setPlayers(plRes.data || [])
      setProfiles(prRes.data || [])
      const mem = {}
      for (const r of poolRes.data || []) {
        if (!mem[r.film_id]) mem[r.film_id] = new Set()
        mem[r.film_id].add(r.user_id)
      }
      setMembership(mem)
      setHistory((histRes.data || []).filter(h => h.ranking_events?.status === 'published'))
      setYears((yrRes.data || []).map(y => y.year))
      await refresh(ev)
      setLoading(false)
    }
    load()
  }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── realtime + polling fallback ──────────────────────────────────────────
  useEffect(() => {
    if (!event?.id || !['locked', 'revealed'].includes(event.status)) return
    const channel = supabase
      .channel(`ceremony-${event.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_reveals', filter: `event_id=eq.${event.id}` },
        () => refresh(event))
      .subscribe()
    const poll = setInterval(() => { if (event.status === 'locked') refresh(event) }, 10000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [event?.id, event?.status])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── derived ceremony state ───────────────────────────────────────────────
  const listSize = event?.list_size ?? 125
  const bothLocked = players.length >= 2 && players.every(p => p.state === 'locked')
  const ceremonyOpen = event && ['locked', 'revealed'].includes(event.status) && bothLocked

  const byRank = useMemo(() => {
    const m = new Map()
    for (const p of picks) {
      if (!m.has(p.rank)) m.set(p.rank, {})
      m.get(p.rank)[p.user_id === dustinId ? 'd' : 'h'] = p
    }
    return m
  }, [picks, dustinId])

  const currentRank = useMemo(() => {
    // partial rank first, else one below the lowest fully-revealed rank
    let partial = null, minFull = null
    for (const [rank, pair] of byRank) {
      const n = (pair.d ? 1 : 0) + (pair.h ? 1 : 0)
      if (n === 1) partial = rank
      if (n === 2) minFull = minFull == null ? rank : Math.min(minFull, rank)
    }
    if (partial != null) return partial
    const next = (minFull ?? listSize + 1) - 1
    return next < 1 ? 0 : next
  }, [byRank, listSize])

  const done = event?.status === 'revealed' || currentRank === 0
  // Pacing: hold the spotlight on a completed rank until "On to #N" —
  // `stay` is the rank being viewed; it advances only by the button (or when
  // another device reveals further ahead, in which case we catch up).
  const displayed = done ? 1 : Math.min(stay ?? currentRank, listSize)

  useEffect(() => {
    if (!loading && stay == null && currentRank > 0) setStay(currentRank)
  }, [loading, currentRank, stay])

  useEffect(() => {
    const lowest = picks.length ? Math.min(...picks.map(p => p.rank)) : null
    if (stay != null && lowest != null && lowest < stay) setStay(lowest)
  }, [picks, stay])

  const displayedPair = byRank.get(displayed) ?? {}
  const displayedComplete = !!(displayedPair.d && displayedPair.h)
  // whose turn at the displayed rank (alternate; Dustin opens the countdown)
  const dustinFirst = ((listSize - displayed) % 2) === 0
  const nextSide = displayedPair.d ? 'h' : displayedPair.h ? 'd' : (dustinFirst ? 'd' : 'h')
  const canRevealHere = !done && displayed === currentRank && !displayedComplete

  const revealCount = picks.length
  const progressPct = Math.round((revealCount / (listSize * 2)) * 100)

  async function handleReveal() {
    if (revealing) return
    setRevealing(true); setError(null)
    const { error } = await supabase.rpc('ceremony_reveal', { p_event_id: event.id })
    if (error) setError(error.message)
    await refresh(event)
    setRevealing(false)
  }

  // trajectory lookup: user -> film -> {year: rank}
  const priorFor = useCallback((uid, filmId) => {
    const out = {}
    for (const h of history) if (h.user_id === uid && h.film_id === filmId) out[h.ranking_events.year] = h.rank
    return out
  }, [history])

  // ── board rows (fully revealed ranks, best first, spotlight excluded) ────
  const boardRanks = useMemo(() => {
    const ranks = []
    for (const [rank, pair] of byRank) {
      if (pair.d && pair.h && rank !== displayed) ranks.push(rank)
    }
    return ranks.sort((a, b) => a - b)
  }, [byRank, displayed])

  // shared-film cross reference: film revealed on BOTH boards
  const filmReveals = useMemo(() => {
    const m = {}
    for (const p of picks) {
      if (!m[p.film_id]) m[p.film_id] = {}
      m[p.film_id][p.user_id === dustinId ? 'd' : 'h'] = p.rank
    }
    return m
  }, [picks, dustinId])

  // ── finale: the combined list, first light ───────────────────────────────
  useEffect(() => {
    if (event?.status !== 'revealed' || finale) return
    async function buildFinale() {
      const { data: allScores, error } = await supabase
        .from('event_scores')
        .select('*, films (id, title, release_year, poster_url)')
        .eq('event_id', event.id)
      if (error || !allScores) return
      const byFilm = {}
      for (const r of allScores) {
        if (!byFilm[r.film_id]) byFilm[r.film_id] = {}
        byFilm[r.film_id][r.user_id === dustinId ? 'd' : 'h'] = r
      }
      const rows = Object.values(byFilm)
        .filter(p => p.d && p.h)
        .map(p => ({
          film: p.d.films,
          dRank: p.d.rank, hRank: p.h.rank,
          avg: (p.d.rank + p.h.rank) / 2,
          total: totalOf(p.d) + totalOf(p.h),
          tens: TEN_FIELDS.filter(k => p.d[k] === 10).length + TEN_FIELDS.filter(k => p.h[k] === 10).length,
          impact: (p.d[IMPACT.key] ?? 0) + (p.h[IMPACT.key] ?? 0),
        }))
        .sort((a, b) => a.avg - b.avg || b.total - a.total || b.tens - a.tens || b.impact - a.impact)
      setFinale(rows)
    }
    buildFinale()
  }, [event?.status, finale, dustinId])  // eslint-disable-line react-hooks/exhaustive-deps

  const topTen = displayed <= 10 && !done

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase inline-flex items-center gap-2">
            {event?.label ?? '…'} {event?.is_test && <TestBadge />}
          </p>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none mt-2">THE CANON</h1>
          {ceremonyOpen && !done && (
            <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-3 flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> live sync
              </span>
              {revealCount} of {listSize * 2} reveals · progress saved
            </p>
          )}
          {ceremonyOpen && (
            <div className="h-px bg-night-700 mt-5 relative overflow-visible">
              <div className="absolute inset-y-0 left-0 h-[2px] -top-px bg-gold-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>

        {loading && (
          <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING…</div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300 flex items-start justify-between gap-4">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {!loading && !ceremonyOpen && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">THE CURTAIN IS DOWN</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              {!event ? 'There\'s no active event.' : 'The ceremony opens once both lists are locked.'}
            </p>
          </div>
        )}

        {/* ── SPOTLIGHT ─────────────────────────────────────────────────── */}
        {!loading && ceremonyOpen && !done && (
          <>
            {topTen && (
              <p className="text-center font-mono text-[11px] tracking-cinema text-gold-400 uppercase mb-2">✦ The Top Ten ✦</p>
            )}
            <div className="flex items-center gap-4 mb-6">
              <span className="flex-1 h-px bg-night-600" />
              <span className={`font-display text-gold-300 leading-none ${topTen ? 'text-7xl drop-shadow-[0_0_18px_rgba(245,158,11,0.35)]' : 'text-6xl'}`}>
                #{displayed}
              </span>
              <span className="flex-1 h-px bg-night-600" />
            </div>

            {displayedPair.d && displayedPair.h && displayedPair.d.film_id === displayedPair.h.film_id && (
              <p className="text-center font-serif italic text-gold-300 mb-4">
                ✨ The same film, the same rank — the Canon agrees with itself. ✨
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <PlayerCard who="dustin"
                pick={displayedPair.d}
                film={displayedPair.d ? films[displayedPair.d.film_id] : null}
                onBothLists={displayedPair.d ? (membership[displayedPair.d.film_id]?.size ?? 0) > 1 : false}
                years={years}
                priorRanks={displayedPair.d ? priorFor(dustinId, displayedPair.d.film_id) : {}}
                canReveal={canRevealHere && nextSide === 'd'}
                onReveal={handleReveal}
                revealing={revealing}
                sameFilmMatch={displayedComplete && displayedPair.d.film_id === displayedPair.h.film_id}
              />
              <PlayerCard who="hermz"
                pick={displayedPair.h}
                film={displayedPair.h ? films[displayedPair.h.film_id] : null}
                onBothLists={displayedPair.h ? (membership[displayedPair.h.film_id]?.size ?? 0) > 1 : false}
                years={years}
                priorRanks={displayedPair.h ? priorFor(mattId, displayedPair.h.film_id) : {}}
                canReveal={canRevealHere && nextSide === 'h'}
                onReveal={handleReveal}
                revealing={revealing}
                sameFilmMatch={displayedComplete && displayedPair.d.film_id === displayedPair.h.film_id}
              />
            </div>

            <div className="text-center mb-12">
              <button onClick={() => setStay(Math.max(1, displayed - 1))} disabled={!displayedComplete}
                      className="btn-ghost text-sm disabled:opacity-30">
                {displayed > 1 ? `On to #${displayed - 1} →` : 'The finale →'}
              </button>
            </div>
          </>
        )}

        {/* ── FINALE ────────────────────────────────────────────────────── */}
        {!loading && ceremonyOpen && done && (
          <div className="mb-12">
            <div className="text-center mb-8">
              <p className="font-mono text-[11px] tracking-cinema text-gold-400 uppercase mb-2">✦ For the first time anywhere ✦</p>
              <h2 className="font-display text-4xl text-white tracking-wide leading-none">THE COMBINED LIST</h2>
              <p className="font-serif italic text-sm text-gray-400 mt-2">
                Films on both lists — neither of you has seen this until now.
              </p>
            </div>
            {!finale ? (
              <p className="text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse py-8">GENERATING…</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {finale.map((row, i) => (
                  <div key={row.film?.id ?? i} className="card px-4 py-2.5 flex items-center gap-4">
                    <span className="font-display text-2xl text-cinema-400 leading-none w-10 text-right flex-shrink-0">{i + 1}</span>
                    <FilmStill src={row.film?.poster_url} title={row.film?.title ?? ''}
                               className="w-8 h-11 rounded border border-white/10 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{row.film?.title}</p>
                      <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
                        <span className="text-film-400">D #{row.dRank}</span> · <span className="text-gold-400">H #{row.hRank}</span> · avg {row.avg.toFixed(1)}
                      </p>
                    </div>
                    <span className="font-display text-xl text-white leading-none">{row.total}</span>
                  </div>
                ))}
                <p className="font-serif italic text-xs text-gray-500 text-center mt-4">
                  The publish step makes it official across the site — that's the next chapter.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── THE BOARD SO FAR ──────────────────────────────────────────── */}
        {!loading && ceremonyOpen && (boardRanks.length > 0 || done) && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="kicker">The Board So Far</span>
              <span className="flex-1 h-px bg-night-700" />
            </div>
            <div className="grid" style={{ gridTemplateColumns: '3rem 1fr 1fr' }}>
              <span className="font-mono text-[10px] tracking-kicker text-gray-600 uppercase py-1.5"></span>
              <span className="font-mono text-[10px] tracking-kicker text-film-400 uppercase py-1.5">Dustin</span>
              <span className="font-mono text-[10px] tracking-kicker text-gold-400 uppercase py-1.5">Hermz</span>
              {(done ? [...byRank.keys()].sort((a, b) => a - b) : boardRanks).map(rank => {
                const pair = byRank.get(rank) ?? {}
                const cell = (pick, side) => {
                  if (!pick) return <span className="text-gray-700">—</span>
                  const film = films[pick.film_id]
                  const other = filmReveals[pick.film_id]?.[side === 'd' ? 'h' : 'd']
                  const shared = other != null
                  const sameRank = shared && other === rank
                  return (
                    <span className={shared ? 'text-gold-300' : 'text-gray-300'}>
                      {film?.title ?? '…'}
                      {shared && (
                        <span className="font-mono text-[10px] text-gold-500/80 ml-1.5">
                          {sameRank ? '✨ matched' : `⇄ also ${side === 'd' ? 'H' : 'D'} #${other}`}
                        </span>
                      )}
                    </span>
                  )
                }
                const rowShared = (pair.d && filmReveals[pair.d.film_id]?.h != null) || (pair.h && filmReveals[pair.h.film_id]?.d != null)
                return (
                  <div key={rank} className={`contents`}>
                    <span className={`font-display text-lg leading-none py-2 pr-2 text-right border-t border-white/[0.04] ${rowShared ? 'text-gold-300 bg-gold-500/[0.08]' : 'text-gray-500'}`}>{rank}</span>
                    <span className={`text-sm py-2 pr-3 border-t border-white/[0.04] min-w-0 truncate ${rowShared ? 'bg-gold-500/[0.08]' : ''}`}>{cell(pair.d, 'd')}</span>
                    <span className={`text-sm py-2 border-t border-white/[0.04] min-w-0 truncate ${rowShared ? 'bg-gold-500/[0.08]' : ''}`}>{cell(pair.h, 'h')}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
