// MoviesMyStats.jsx — Phase 12e: the post-lock waiting room
//
// Once a player locks their list, their blackout lifts FOR THEIR OWN DATA:
// the new list compared against their own previous editions — risers, fallers,
// new entries, dropped films, score distribution vs. past. The other player's
// new list stays completely hidden until the ceremony (RLS enforces it anyway).

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import FilmStill from '../../components/FilmStill'
import { totalOf, rankCompare } from '../../lib/eventScoring'
import { TestBadge } from './MoviesEventAdmin'

function Movement({ delta, isNew, isReturn }) {
  if (isNew)    return <span className="rank-new font-mono text-[11px]">★ NEW</span>
  if (isReturn) return <span className="font-mono text-[11px] text-cinema-400">↩ RETURNS</span>
  if (delta == null) return null
  if (delta > 0) return <span className="rank-up font-mono text-[11px]">▲ {delta}</span>
  if (delta < 0) return <span className="rank-down font-mono text-[11px]">▼ {-delta}</span>
  return <span className="rank-same font-mono text-[11px]">＝</span>
}

function StatCard({ value, label, sub, accent = 'text-white' }) {
  return (
    <div className="card px-5 py-4">
      <p className={`font-display text-4xl leading-none ${accent}`}>{value}</p>
      <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-2">{label}</p>
      {sub && <p className="font-sans text-sm text-gray-300 mt-1">{sub}</p>}
    </div>
  )
}

function MiniFilmRow({ rank, title, year, right }) {
  return (
    <li className="flex items-baseline gap-2.5 py-1.5 border-b border-white/[0.04] last:border-0">
      {rank != null && <span className="font-display text-lg text-gold-400 leading-none w-8 text-right flex-shrink-0">{rank}</span>}
      <span className="text-sm text-gray-200 min-w-0 truncate">{title}</span>
      <span className="font-mono text-[10px] tracking-kicker text-gray-600">{year ?? ''}</span>
      <span className="ml-auto flex-shrink-0">{right}</span>
    </li>
  )
}

const BINS = [
  { label: '< 60',  test: t => t < 60 },
  { label: '60s',   test: t => t >= 60 && t < 70 },
  { label: '70s',   test: t => t >= 70 && t < 80 },
  { label: '80s',   test: t => t >= 80 && t < 90 },
  { label: '90 +',  test: t => t >= 90 },
]

export default function MoviesMyStats() {
  const { session, isDustin } = useAuth()
  const user = session?.user

  const [event, setEvent]     = useState(undefined)
  const [players, setPlayers] = useState([])
  const [scores, setScores]   = useState([])
  const [prior, setPrior]     = useState([])   // my individual_rankings w/ years + films
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

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

      const [plRes, scRes, prRes] = await Promise.all([
        supabase.from('event_players').select('*').eq('event_id', ev.id),
        supabase.from('event_scores')
          .select('*, films (id, title, release_year, poster_url)')
          .eq('event_id', ev.id).eq('user_id', user.id),
        supabase.from('individual_rankings')
          .select('film_id, rank, total_score, ranking_events (year, status), films (id, title, release_year)')
          .eq('user_id', user.id),
      ])
      const err = plRes.error || scRes.error || prRes.error
      if (err) { setError(err.message); setLoading(false); return }
      setPlayers(plRes.data || [])
      setScores(scRes.data || [])
      setPrior((prRes.data || []).filter(r => r.ranking_events?.status === 'published'))
      setLoading(false)
    }
    load()
  }, [user])

  const me    = useMemo(() => players.find(p => p.user_id === user?.id), [players, user])
  const other = useMemo(() => players.find(p => p.user_id !== user?.id), [players, user])

  // ── Derived ──────────────────────────────────────────────────────────────
  const ranked = useMemo(() => [...scores].sort(rankCompare), [scores])

  const lastYear = useMemo(
    () => prior.reduce((mx, r) => Math.max(mx, r.ranking_events?.year ?? 0), 0) || null,
    [prior],
  )
  const lastEd = useMemo(() => {
    const m = new Map()
    prior.filter(r => r.ranking_events?.year === lastYear)
         .forEach(r => m.set(r.film_id, r))
    return m
  }, [prior, lastYear])
  const everIds = useMemo(() => new Set(prior.map(r => r.film_id)), [prior])

  const rows = useMemo(() => ranked.map((r, i) => {
    const prev = lastEd.get(r.film_id)
    return {
      ...r,
      newRank: i + 1,
      total: totalOf(r),
      prevRank: prev?.rank ?? null,
      delta: prev ? prev.rank - (i + 1) : null,
      isNew: !everIds.has(r.film_id),
      isReturn: !prev && everIds.has(r.film_id),
    }
  }), [ranked, lastEd, everIds])

  const risers  = useMemo(() => rows.filter(r => r.delta != null && r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5), [rows])
  const fallers = useMemo(() => rows.filter(r => r.delta != null && r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5), [rows])
  const newEntries = useMemo(() => rows.filter(r => r.isNew), [rows])
  const returning  = useMemo(() => rows.filter(r => r.isReturn), [rows])
  const dropped = useMemo(() => {
    const newIds = new Set(rows.map(r => r.film_id))
    return [...lastEd.values()]
      .filter(r => !newIds.has(r.film_id))
      .sort((a, b) => a.rank - b.rank)
  }, [rows, lastEd])

  const avgNew  = rows.length ? (rows.reduce((s, r) => s + r.total, 0) / rows.length) : 0
  const lastTotals = useMemo(() => [...lastEd.values()].map(r => r.total_score).filter(t => t != null), [lastEd])
  const avgLast = lastTotals.length ? (lastTotals.reduce((s, t) => s + t, 0) / lastTotals.length) : null

  const dist = useMemo(() => BINS.map(b => ({
    label: b.label,
    now: rows.filter(r => b.test(r.total)).length,
    then: lastTotals.filter(t => b.test(t)).length,
  })), [rows, lastTotals])
  const distMax = Math.max(1, ...dist.map(d => Math.max(d.now, d.then)))

  const playerColor = isDustin ? 'text-film-400' : 'text-gold-400'
  const playerBar   = isDustin ? 'bg-film-500' : 'bg-gold-500'

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <FilmStill title="The Waiting Room" hue={200} mood="cool" className="w-full h-[300px] sm:h-[340px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies/score" className="font-mono text-[11px] tracking-kicker text-film-400 hover:text-film-300 transition-colors">
              ← SCORING
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase inline-flex items-center gap-2">
              {event?.label ?? 'My Stats'} {event?.is_test && <TestBadge />}
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            {other?.state === 'locked' ? 'BOTH LISTS ARE IN' : 'THE WAITING ROOM'}
          </h1>
          <p className="font-sans text-base text-gray-300 mt-3">
            {other?.state === 'locked'
              ? 'Your new Canon against your own history — the ceremony can begin whenever you\'re together.'
              : 'Your new Canon against your own history. The other list stays sealed until the ceremony.'}
          </p>
          {other?.state === 'locked' && (
            <Link to="/movies/ceremony" className="btn-gold text-xs inline-block mt-4">To the Ceremony →</Link>
          )}
        </div>
      </FilmStill>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8">

        {loading && (
          <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING…</div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">{error}</div>
        )}

        {!loading && (!event || !me || me.state !== 'locked') && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">NOT YET</p>
            <p className="font-sans text-base text-gray-300 max-w-sm mx-auto">
              {!event ? 'There\'s no active event.'
                : me?.state === 'scoring' ? <>The waiting room opens when your list is locked. <Link to="/movies/score" className="text-gold-400 hover:text-gold-300 not-italic">Back to scoring →</Link></>
                : 'The waiting room opens once you\'ve scored and locked your list.'}
            </p>
          </div>
        )}

        {!loading && event && me?.state === 'locked' && (
          <>
            {/* Stat strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
              <StatCard value={rows.length} label="Films ranked" accent={playerColor} />
              <StatCard value={avgNew.toFixed(1)} label="Average score"
                        sub={avgLast != null ? `${lastYear}: ${avgLast.toFixed(1)}` : undefined} />
              <StatCard value={newEntries.length} label="First appearances" accent="text-gold-400" />
              <StatCard value={dropped.length} label={`Dropped from ${lastYear ?? 'last'}`} accent="text-gray-400" />
            </div>

            {/* Risers / Fallers */}
            {(risers.length > 0 || fallers.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="card p-5">
                  <p className="kicker mb-4">Biggest Risers vs {lastYear}</p>
                  <ul>
                    {risers.map(r => (
                      <MiniFilmRow key={r.film_id} rank={r.newRank} title={r.films?.title}
                                   year={`was #${r.prevRank}`}
                                   right={<Movement delta={r.delta} />} />
                    ))}
                    {risers.length === 0 && <p className="font-sans text-sm text-gray-300">No risers this time.</p>}
                  </ul>
                </div>
                <div className="card p-5">
                  <p className="kicker mb-4">Biggest Fallers vs {lastYear}</p>
                  <ul>
                    {fallers.map(r => (
                      <MiniFilmRow key={r.film_id} rank={r.newRank} title={r.films?.title}
                                   year={`was #${r.prevRank}`}
                                   right={<Movement delta={r.delta} />} />
                    ))}
                    {fallers.length === 0 && <p className="font-sans text-sm text-gray-300">Nothing fell — generous mood.</p>}
                  </ul>
                </div>
              </div>
            )}

            {/* New + returning / dropped */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="card p-5">
                <p className="kicker mb-4">New to the Canon</p>
                <ul>
                  {newEntries.map(r => (
                    <MiniFilmRow key={r.film_id} rank={r.newRank} title={r.films?.title}
                                 year={r.films?.release_year} right={<Movement isNew />} />
                  ))}
                  {returning.map(r => (
                    <MiniFilmRow key={r.film_id} rank={r.newRank} title={r.films?.title}
                                 year={r.films?.release_year} right={<Movement isReturn />} />
                  ))}
                  {newEntries.length === 0 && returning.length === 0 && (
                    <p className="font-sans text-sm text-gray-300">Every film has ranked before.</p>
                  )}
                </ul>
              </div>
              <div className="card p-5">
                <p className="kicker mb-4">Dropped from {lastYear ?? 'last edition'}</p>
                <ul>
                  {dropped.map(r => (
                    <MiniFilmRow key={r.film_id} title={r.films?.title} year={`was #${r.rank}`}
                                 right={<span className="rank-off font-mono text-[11px]">OFF LIST</span>} />
                  ))}
                  {dropped.length === 0 && (
                    <p className="font-sans text-sm text-gray-300">Nothing dropped — the canon holds.</p>
                  )}
                </ul>
              </div>
            </div>

            {/* Score distribution */}
            <div className="card p-5 mb-10">
              <div className="flex items-center gap-4 mb-5 flex-wrap">
                <p className="kicker">Score Distribution</p>
                <span className="ml-auto flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-kicker text-gray-400 uppercase">
                    <span className={`w-2.5 h-2.5 rounded-sm ${playerBar}`} /> This edition
                  </span>
                  {lastYear && (
                    <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
                      <span className="w-2.5 h-2.5 rounded-sm bg-night-600" /> {lastYear}
                    </span>
                  )}
                </span>
              </div>
              <div className="space-y-3">
                {dist.map(d => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="font-mono text-[11px] tracking-kicker text-gray-500 w-10 text-right">{d.label}</span>
                    <div className="flex-1 space-y-1">
                      <div className="h-3 rounded-sm bg-night-800 overflow-hidden">
                        <div className={`h-full ${playerBar} transition-all`} style={{ width: `${(d.now / distMax) * 100}%` }} />
                      </div>
                      <div className="h-3 rounded-sm bg-night-800 overflow-hidden">
                        <div className="h-full bg-night-600" style={{ width: `${(d.then / distMax) * 100}%` }} />
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-gray-400 w-14">{d.now}{lastYear ? ` · ${d.then}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full list */}
            <div className="flex items-center gap-3 mb-4">
              <span className="kicker">Your New Canon</span>
              <span className="flex-1 h-px bg-night-700" />
              <span className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase">
                movement vs {lastYear ?? 'past'} · hidden from the other side until the reveal
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {rows.map(r => (
                <div key={r.id} className="card px-4 py-2.5 flex items-center gap-4">
                  <span className="font-display text-2xl text-gold-400 leading-none w-10 text-right flex-shrink-0">{r.newRank}</span>
                  <FilmStill src={r.films?.poster_url} title={r.films?.title ?? ''}
                             className="w-8 h-11 rounded border border-white/10 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{r.films?.title}</p>
                    <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
                      {r.films?.release_year ?? ''}{r.prevRank != null && ` · was #${r.prevRank} in ${lastYear}`}
                    </p>
                  </div>
                  <Movement delta={r.delta} isNew={r.isNew} isReturn={r.isReturn} />
                  <span className="font-display text-2xl text-white leading-none w-12 text-right">{r.total}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
