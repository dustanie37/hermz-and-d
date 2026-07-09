// MoviesCultivate.jsx — Phase 12b: cultivate the pool to exactly event.list_size
//
// Triage buckets (In / Maybe / Out, one-tap) with a live counter; the Lock
// button only arms when In === the event's list size. After locking, the page
// becomes a read-only view — and once BOTH players have locked, the roster
// reveal shows the two lists side by side (titles only; no ranks exist yet).
// One-for-one swaps after lock arrive with 12c.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import FilmStill from '../../components/FilmStill'
import { sortTitle } from '../../lib/helpers'
import { TestBadge } from './MoviesEventAdmin'

const BUCKETS = [
  { id: 'unsorted', label: 'Unsorted', color: 'text-gray-400',    bar: 'after:bg-gray-400' },
  { id: 'in',       label: 'In',       color: 'text-emerald-400', bar: 'after:bg-emerald-400' },
  { id: 'maybe',    label: 'Maybe',    color: 'text-amber-300',   bar: 'after:bg-amber-300' },
  { id: 'out',      label: 'Out',      color: 'text-gray-500',    bar: 'after:bg-gray-500' },
]

const LOCKED_STATES = ['cultivated', 'scoring', 'locked']

// ── Bucket button strip on each card ──────────────────────────────────────────

function BucketButtons({ row, onBucket }) {
  const opts = [
    { id: 'in',    label: 'IN',    on: 'bg-emerald-500/85 text-white', off: 'bg-night-950/70 text-emerald-300 hover:bg-emerald-500/40' },
    { id: 'maybe', label: 'MAYBE', on: 'bg-amber-500/85 text-night-950', off: 'bg-night-950/70 text-amber-300 hover:bg-amber-500/40' },
    { id: 'out',   label: 'OUT',   on: 'bg-gray-500/85 text-white', off: 'bg-night-950/70 text-gray-400 hover:bg-gray-500/40' },
  ]
  return (
    <div className="flex gap-1 p-1">
      {opts.map(o => (
        <button key={o.id}
          onClick={() => onBucket(row, row.bucket === o.id ? 'unsorted' : o.id)}
          className={`flex-1 font-mono text-[10px] tracking-kicker uppercase py-1.5 rounded transition-colors
            ${row.bucket === o.id ? o.on : o.off}`}
          title={row.bucket === o.id ? 'Tap again to unsort' : `Move to ${o.label}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Roster column (post-lock reveal) ──────────────────────────────────────────

function RosterColumn({ title, accent, films, sharedIds }) {
  return (
    <div className={`card p-5 border-t-2 ${accent === 'film' ? 'border-t-film-500' : 'border-t-gold-500'}`}>
      <p className={`font-display text-xl tracking-wide leading-none mb-4 ${accent === 'film' ? 'text-film-300' : 'text-gold-300'}`}>
        {title.toUpperCase()}
      </p>
      <ol className="space-y-1.5">
        {films.map(f => (
          <li key={f.id} className="flex items-baseline gap-2 text-sm">
            <span className="text-gray-200">{f.title}</span>
            <span className="font-mono text-[10px] tracking-kicker text-gray-500">{f.release_year ?? ''}</span>
            {sharedIds.has(f.id) && (
              <span className="font-mono text-[9px] tracking-cinema uppercase px-1.5 py-px rounded
                               bg-cinema-500/10 border border-cinema-500/30 text-cinema-300">both</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MoviesCultivate() {
  const { session, isDustin } = useAuth()
  const user = session?.user

  const [event, setEvent]         = useState(undefined)
  const [players, setPlayers]     = useState([])
  const [profiles, setProfiles]   = useState([])
  const [pool, setPool]           = useState([])
  const [otherIn, setOtherIn]     = useState(null)   // other player's locked 'in' films (post-reveal)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [tab, setTab]             = useState('unsorted')
  const [locking, setLocking]     = useState(false)

  async function load() {
    setLoading(true); setError(null)

    const { data: events, error: evErr } = await supabase
      .from('ranking_events').select('*').neq('status', 'published')
      .order('created_at', { ascending: false }).limit(1)
    if (evErr) { setError(evErr.message); setLoading(false); return }
    const ev = events?.[0] ?? null
    setEvent(ev)
    if (!ev) { setLoading(false); return }

    const [plRes, prRes, poolRes] = await Promise.all([
      supabase.from('event_players').select('*').eq('event_id', ev.id),
      supabase.from('profiles').select('id, username, display_name'),
      supabase.from('event_pool')
        .select('*, films (id, title, release_year, poster_url)')
        .eq('event_id', ev.id).eq('user_id', user.id),
    ])
    const err = plRes.error || prRes.error || poolRes.error
    if (err) { setError(err.message); setLoading(false); return }
    setPlayers(plRes.data || [])
    setProfiles(prRes.data || [])
    setPool(poolRes.data || [])

    // Roster reveal: if both players locked, fetch the other player's In list
    const meRow    = (plRes.data || []).find(p => p.user_id === user.id)
    const otherRow = (plRes.data || []).find(p => p.user_id !== user.id)
    if (meRow && otherRow && LOCKED_STATES.includes(meRow.state) && LOCKED_STATES.includes(otherRow.state)) {
      const { data: theirs } = await supabase
        .from('event_pool')
        .select('film_id, films (id, title, release_year)')
        .eq('event_id', ev.id).eq('user_id', otherRow.user_id).eq('bucket', 'in')
      setOtherIn((theirs || []).map(r => r.films).filter(Boolean))
    } else {
      setOtherIn(null)
    }
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])  // eslint-disable-line react-hooks/exhaustive-deps

  const me       = useMemo(() => players.find(p => p.user_id === user?.id), [players, user])
  const other    = useMemo(() => players.find(p => p.user_id !== user?.id), [players, user])
  const otherProf = useMemo(() => profiles.find(p => p.id === other?.user_id), [profiles, other])
  const iAmLocked    = me && LOCKED_STATES.includes(me.state)
  const otherLocked  = other && LOCKED_STATES.includes(other.state)

  const listSize = event?.list_size ?? 125

  const byBucket = useMemo(() => {
    const g = { unsorted: [], in: [], maybe: [], out: [] }
    pool.forEach(r => { (g[r.bucket] ?? g.unsorted).push(r) })
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => sortTitle(a.films?.title ?? '').localeCompare(sortTitle(b.films?.title ?? '')))
    }
    return g
  }, [pool])

  const inCount   = byBucket.in.length
  const spotsLeft = listSize - inCount
  const readyToLock = inCount === listSize

  async function handleBucket(row, bucket) {
    // optimistic
    setPool(prev => prev.map(r => r.id === row.id ? { ...r, bucket } : r))
    const { error } = await supabase
      .from('event_pool').update({ bucket }).eq('id', row.id).eq('user_id', user.id)
    if (error) {
      setError(error.message)
      setPool(prev => prev.map(r => r.id === row.id ? { ...r, bucket: row.bucket } : r))
    }
  }

  async function handleLock() {
    if (!readyToLock || !me) return
    if (!window.confirm(
      `Lock your ${listSize}?\n\nYour list becomes visible to ${otherProf?.display_name ?? 'the other player'} once you've both locked (titles only — no ranks exist yet). One-for-one swaps stay possible until scoring begins.`
    )) return
    setLocking(true); setError(null)
    const { error } = await supabase
      .from('event_players').update({ state: 'cultivated' })
      .eq('event_id', event.id).eq('user_id', user.id)
    if (error) setError(error.message)
    else await load()
    setLocking(false)
  }

  // ── Shared ids for the reveal ────────────────────────────────────────────
  const myInFilms = useMemo(() => byBucket.in.map(r => r.films).filter(Boolean), [byBucket])
  const sharedIds = useMemo(() => {
    if (!otherIn) return new Set()
    const mine = new Set(myInFilms.map(f => f.id))
    return new Set(otherIn.filter(f => mine.has(f.id)).map(f => f.id))
  }, [otherIn, myInFilms])

  const sortedRoster = films => [...films].sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))

  const cultivating = event?.status === 'pooling' && me && !iAmLocked

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <FilmStill title="Cultivation" hue={140} mood="cool" className="w-full h-[300px] sm:h-[340px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies/pool" className="font-mono text-[11px] tracking-kicker text-film-400 hover:text-film-300 transition-colors">
              ← POOL
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase inline-flex items-center gap-2">
              {event?.label ?? 'Next Edition'}
              {event?.is_test && <TestBadge />}
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            {iAmLocked ? 'YOUR LIST IS LOCKED' : `CULTIVATE TO ${listSize}`}
          </h1>
          <p className="font-serif italic text-base text-gray-400 mt-3">
            {iAmLocked
              ? otherLocked
                ? 'Both rosters are in. Behold the field of battle.'
                : `Locked at ${listSize}. Waiting on ${otherProf?.display_name ?? 'the other player'}…`
              : 'Sort every candidate into In, Maybe, or Out — the list locks at exactly ' + listSize + '.'}
          </p>
        </div>
      </FilmStill>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {loading && (
          <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING…</div>
        )}

        {!loading && (!event || event.status === 'setup') && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">NOTHING TO CULTIVATE YET</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              {event ? 'Pooling hasn\'t opened.' : 'There\'s no active event.'}
              {isDustin && <> Manage events from the <Link to="/movies/event-admin" className="text-gold-400 hover:text-gold-300">event admin</Link>.</>}
            </p>
          </div>
        )}

        {!loading && event && event.status !== 'setup' && event.status !== 'pooling' && !iAmLocked && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">CULTIVATION IS CLOSED</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              {event.label} has moved on to the {event.status} stage.
            </p>
          </div>
        )}

        {!loading && event && event.status === 'pooling' && !me && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">NOT A PLAYER</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              You're not registered as a player in this event.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300 flex items-start justify-between gap-4">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* ── TRIAGE MODE ──────────────────────────────────────────────── */}
        {!loading && cultivating && (
          <>
            {/* Counter bar — sticky */}
            <div className="sticky top-16 z-30 mb-8">
              <div className="card px-5 py-4 flex items-center gap-5 flex-wrap border border-night-600/80 shadow-still">
                <div className="flex items-center gap-5 flex-wrap">
                  <span className={`font-display text-2xl leading-none ${readyToLock ? 'text-emerald-400' : inCount > listSize ? 'text-red-400' : 'text-white'}`}>
                    In: {inCount}<span className="text-gray-500 text-lg">/{listSize}</span>
                  </span>
                  <span className="font-mono text-[11px] tracking-kicker text-amber-300 uppercase">Maybe: {byBucket.maybe.length}</span>
                  <span className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase">Out: {byBucket.out.length}</span>
                  <span className="font-mono text-[11px] tracking-kicker text-gray-400 uppercase">Unsorted: {byBucket.unsorted.length}</span>
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <span className={`font-mono text-[11px] tracking-kicker uppercase
                    ${readyToLock ? 'text-emerald-400' : spotsLeft < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {readyToLock ? 'Exactly right' : spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : `${-spotsLeft} over`}
                  </span>
                  <button onClick={handleLock} disabled={!readyToLock || locking}
                          className="btn-gold text-xs disabled:opacity-40">
                    {locking ? 'Locking…' : `Lock ${listSize}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Bucket tabs */}
            <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
              {BUCKETS.map(b => {
                const count = byBucket[b.id].length
                const isActive = tab === b.id
                return (
                  <button key={b.id} onClick={() => setTab(b.id)}
                    className={`relative px-4 sm:px-5 py-3 font-display text-base tracking-wide transition-all
                      ${isActive ? `${b.color} after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] ${b.bar}` : 'text-gray-500 hover:text-gray-300'}`}>
                    {b.label.toUpperCase()}
                    <span className={`ml-2 font-mono text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/10' : 'bg-white/5 text-gray-500'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
              <Link to="/movies/pool"
                    className="ml-auto self-center font-mono text-[11px] tracking-kicker text-cinema-400 hover:text-cinema-300 uppercase transition-colors">
                ＋ Add more films
              </Link>
            </div>

            {/* Grid */}
            {byBucket[tab].length === 0 ? (
              <div className="card text-center py-14">
                <p className="font-serif italic text-base text-gray-500">
                  {tab === 'unsorted'
                    ? pool.length === 0
                      ? <>Your pool is empty — <Link to="/movies/pool" className="text-cinema-400 hover:text-cinema-300 not-italic">gather some candidates</Link> first.</>
                      : 'Everything is sorted. Check your counts and lock when In is exact.'
                    : `Nothing in ${tab} yet.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {byBucket[tab].map(row => (
                  <div key={row.id} className={`rounded-lg overflow-hidden border transition-all
                    ${row.bucket === 'in' ? 'border-emerald-500/40'
                      : row.bucket === 'maybe' ? 'border-amber-500/40'
                      : row.bucket === 'out' ? 'border-white/5 opacity-70'
                      : 'border-white/10'}`}>
                    <FilmStill src={row.films?.poster_url} title={row.films?.title ?? ''}
                               className="aspect-[2/3]">
                      <div className="absolute inset-x-0 bottom-0 p-2.5 pointer-events-none"
                           style={{ background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.93) 100%)' }}>
                        <p className="font-mono text-[10px] tracking-kicker text-white/60 uppercase">{row.films?.release_year ?? '—'}</p>
                        <p className="font-display text-sm text-white tracking-wide leading-tight line-clamp-2">
                          {row.films?.title?.toUpperCase()}
                        </p>
                      </div>
                    </FilmStill>
                    <BucketButtons row={row} onBucket={handleBucket} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── LOCKED / ROSTER REVEAL ───────────────────────────────────── */}
        {!loading && event && iAmLocked && (
          otherLocked && otherIn ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <span className="kicker">The Rosters</span>
                <span className="flex-1 h-px bg-night-700" />
                <span className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase">
                  {sharedIds.size} shared · titles only — the ranks come later
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RosterColumn
                  title={`${isDustin ? 'Dustin' : otherProf?.display_name ?? 'Dustin'}'s ${listSize}`}
                  accent="film"
                  films={sortedRoster(isDustin ? myInFilms : otherIn)}
                  sharedIds={sharedIds}
                />
                <RosterColumn
                  title={`${!isDustin ? 'Matt' : otherProf?.display_name ?? 'Matt'}'s ${listSize}`}
                  accent="gold"
                  films={sortedRoster(!isDustin ? myInFilms : otherIn)}
                  sharedIds={sharedIds}
                />
              </div>
              <p className="font-serif italic text-sm text-gray-500 mt-6 text-center">
                Next: agree the acclaim sources, then acclaim — one-for-one swaps stay open until scoring begins.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <span className="kicker">Your Locked {listSize}</span>
                <span className="flex-1 h-px bg-night-700" />
                <span className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase">
                  hidden from {otherProf?.display_name ?? 'the other player'} until they lock
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedRoster(myInFilms).map(f => (
                  <FilmStill key={f.id} src={byBucket.in.find(r => r.films?.id === f.id)?.films?.poster_url}
                             title={f.title}
                             className="aspect-[2/3] rounded-lg border border-emerald-500/25">
                    <div className="absolute inset-x-0 bottom-0 p-2.5 pointer-events-none"
                         style={{ background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.93) 100%)' }}>
                      <p className="font-mono text-[10px] tracking-kicker text-white/60 uppercase">{f.release_year ?? '—'}</p>
                      <p className="font-display text-sm text-white tracking-wide leading-tight line-clamp-2">
                        {f.title?.toUpperCase()}
                      </p>
                    </div>
                  </FilmStill>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
