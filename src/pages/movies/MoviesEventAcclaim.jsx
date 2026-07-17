// MoviesEventAcclaim.jsx — Phase 12c: the event acclaim workspace
//
// Works the union of both locked lists (mutually visible since the roster
// reveal). Each film shows its evidence — appearances on the event's CONFIRMED
// source lists (from the frozen snapshot, never live data) plus its Oscar
// record — and the jointly-agreed acclaim score (/10), which writes to
// films.acclaim_score (the app's established store).
// Auto-suggest lands here once the rules questionnaire is answered.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import FilmStill from '../../components/FilmStill'
import { sortTitle } from '../../lib/helpers'
import { TestBadge } from './MoviesEventAdmin'

const LOCKED_STATES = ['cultivated', 'scoring', 'locked']

const MEMBER_META = {
  both:  { label: 'Both lists', cls: 'bg-cinema-500/10 border-cinema-500/30 text-cinema-300' },
  d:     { label: 'D only',     cls: 'bg-film-500/10 border-film-500/30 text-film-300' },
  hermz: { label: 'Hermz only', cls: 'bg-gold-500/10 border-gold-500/30 text-gold-300' },
}

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'unscored', label: 'Unscored' },
  { id: 'both',     label: 'Both lists' },
  { id: 'd',        label: 'D only' },
  { id: 'hermz',    label: 'Hermz only' },
]

// ── Inline score editor (pattern from MoviesAcclaim) ──────────────────────────

function ScoreCell({ film, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function open() {
    setVal(film.acclaim_score != null ? String(film.acclaim_score) : '')
    setEditing(true)
  }

  async function save() {
    const parsed = val === '' ? null : Math.max(0, Math.min(10, parseInt(val, 10)))
    if (Number.isNaN(parsed)) { setEditing(false); return }
    setSaving(true)
    const { error } = await supabase.from('films').update({ acclaim_score: parsed }).eq('id', film.id)
    setSaving(false); setEditing(false)
    if (!error) onSaved(film.id, parsed)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input ref={inputRef} type="number" min="0" max="10" value={val}
               onChange={e => setVal(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
               className="input w-16 text-center text-sm" />
        <button onClick={save} disabled={saving} className="btn-gold text-xs px-2.5 py-1.5 disabled:opacity-50">
          {saving ? '…' : '✓'}
        </button>
      </div>
    )
  }
  return (
    <button onClick={open} className="group/score flex items-baseline gap-1" title="Set agreed acclaim">
      {film.acclaim_score != null ? (
        <>
          <span className="font-display text-3xl text-gold-400 tracking-wide leading-none group-hover/score:text-gold-300">
            {film.acclaim_score}
          </span>
          <span className="font-mono text-[10px] tracking-kicker text-gray-500">/10</span>
        </>
      ) : (
        <span className="font-mono text-[11px] tracking-kicker uppercase text-gray-500 border border-dashed
                         border-gray-600 rounded-lg px-2.5 py-1.5 group-hover/score:text-gold-300
                         group-hover/score:border-gold-500/50 transition-all">
          Score
        </span>
      )}
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MoviesEventAcclaim() {
  const { session } = useAuth()
  const user = session?.user

  const [event, setEvent]       = useState(undefined)
  const [players, setPlayers]   = useState([])
  const [profiles, setProfiles] = useState([])
  const [sources, setSources]   = useState([])
  const [rows, setRows]         = useState([])   // union films w/ membership + evidence
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [filter, setFilter]     = useState('all')
  const [advancing, setAdvancing] = useState(false)

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

      const [plRes, prRes, srcRes, poolRes, snapRes] = await Promise.all([
        supabase.from('event_players').select('*').eq('event_id', ev.id),
        supabase.from('profiles').select('id, username'),
        supabase.from('event_list_sources').select('*').eq('event_id', ev.id),
        supabase.from('event_pool')
          .select('user_id, film_id, films (id, title, release_year, poster_url, acclaim_score, oscar_nominations, oscar_wins)')
          .eq('event_id', ev.id).eq('bucket', 'in'),
        supabase.from('event_list_snapshot').select('*').eq('event_id', ev.id),
      ])
      const err = plRes.error || prRes.error || srcRes.error || poolRes.error || snapRes.error
      if (err) { setError(err.message); setLoading(false); return }

      setPlayers(plRes.data || [])
      setProfiles(prRes.data || [])
      setSources(srcRes.data || [])

      // Build union with membership
      const dustinId = (prRes.data || []).find(p => p.username === 'dustin')?.id
      const byFilm = new Map()
      for (const r of poolRes.data || []) {
        if (!r.films) continue
        if (!byFilm.has(r.film_id)) byFilm.set(r.film_id, { film: r.films, users: new Set() })
        byFilm.get(r.film_id).users.add(r.user_id)
      }
      // Evidence index
      const evidence = {}
      for (const s of snapRes.data || []) {
        if (!evidence[s.film_id]) evidence[s.film_id] = []
        evidence[s.film_id].push({ list_name: s.list_name, rank: s.rank })
      }
      const labelFor = Object.fromEntries((srcRes.data || []).map(s => [s.list_name, s.label ?? s.list_name]))

      const built = [...byFilm.values()].map(({ film, users }) => ({
        ...film,
        membership: users.size > 1 ? 'both' : users.has(dustinId) ? 'd' : 'hermz',
        evidence: (evidence[film.id] || [])
          .map(e => ({ ...e, label: labelFor[e.list_name] ?? e.list_name }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      }))
      built.sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
      setRows(built)
      setLoading(false)
    }
    load()
  }, [user])

  const bothLocked = useMemo(() => {
    if (players.length < 2) return false
    return players.every(p => LOCKED_STATES.includes(p.state))
  }, [players])

  const confirmed = sources.length > 0
  const ready = event && bothLocked && confirmed

  const filtered = useMemo(() => rows.filter(r => {
    if (filter === 'unscored') return r.acclaim_score == null
    if (filter === 'both' || filter === 'd' || filter === 'hermz') return r.membership === filter
    return true
  }), [rows, filter])

  const scoredCount = rows.filter(r => r.acclaim_score != null).length
  const isDustin = profiles.find(p => p.id === user?.id)?.username === 'dustin'
  const allAgreed = rows.length > 0 && scoredCount === rows.length

  function handleSaved(filmId, score) {
    setRows(prev => prev.map(r => r.id === filmId ? { ...r, acclaim_score: score } : r))
  }

  async function advanceToScoring() {
    if (!event || event.status !== 'pooling') return
    if (!window.confirm('Open scoring?\n\nBoth of you move into the ranking round, with these agreed acclaim scores locked in.')) return
    setAdvancing(true); setError(null)
    const { error: advErr } = await supabase.from('ranking_events').update({ status: 'scoring' }).eq('id', event.id)
    if (advErr) { setError(advErr.message); setAdvancing(false); return }
    setEvent(prev => ({ ...prev, status: 'scoring' }))
    setAdvancing(false)
  }

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <FilmStill title="Acclaim" hue={45} mood="warm" className="w-full h-[300px] sm:h-[340px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies/cultivate" className="font-mono text-[11px] tracking-kicker text-gold-400 hover:text-gold-300 transition-colors">
              ← CULTIVATION
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase inline-flex items-center gap-2">
              {event?.label ?? 'Acclaim'} {event?.is_test && <TestBadge />}
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            AGREE THE ACCLAIM
          </h1>
          <p className="font-sans text-base text-gray-300 mt-3">
            One score per film, settled together — the union of both lists, judged against the confirmed sources.
            {ready && !loading && (
              <span className="text-gray-300 ml-2">· {scoredCount} of {rows.length} scored</span>
            )}
          </p>
        </div>
      </FilmStill>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8">

        {loading && (
          <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING…</div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">{error}</div>
        )}

        {!loading && !ready && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">NOT YET</p>
            <p className="font-sans text-base text-gray-300 max-w-md mx-auto">
              {!event
                ? 'There\'s no active event.'
                : !bothLocked
                ? 'Acclaim opens once both players have locked their lists.'
                : <>The source lists haven't been confirmed. <Link to="/movies/acclaim-sources" className="text-gold-400 hover:text-gold-300 not-italic">Confirm them first →</Link></>}
            </p>
          </div>
        )}

        {!loading && ready && (
          <>
            {/* Advance banner — makes "acclaim done, move to scoring" unmistakable */}
            <div className={`mb-6 rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3
              ${allAgreed && event.status === 'pooling' ? 'border-gold-500/50 bg-gold-500/[0.07]' : 'border-night-600 bg-night-800/40'}`}>
              <div className="flex-1">
                <p className="font-display text-2xl text-white tracking-wide leading-none">
                  {event.status !== 'pooling'
                    ? 'SCORING IS OPEN'
                    : allAgreed ? 'ACCLAIM AGREED — READY TO SCORE' : `ACCLAIM · ${scoredCount} OF ${rows.length} AGREED`}
                </p>
                <p className="font-sans text-sm text-gray-300 mt-1.5">
                  {event.status !== 'pooling'
                    ? 'Acclaim is settled and scoring has begun — head to the scoring page when you\'re ready.'
                    : allAgreed
                    ? (isDustin
                        ? 'Every film has an agreed score. Open scoring to move you both into the ranking round.'
                        : 'Every film has an agreed score. Dustin can open scoring whenever you\'re both happy with these.')
                    : `Agree a score on the ${rows.length - scoredCount} film${rows.length - scoredCount === 1 ? '' : 's'} still showing “—”, then you can move on to scoring.`}
                </p>
              </div>
              {event.status !== 'pooling' ? (
                <Link to="/movies/score" className="btn-gold text-sm whitespace-nowrap self-start sm:self-auto">Go to Scoring →</Link>
              ) : allAgreed && isDustin ? (
                <button onClick={advanceToScoring} disabled={advancing}
                        className="btn-gold text-sm whitespace-nowrap self-start sm:self-auto disabled:opacity-50">
                  {advancing ? 'Opening…' : 'Open Scoring →'}
                </button>
              ) : null}
            </div>

            {/* Filters + sources summary */}
            <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06] flex-wrap">
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`relative px-4 py-3 font-display text-base tracking-wide transition-all
                    ${filter === f.id
                      ? 'text-gold-400 after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-gold-400'
                      : 'text-gray-500 hover:text-gray-300'}`}>
                  {f.label.toUpperCase()}
                </button>
              ))}
              <span className="ml-auto self-center font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
                {sources.length} confirmed sources · <Link to="/movies/acclaim-sources" className="text-gold-500 hover:text-gold-400">view</Link>
              </span>
            </div>

            {/* Auto-suggest placeholder note */}
            <p className="font-sans text-sm text-gray-300 mb-6">
              Suggested scores will appear here once the acclaim rules are settled — for now, the evidence is laid
              out and the verdict is yours.
            </p>

            {/* Frozen-queue warning (12d): once a player begins scoring, their
                queue carries the acclaim values as they were at that moment */}
            {players.some(p => ['scoring', 'locked'].includes(p.state)) && (
              <div className="mb-6 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm text-amber-300">
                {players.filter(p => ['scoring', 'locked'].includes(p.state))
                  .map(p => profiles.find(pr => pr.id === p.user_id)?.username === 'dustin' ? 'Dustin' : 'Matt')
                  .join(' and ')} already began scoring — their queue froze the acclaim values as they were.
                Changes here won't reach a queue that already exists, so late edits need to be agreed before anyone starts.
              </div>
            )}

            {/* Rows */}
            <div className="flex flex-col gap-3">
              {filtered.map(film => (
                <div key={film.id} className="card px-4 py-3.5 flex items-center gap-4">
                  <FilmStill src={film.poster_url} title={film.title}
                             className="w-12 h-[68px] rounded border border-white/10 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{film.title}</p>
                      <span className="font-mono text-[10px] tracking-kicker text-gray-500">{film.release_year ?? ''}</span>
                      <span className={`font-mono text-[9px] tracking-cinema uppercase px-1.5 py-px rounded border ${MEMBER_META[film.membership].cls}`}>
                        {MEMBER_META[film.membership].label}
                      </span>
                    </div>
                    {/* Evidence */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {film.evidence.map(e => (
                        <span key={e.list_name}
                              className="font-mono text-[10px] tracking-kicker px-2 py-0.5 rounded-full
                                         bg-night-700/70 border border-night-600 text-gray-300">
                          {e.label}{e.rank != null && <span className="text-gold-400"> #{e.rank}</span>}
                        </span>
                      ))}
                      {(film.oscar_nominations > 0 || film.oscar_wins > 0) && (
                        <span className="font-mono text-[10px] tracking-kicker px-2 py-0.5 rounded-full
                                         bg-gold-500/10 border border-gold-500/30 text-gold-300">
                          {film.oscar_wins > 0 ? `${film.oscar_wins} Oscar win${film.oscar_wins !== 1 ? 's' : ''} · ` : ''}
                          {film.oscar_nominations} nom{film.oscar_nominations !== 1 ? 's' : ''}
                        </span>
                      )}
                      {film.evidence.length === 0 && !film.oscar_nominations && !film.oscar_wins && (
                        <span className="font-mono text-[10px] tracking-kicker text-gray-600 uppercase">no source appearances</span>
                      )}
                    </div>
                  </div>
                  <ScoreCell film={film} onSaved={handleSaved} />
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="card text-center py-12">
                  <p className="font-sans text-base text-gray-300">Nothing matches this filter.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
