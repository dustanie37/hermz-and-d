// MoviesScore.jsx — Phase 12d: individual scoring, the centerpiece
//
// One film at a time in a seeded-shuffle order generated ONCE per player at
// scoring start (queue stored in event_scores.queue_pos — stable across
// sessions). The card shows the film and nothing historical. 8 categories /10
// scored by hand + Personal Impact /20; Acclaim is pre-filled and locked from
// the mutually-agreed value. Every tap writes immediately (save & resume).
// Skip sends a film to the back of the queue. When all films are scored:
// review — full ranked list with the standard tiebreakers, editable — then Lock.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import FilmStill from '../../components/FilmStill'
import { TestBadge } from './MoviesEventAdmin'
import {
  MANUAL_CATS, IMPACT, totalOf, isComplete, rankCompare, seededShuffle,
} from '../../lib/eventScoring'

const FILM_FIELDS = 'films (id, title, release_year, poster_url, director, actor_1, actor_2, actor_3, actor_4, actor_5)'

// ── Score pills ───────────────────────────────────────────────────────────────

function PillRow({ label, value, max, onPick, locked = false }) {
  return (
    <div className="py-2.5 border-b border-white/[0.05] last:border-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[11px] tracking-kicker text-gray-400 uppercase">
          {label}{locked && <span className="text-gold-500 ml-1.5">🔒 agreed</span>}
        </span>
        <span className={`font-display text-xl leading-none ${value != null ? 'text-white' : 'text-gray-600'}`}>
          {value ?? '—'}<span className="text-gray-600 text-sm">/{max}</span>
        </span>
      </div>
      {!locked && (
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: max }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => onPick(n)}
              className={`w-8 h-8 rounded-lg font-mono text-xs transition-all
                ${value === n
                  ? 'bg-gold-500 text-night-950 font-bold'
                  : 'bg-night-700/60 text-gray-400 hover:bg-night-600 hover:text-white'}`}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit modal (review stage) ────────────────────────────────────────────────

function EditModal({ row, onClose, onChange }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-night-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-night-900 border border-white/[0.1]
                      rounded-2xl shadow-still-lg flex flex-col max-h-[90vh]"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-night-700/60">
          <div>
            <span className="kicker">Adjust scores</span>
            <h2 className="font-display text-2xl text-white tracking-wide leading-none mt-1.5">
              {row.films?.title?.toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl text-gold-400 leading-none">{totalOf(row)}</span>
            <button onClick={onClose}
                    className="text-gray-500 hover:text-gray-200 transition-colors text-xl leading-none w-8 h-8
                               flex items-center justify-center rounded-full hover:bg-white/5">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">
          {MANUAL_CATS.map(c => (
            <PillRow key={c.key} label={c.label} value={row[c.key]} max={c.max}
                     onPick={n => onChange(row, c.key, n)} />
          ))}
          <PillRow label="Acclaim" value={row.score_acclaim} max={10} locked />
          <PillRow label={IMPACT.label} value={row[IMPACT.key]} max={IMPACT.max}
                   onPick={n => onChange(row, IMPACT.key, n)} />
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MoviesScore() {
  const { session } = useAuth()
  const user = session?.user

  const [event, setEvent]     = useState(undefined)
  const [players, setPlayers] = useState([])
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [starting, setStarting] = useState(false)
  const [locking, setLocking]   = useState(false)
  const [editRow, setEditRow]   = useState(null)

  async function load() {
    setLoading(true); setError(null)
    const { data: events, error: evErr } = await supabase
      .from('ranking_events').select('*').neq('status', 'published')
      .order('created_at', { ascending: false }).limit(1)
    if (evErr) { setError(evErr.message); setLoading(false); return }
    const ev = events?.[0] ?? null
    setEvent(ev)
    if (!ev) { setLoading(false); return }

    const [plRes, scRes] = await Promise.all([
      supabase.from('event_players').select('*').eq('event_id', ev.id),
      supabase.from('event_scores').select(`*, ${FILM_FIELDS}`)
        .eq('event_id', ev.id).eq('user_id', user.id).order('queue_pos'),
    ])
    if (plRes.error || scRes.error) { setError((plRes.error || scRes.error).message); setLoading(false); return }
    setPlayers(plRes.data || [])
    setRows(scRes.data || [])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  const me    = useMemo(() => players.find(p => p.user_id === user?.id), [players, user])
  const other = useMemo(() => players.find(p => p.user_id !== user?.id), [players, user])
  const listSize = event?.list_size ?? 125

  const scored   = useMemo(() => rows.filter(r => r.scored_at != null), [rows])
  const pending  = useMemo(() => rows.filter(r => r.scored_at == null), [rows])
  const current  = pending[0] ?? null
  const skippedWaiting = useMemo(() => pending.filter(r => r.skipped).length, [rows])  // eslint-disable-line react-hooks/exhaustive-deps
  const allScored = rows.length > 0 && pending.length === 0
  const ranked   = useMemo(() => [...rows].sort(rankCompare), [rows])

  // ── Begin scoring: generate the queue ───────────────────────────────────
  async function beginScoring() {
    if (!event || !me) return
    setStarting(true); setError(null)
    try {
      const { data: inRows, error: poolErr } = await supabase
        .from('event_pool')
        .select('film_id, films (id, acclaim_score)')
        .eq('event_id', event.id).eq('user_id', user.id).eq('bucket', 'in')
      if (poolErr) throw poolErr
      if ((inRows?.length ?? 0) !== listSize) {
        throw new Error(`Your list has ${inRows?.length ?? 0} films, not ${listSize} — fix it on the cultivation page first.`)
      }
      if (!window.confirm(
        `Begin scoring?\n\nYour ${listSize} becomes truly final — swaps close, and your shuffled order is set. Prior-edition rankings go dark for you until you lock your list.`
      )) { setStarting(false); return }

      const seed = Math.floor(Math.random() * 2147483647)
      const shuffled = seededShuffle(inRows, seed)
      const newRows = shuffled.map((r, idx) => ({
        event_id: event.id,
        user_id: user.id,
        film_id: r.film_id,
        queue_pos: idx + 1,
        score_acclaim: r.films?.acclaim_score ?? null,   // pre-filled + locked
      }))
      const { error: insErr } = await supabase
        .from('event_scores')
        .upsert(newRows, { onConflict: 'event_id,user_id,film_id', ignoreDuplicates: true })
      if (insErr) throw insErr
      const { error: stErr } = await supabase
        .from('event_players')
        .update({ state: 'scoring', shuffle_seed: seed })
        .eq('event_id', event.id).eq('user_id', user.id)
      if (stErr) throw stErr
      await load()
    } catch (err) {
      setError(err.message)
    }
    setStarting(false)
  }

  // ── Immediate single-field write ─────────────────────────────────────────
  async function setScore(row, key, val) {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, [key]: val } : r))
    if (editRow && editRow.id === row.id) setEditRow(prev => ({ ...prev, [key]: val }))
    const { error } = await supabase
      .from('event_scores').update({ [key]: val }).eq('id', row.id).eq('user_id', user.id)
    if (error) {
      setError(error.message)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, [key]: row[key] } : r))
    }
  }

  async function finishFilm() {
    if (!current || !isComplete(current)) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('event_scores').update({ scored_at: now, skipped: false })
      .eq('id', current.id).eq('user_id', user.id)
    if (error) { setError(error.message); return }
    setRows(prev => prev.map(r => r.id === current.id ? { ...r, scored_at: now, skipped: false } : r))
    window.scrollTo({ top: 0 })
  }

  async function skipFilm() {
    if (!current) return
    const maxPos = Math.max(...rows.map(r => r.queue_pos ?? 0))
    const { error } = await supabase
      .from('event_scores').update({ queue_pos: maxPos + 1, skipped: true })
      .eq('id', current.id).eq('user_id', user.id)
    if (error) { setError(error.message); return }
    setRows(prev => prev
      .map(r => r.id === current.id ? { ...r, queue_pos: maxPos + 1, skipped: true } : r)
      .sort((a, b) => (a.queue_pos ?? 0) - (b.queue_pos ?? 0)))
    window.scrollTo({ top: 0 })
  }

  async function lockList() {
    if (!allScored || !me) return
    if (!window.confirm('Lock your list?\n\nThis is final until the reveal — your ranked list and personal stats open up, and the ceremony unlocks once both of you are in.')) return
    setLocking(true); setError(null)
    try {
      // Persist final ranks (shared comparator — the ceremony + publish read these).
      // Conflict on the natural key (event_id,user_id,film_id): event_scores.id is
      // GENERATED ALWAYS, so it must never be sent in the payload. Rows already exist
      // from "Begin scoring", so this updates their rank in place.
      const rankRows = ranked.map((r, i) => ({
        event_id: r.event_id, user_id: r.user_id, film_id: r.film_id, rank: i + 1,
      }))
      const { error: rkErr } = await supabase
        .from('event_scores').upsert(rankRows, { onConflict: 'event_id,user_id,film_id' })
      if (rkErr) throw rkErr

      const { error: stErr } = await supabase
        .from('event_players')
        .update({ state: 'locked', locked_at: new Date().toISOString() })
        .eq('event_id', event.id).eq('user_id', user.id)
      if (stErr) throw stErr

      // Second lock closes scoring: the event advances to 'locked' → ceremony opens
      if (other?.state === 'locked') {
        const { error: evErr } = await supabase
          .from('ranking_events').update({ status: 'locked' }).eq('id', event.id)
        if (evErr) throw evErr
      }
      await load()
    } catch (err) {
      setError(err.message)
    }
    setLocking(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const cast = current ? [current.films?.actor_1, current.films?.actor_2, current.films?.actor_3, current.films?.actor_4, current.films?.actor_5].filter(Boolean) : []
  const progressPct = rows.length ? Math.round((scored.length / rows.length) * 100) : 0

  const heroTitle = me?.state === 'locked' ? 'YOUR LIST IS IN'
    : allScored && rows.length ? 'THE FINAL CUT'
    : me?.state === 'scoring' ? 'SCORING'
    : 'SCORING'

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <FilmStill title="Scoring" hue={265} mood="cool" className="w-full h-[300px] sm:h-[340px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-[11px] tracking-kicker text-film-400 hover:text-film-300 transition-colors">
              ← FILMS
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase inline-flex items-center gap-2">
              {event?.label ?? 'Scoring'} {event?.is_test && <TestBadge />}
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">{heroTitle}</h1>
          <p className="font-serif italic text-base text-gray-400 mt-3">
            {me?.state === 'locked'
              ? 'Locked and sealed until the reveal ceremony.'
              : allScored && rows.length
              ? 'Every film scored. Review your ranked list, adjust anything, then lock it in.'
              : 'One film at a time, in an order fate chose. No history, no hints — just the film.'}
          </p>
        </div>
      </FilmStill>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">

        {loading && (
          <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING…</div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300 flex items-start justify-between gap-4">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* ── Gates ─────────────────────────────────────────────────────── */}
        {!loading && (!event || event.status !== 'scoring') && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">SCORING HASN'T OPENED</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              {!event ? 'There\'s no active event.' : `${event.label} is in the ${event.status} stage.`}
            </p>
          </div>
        )}

        {!loading && event?.status === 'scoring' && me && me.state === 'cultivated' && (
          <div className="card text-center py-16 space-y-5">
            <p className="font-display text-3xl text-white tracking-wide leading-none">READY WHEN YOU ARE</p>
            <p className="font-serif italic text-base text-gray-400 max-w-md mx-auto">
              {listSize} films await, shuffled into an order only fate knows. Once you begin, swaps close
              and prior-edition rankings go dark for you until your list is locked.
            </p>
            <button onClick={beginScoring} disabled={starting} className="btn-gold text-sm disabled:opacity-50">
              {starting ? 'Shuffling…' : 'Begin Scoring'}
            </button>
          </div>
        )}

        {/* ── Scoring card ──────────────────────────────────────────────── */}
        {!loading && me?.state === 'scoring' && current && (
          <>
            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono text-[11px] tracking-kicker text-gray-400 uppercase">
                  Film {scored.length + 1} of {rows.length}
                  {skippedWaiting > 0 && <span className="text-amber-300 ml-2">· {skippedWaiting} skipped, waiting at the back</span>}
                </span>
                <span className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase">{progressPct}%</span>
              </div>
              <div className="h-1 rounded-full bg-night-700 overflow-hidden">
                <div className="h-full bg-gold-500 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-5">
                {/* Poster */}
                <div className="md:col-span-2 relative min-h-[320px] bg-night-900 flex items-center justify-center overflow-hidden">
                  {current.films?.poster_url ? (
                    <>
                      {/* soft ambient fill so the uncropped poster doesn't sit on flat bars */}
                      <img src={current.films.poster_url} alt="" aria-hidden="true"
                           className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-25 scale-110" />
                      {/* the whole poster, never cropped */}
                      <img src={current.films.poster_url} alt={current.films?.title ?? ''}
                           className="relative z-10 max-h-[440px] w-auto max-w-[88%] object-contain rounded-lg shadow-still-lg my-6" />
                    </>
                  ) : (
                    <FilmStill title={current.films?.title ?? ''} className="absolute inset-0 w-full h-full" />
                  )}
                </div>
                {/* Details + scores */}
                <div className="md:col-span-3 p-5 sm:p-6">
                  <p className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase mb-1">
                    {current.films?.release_year ?? '—'}
                    {current.films?.director && <> · Directed by {current.films.director}</>}
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl text-white tracking-wide leading-none mb-2">
                    {current.films?.title?.toUpperCase()}
                  </h2>
                  {cast.length > 0 && (
                    <p className="font-serif italic text-sm text-gray-400 mb-4">{cast.join(' · ')}</p>
                  )}

                  <div className="border-t border-white/[0.06]">
                    {MANUAL_CATS.map(c => (
                      <PillRow key={c.key} label={c.label} value={current[c.key]} max={c.max}
                               onPick={n => setScore(current, c.key, n)} />
                    ))}
                    <PillRow label="Acclaim" value={current.score_acclaim} max={10} locked />
                    <PillRow label={IMPACT.label} value={current[IMPACT.key]} max={IMPACT.max}
                             onPick={n => setScore(current, IMPACT.key, n)} />
                  </div>

                  {/* Footer: total + actions */}
                  <div className="flex items-center gap-4 pt-4 mt-1 border-t border-white/[0.06]">
                    <div>
                      <span className="font-display text-4xl leading-none text-gold-400">{totalOf(current)}</span>
                      <span className="font-mono text-[10px] tracking-kicker text-gray-500 ml-1">/100</span>
                    </div>
                    <button onClick={skipFilm}
                            className="ml-auto font-mono text-[11px] tracking-kicker text-gray-500 hover:text-amber-300 uppercase transition-colors">
                      Skip for now →
                    </button>
                    <button onClick={finishFilm} disabled={!isComplete(current)}
                            className="btn-gold text-sm disabled:opacity-40">
                      Next Film →
                    </button>
                  </div>
                  {!isComplete(current) && (
                    <p className="font-serif italic text-xs text-gray-600 mt-2 text-right">
                      Score every category to continue — progress saves as you tap.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Review & lock / locked list ──────────────────────────────── */}
        {!loading && rows.length > 0 && allScored && (me?.state === 'scoring' || me?.state === 'locked') && (
          <>
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="kicker">{me.state === 'locked' ? 'Your Locked List' : 'Your Ranked List'}</span>
              <span className="flex-1 h-px bg-night-700" />
              {me.state === 'scoring' ? (
                <button onClick={lockList} disabled={locking} className="btn-gold text-xs disabled:opacity-50">
                  {locking ? 'Locking…' : '🔒 Lock My List'}
                </button>
              ) : (
                <span className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[11px] tracking-kicker text-emerald-400 uppercase">
                    Locked {me.locked_at ? new Date(me.locked_at).toLocaleDateString() : ''}
                    {other && (other.state === 'locked'
                      ? ' · both in — the ceremony awaits'
                      : ' · waiting on the other list')}
                  </span>
                  <Link to="/movies/my-stats" className="btn-gold text-xs">The Waiting Room →</Link>
                </span>
              )}
            </div>
            {me.state === 'scoring' && (
              <p className="font-serif italic text-sm text-gray-500 mb-5">
                Tap any film to adjust its scores — the list re-sorts live. Ties break by Impact, then most 10s, most 9s, and so on.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {ranked.map((row, i) => (
                <button key={row.id}
                        onClick={() => me.state === 'scoring' && setEditRow(row)}
                        disabled={me.state !== 'scoring'}
                        className={`card px-4 py-2.5 flex items-center gap-4 text-left transition-all
                          ${me.state === 'scoring' ? 'hover:border-gold-500/50 cursor-pointer' : 'cursor-default'}`}>
                  <span className="font-display text-2xl text-gold-400 leading-none w-10 text-right flex-shrink-0">{i + 1}</span>
                  <FilmStill src={row.films?.poster_url} title={row.films?.title ?? ''}
                             className="w-8 h-11 rounded border border-white/10 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{row.films?.title}</p>
                    <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase">{row.films?.release_year ?? ''}</p>
                  </div>
                  <span className="font-display text-2xl text-white leading-none">{totalOf(row)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {editRow && me?.state === 'scoring' && (
          <EditModal row={rows.find(r => r.id === editRow.id) ?? editRow}
                     onClose={() => setEditRow(null)}
                     onChange={setScore} />
        )}
      </div>
    </div>
  )
}
