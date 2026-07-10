// MoviesEventAdmin.jsx — Phase 12a: ranking-event control panel (Dustin only)
// Creates a new Canon edition event and drives its status state machine:
// setup → pooling → scoring → locked → revealed → published
// (later phases advance most of these automatically; this panel is the manual override)

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { totalOf, countOf, TEN_FIELDS, IMPACT } from '../../lib/eventScoring'

const STATUS_FLOW = ['setup', 'pooling', 'scoring', 'locked', 'revealed', 'published']

const STATUS_META = {
  setup:     { label: 'Setup',     desc: 'Event created — pools not yet open',            color: 'text-gray-400',    dot: 'bg-gray-500' },
  pooling:   { label: 'Pooling',   desc: 'Players building + cultivating candidate pools', color: 'text-cinema-400',  dot: 'bg-cinema-400' },
  scoring:   { label: 'Scoring',   desc: 'Acclaim agreed — individual scoring underway',   color: 'text-film-400',    dot: 'bg-film-400' },
  locked:    { label: 'Locked',    desc: 'Both lists locked — awaiting the ceremony',      color: 'text-gold-400',    dot: 'bg-gold-400' },
  revealed:  { label: 'Revealed',  desc: 'Ceremony complete — ready to publish',           color: 'text-emerald-400', dot: 'bg-emerald-400' },
  published: { label: 'Published', desc: 'Edition live across the site',                   color: 'text-white',       dot: 'bg-white' },
}

const PLAYER_STATE_LABEL = {
  pooling:    'Building pool',
  cultivated: 'Locked 125',
  scoring:    'Scoring',
  locked:     'List locked',
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.setup
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-kicker uppercase ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

export function TestBadge() {
  return (
    <span className="font-mono text-[9px] tracking-cinema uppercase px-1.5 py-px rounded
                     bg-amber-500/15 border border-amber-500/40 text-amber-300">
      Test
    </span>
  )
}

// ── Status stepper for the active event ───────────────────────────────────────

function StatusStepper({ status }) {
  const currentIdx = STATUS_FLOW.indexOf(status)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_FLOW.map((s, i) => {
        const meta = STATUS_META[s]
        const isPast    = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <span className={`w-4 h-px ${isPast || isCurrent ? 'bg-gold-500/60' : 'bg-night-600'}`} />}
            <span className={`font-mono text-[10px] tracking-kicker uppercase px-2 py-1 rounded-full border transition-all
              ${isCurrent
                ? 'border-gold-500/60 bg-gold-500/10 text-gold-300'
                : isPast
                ? 'border-night-600 text-gray-400'
                : 'border-night-700 text-gray-600'
              }`}>
              {meta.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MoviesEventAdmin() {
  const { isDustin, session } = useAuth()
  const [events, setEvents]     = useState(null)
  const [players, setPlayers]   = useState([])   // event_players rows joined w/ profiles
  const [profiles, setProfiles] = useState([])
  const [error, setError]       = useState(null)
  const [busy, setBusy]         = useState(false)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newLabel, setNewLabel]     = useState('')
  const [newYear, setNewYear]       = useState(String(new Date().getFullYear()))
  const [newIsTest, setNewIsTest]   = useState(false)
  const [newListSize, setNewListSize] = useState('125')

  async function load() {
    const [evRes, plRes, prRes] = await Promise.all([
      supabase.from('ranking_events').select('*').order('year', { ascending: false }),
      supabase.from('event_players').select('*'),
      supabase.from('profiles').select('id, username, display_name'),
    ])
    if (evRes.error) { setError(evRes.error.message); return }
    setEvents(evRes.data || [])
    setPlayers(plRes.data || [])
    setProfiles(prRes.data || [])
  }
  useEffect(() => { load() }, [])

  const activeEvent = useMemo(
    () => (events || []).find(e => e.status !== 'published') ?? null,
    [events],
  )
  const pastEvents = useMemo(
    () => (events || []).filter(e => e.status === 'published'),
    [events],
  )
  const activePlayers = useMemo(
    () => players.filter(p => activeEvent && p.event_id === activeEvent.id),
    [players, activeEvent],
  )

  function profileFor(userId) {
    return profiles.find(p => p.id === userId)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (activeEvent) return
    const year = parseInt(newYear, 10)
    const listSize = parseInt(newListSize, 10)
    if (!newLabel.trim() || !year || !listSize || listSize < 1) return
    setBusy(true); setError(null)
    const { error } = await supabase
      .from('ranking_events')
      .insert({ label: newLabel.trim(), year, status: 'setup', is_test: newIsTest, list_size: listSize })
    if (error) setError(error.message)
    else { setShowCreate(false); setNewLabel(''); setNewIsTest(false); setNewListSize('125'); await load() }
    setBusy(false)
  }

  async function deleteTestEvent(event) {
    if (!event.is_test) return
    if (!window.confirm(`Delete “${event.label}” and ALL its test data (pools, scores, player progress)?\n\nThis cannot be undone — but it's a test, that's the point.`)) return
    setBusy(true); setError(null)
    const { error } = await supabase
      .from('ranking_events').delete().eq('id', event.id).eq('is_test', true)
    if (error) setError(error.message)
    else await load()
    setBusy(false)
  }

  async function ensurePlayers(eventId) {
    // Both players get an event_players row when pooling opens
    const rows = profiles
      .filter(p => ['dustin', 'matt'].includes(p.username))
      .map(p => ({ event_id: eventId, user_id: p.id, state: 'pooling' }))
    if (rows.length === 0) return
    const { error } = await supabase
      .from('event_players')
      .upsert(rows, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    if (error) throw error
  }

  // ── PUBLISH (12g): the one-way door that makes an edition official ───────
  const [publishBusy, setPublishBusy] = useState(false)
  const [cleanWatchlist, setCleanWatchlist] = useState(true)
  const [publishMsg, setPublishMsg] = useState(null)

  async function handlePublish(event) {
    if (event.is_test) { setError('Test events can never publish.'); return }
    if (event.status !== 'revealed') { setError('Publish only after the reveal.'); return }
    if (!window.confirm(
      `Publish ${event.label}?\n\nScores finalize into the permanent rankings and the edition appears across the whole site. This is the one-way door.`
    )) return
    setPublishBusy(true); setError(null); setPublishMsg(null)
    try {
      // Guard: never double-publish
      const { count: existing } = await supabase
        .from('individual_rankings').select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
      if (existing > 0) throw new Error(`This event already has ${existing} published ranking rows.`)

      const { data: scores, error: scErr } = await supabase
        .from('event_scores').select('*').eq('event_id', event.id)
      if (scErr) throw scErr
      const dId = profiles.find(p => p.username === 'dustin')?.id
      const mId = profiles.find(p => p.username === 'matt')?.id
      for (const uid of [dId, mId]) {
        const mine = (scores || []).filter(s => s.user_id === uid && s.rank != null)
        if (mine.length !== event.list_size) {
          throw new Error(`Expected ${event.list_size} ranked films per player, found ${mine.length}. Both lists must be locked.`)
        }
      }

      // 1. Individual rankings (with computed totals + tiebreaker counts)
      const indivRows = (scores || []).map(s => ({
        film_id: s.film_id, event_id: event.id, user_id: s.user_id, rank: s.rank,
        total_score: totalOf(s),
        score_direction: s.score_direction, score_screenplay: s.score_screenplay,
        score_lead_performance: s.score_lead_performance, score_supp_performance: s.score_supp_performance,
        score_cinematography: s.score_cinematography, score_production_design: s.score_production_design,
        score_influence: s.score_influence, score_acclaim: s.score_acclaim,
        score_personal_impact: s.score_personal_impact,
        tb_tens: countOf(s, 10), tb_nines: countOf(s, 9), tb_eights: countOf(s, 8),
      }))
      for (let i = 0; i < indivRows.length; i += 100) {
        const { error } = await supabase.from('individual_rankings').insert(indivRows.slice(i, i + 100))
        if (error) throw error
      }

      // 2. Combined list — same math as the ceremony finale
      const byFilm = {}
      for (const s of scores || []) {
        if (!byFilm[s.film_id]) byFilm[s.film_id] = {}
        byFilm[s.film_id][s.user_id === dId ? 'd' : 'h'] = s
      }
      const combined = Object.entries(byFilm)
        .filter(([, p]) => p.d && p.h)
        .map(([filmId, p]) => ({
          film_id: Number(filmId),
          dustin_rank: p.d.rank, matt_rank: p.h.rank,
          avg_rank: (p.d.rank + p.h.rank) / 2,
          dustin_score: totalOf(p.d), matt_score: totalOf(p.h),
          total_score: totalOf(p.d) + totalOf(p.h),
          dustin_impact: p.d[IMPACT.key] ?? 0, matt_impact: p.h[IMPACT.key] ?? 0,
          total_impact: (p.d[IMPACT.key] ?? 0) + (p.h[IMPACT.key] ?? 0),
          total_tens: TEN_FIELDS.filter(k => p.d[k] === 10).length + TEN_FIELDS.filter(k => p.h[k] === 10).length,
        }))
        .sort((a, b) => a.avg_rank - b.avg_rank || b.total_score - a.total_score
          || b.total_tens - a.total_tens || b.total_impact - a.total_impact)
        .map((row, i) => ({ ...row, event_id: event.id, combined_rank: i + 1 }))
      for (let i = 0; i < combined.length; i += 100) {
        const { error } = await supabase.from('combined_rankings').insert(combined.slice(i, i + 100))
        if (error) throw error
      }

      // 3. Optional: clear published films from MY Future Consideration
      // (RLS is own-rows — the other player tidies their own list)
      let cleaned = 0
      if (cleanWatchlist && session?.user) {
        const filmIds = [...new Set((scores || []).map(s => s.film_id))]
        const { data: deleted } = await supabase
          .from('watchlist').delete()
          .eq('user_id', session.user.id).in('film_id', filmIds)
          .select('id')
        cleaned = deleted?.length ?? 0
      }

      // 4. The edition goes live everywhere
      const { error: evErr } = await supabase
        .from('ranking_events').update({ status: 'published' }).eq('id', event.id)
      if (evErr) throw evErr

      setPublishMsg(`Published: ${indivRows.length} individual rankings, ${combined.length} combined${cleaned ? `, ${cleaned} watchlist entries cleared` : ''}. The edition is live across the site.`)
      await load()
    } catch (err) {
      setError(`Publish failed: ${err.message}`)
    }
    setPublishBusy(false)
  }

  async function advanceStatus(event, direction = 1) {
    const idx  = STATUS_FLOW.indexOf(event.status)
    const next = STATUS_FLOW[idx + direction]
    if (!next) return
    if (direction === 1 && next === 'published') { await handlePublish(event); return }
    const verb = direction === 1 ? `Advance to “${STATUS_META[next].label}”` : `Roll back to “${STATUS_META[next].label}”`
    if (!window.confirm(`${verb}?\n\n${STATUS_META[next].desc}.`)) return
    setBusy(true); setError(null)
    try {
      if (next === 'pooling') await ensurePlayers(event.id)
      const { error } = await supabase
        .from('ranking_events').update({ status: next }).eq('id', event.id)
      if (error) throw error
      await load()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (!isDustin) {
    return (
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-20 text-center">
        <p className="font-display text-3xl text-white tracking-wide">ADMIN ONLY</p>
        <p className="font-serif italic text-base text-gray-400 mt-3">
          Event administration is Dustin's booth. <Link to="/movies" className="text-gold-400 hover:text-gold-300">Back to films →</Link>
        </p>
      </div>
    )
  }

  const currentIdx = activeEvent ? STATUS_FLOW.indexOf(activeEvent.status) : -1

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Link to="/settings" className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors">
            ← SETTINGS
          </Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Ranking Events</span>
        </div>
        <h1 className="font-display text-5xl text-white tracking-wide leading-none">RANKING EVENTS</h1>
        <p className="font-serif italic text-base text-gray-400 mt-3">
          Create the next Canon edition and drive it through pooling, scoring, the reveal, and publication.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Active event ─────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="kicker">Active Event</span>
          <span className="flex-1 h-px bg-night-700" />
        </div>

        {events === null ? (
          <div className="py-10 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">
            LOADING…
          </div>
        ) : activeEvent ? (
          <div className="card p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-display text-3xl text-white tracking-wide leading-none flex items-center gap-2.5">
                  {activeEvent.label.toUpperCase()}
                  {activeEvent.is_test && <TestBadge />}
                </p>
                <p className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase mt-2">
                  {activeEvent.year} Edition · top {activeEvent.list_size ?? 125}
                  {activeEvent.is_test && ' · sandbox — never publishes'}
                </p>
              </div>
              <StatusBadge status={activeEvent.status} />
            </div>

            <StatusStepper status={activeEvent.status} />
            <p className="font-serif italic text-sm text-gray-400">
              {STATUS_META[activeEvent.status].desc}.
            </p>

            {/* Player progress (once pooling has opened) */}
            {activePlayers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePlayers.map(p => {
                  const prof = profileFor(p.user_id)
                  const isD  = prof?.username === 'dustin'
                  return (
                    <div key={p.user_id}
                         className={`rounded-xl border bg-night-900/40 p-4 border-t-2
                           ${isD ? 'border-night-600/60 border-t-film-500' : 'border-night-600/60 border-t-gold-500'}`}>
                      <p className={`font-display text-lg tracking-wide leading-none ${isD ? 'text-film-300' : 'text-gold-300'}`}>
                        {(prof?.display_name ?? '—').toUpperCase()}
                      </p>
                      <p className="font-mono text-[10px] tracking-kicker text-gray-400 uppercase mt-2">
                        {PLAYER_STATE_LABEL[p.state] ?? p.state}
                        {p.locked_at && ` · ${new Date(p.locked_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Publish extras (12g) */}
            {publishMsg && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
                {publishMsg}
              </div>
            )}
            {activeEvent.status === 'revealed' && !activeEvent.is_test && (
              <label className="flex items-center gap-2.5 font-mono text-[11px] tracking-kicker text-gray-400 uppercase cursor-pointer">
                <input type="checkbox" checked={cleanWatchlist} onChange={e => setCleanWatchlist(e.target.checked)}
                       className="accent-gold-500" />
                Also clear published films from my Future Consideration
              </label>
            )}

            {/* Controls — test events stop at Revealed; publishing is for real editions only */}
            <div className="flex items-center gap-3 flex-wrap border-t border-night-700/60 pt-5">
              {currentIdx < STATUS_FLOW.length - 1 &&
               !(activeEvent.is_test && STATUS_FLOW[currentIdx + 1] === 'published') && (
                <button onClick={() => advanceStatus(activeEvent, 1)} disabled={busy || publishBusy}
                        className="btn-gold text-xs disabled:opacity-50">
                  {STATUS_FLOW[currentIdx + 1] === 'published'
                    ? (publishBusy ? 'Publishing…' : '🏁 Publish Edition')
                    : `Advance → ${STATUS_META[STATUS_FLOW[currentIdx + 1]].label}`}
                </button>
              )}
              {activeEvent.is_test && activeEvent.status === 'revealed' && (
                <span className="font-mono text-[10px] tracking-kicker text-amber-300 uppercase">
                  End of the line — test events never publish
                </span>
              )}
              {currentIdx > 0 && (
                <button onClick={() => advanceStatus(activeEvent, -1)} disabled={busy}
                        className="btn-ghost text-xs disabled:opacity-50">
                  ← Back to {STATUS_META[STATUS_FLOW[currentIdx - 1]].label}
                </button>
              )}
              {activeEvent.is_test && (
                <button onClick={() => deleteTestEvent(activeEvent)} disabled={busy}
                        className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-red-400 uppercase transition-colors disabled:opacity-50">
                  ✕ Delete test event
                </button>
              )}
              {['locked', 'revealed'].includes(activeEvent.status) && (
                <Link to="/movies/ceremony"
                      className="font-mono text-[11px] tracking-kicker text-gold-400 hover:text-gold-300 uppercase transition-colors">
                  Ceremony →
                </Link>
              )}
              {activeEvent.status !== 'setup' && (
                <Link to="/movies/pool"
                      className="font-mono text-[11px] tracking-kicker text-cinema-400 hover:text-cinema-300 uppercase transition-colors ml-auto">
                  Pool builder →
                </Link>
              )}
            </div>
          </div>
        ) : showCreate ? (
          <form onSubmit={handleCreate} className="card p-6 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">NEW EDITION</p>

            {/* Real vs. test */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setNewIsTest(false); setNewListSize('125') }}
                className={`rounded-xl px-3 py-2.5 text-left border transition-all
                  ${!newIsTest
                    ? 'bg-gold-500/10 border-gold-500/50 text-gold-300'
                    : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}>
                <p className="font-display text-xs tracking-wide leading-none">THE REAL THING</p>
                <p className="font-mono text-[11px] tracking-kicker text-current/70 mt-1 leading-tight">The next Canon edition</p>
              </button>
              <button type="button" onClick={() => { setNewIsTest(true); setNewListSize('10'); if (!newLabel.trim()) setNewLabel('Test Run') }}
                className={`rounded-xl px-3 py-2.5 text-left border transition-all
                  ${newIsTest
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                    : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}>
                <p className="font-display text-xs tracking-wide leading-none">TEST RUN</p>
                <p className="font-mono text-[11px] tracking-kicker text-current/70 mt-1 leading-tight">Sandbox — never publishes, delete anytime</p>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase block mb-1.5">Label</label>
                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                       placeholder="e.g. 2027 Rankings" className="input w-full text-sm" />
              </div>
              <div>
                <label className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase block mb-1.5">Year</label>
                <input type="number" value={newYear} onChange={e => setNewYear(e.target.value)}
                       className="input w-full text-sm" />
              </div>
              <div>
                <label className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase block mb-1.5">List size</label>
                <input type="number" min="1" value={newListSize} onChange={e => setNewListSize(e.target.value)}
                       className="input w-full text-sm" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={busy || !newLabel.trim()}
                      className="btn-gold text-xs disabled:opacity-50">
                {busy ? 'Creating…' : 'Create Event'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                      className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gray-300 uppercase transition-colors">
                Cancel
              </button>
            </div>
            <p className="font-serif italic text-xs text-gray-500">
              {newIsTest
                ? 'A test run works exactly like the real workflow — same pages, same rules — but wears a TEST badge, can never be published, and can be deleted (with all its data) at any time.'
                : 'The event starts in Setup — nothing is visible to players until you advance it to Pooling.'}
            </p>
          </form>
        ) : (
          <div className="card text-center py-14 space-y-4">
            <p className="font-display text-6xl text-gray-700 tracking-wide leading-none">🎞</p>
            <p className="font-display text-2xl text-white tracking-wide leading-none">NO ACTIVE EVENT</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              All editions are published. Start the next chapter of the Canon whenever you're both ready.
            </p>
            <button onClick={() => setShowCreate(true)} className="btn-gold text-sm mt-2">
              ＋ Create the Next Edition
            </button>
          </div>
        )}
      </div>

      {/* ── Published editions ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="kicker">Published Editions</span>
          <span className="flex-1 h-px bg-night-700" />
        </div>
        <div className="flex flex-col gap-2">
          {(pastEvents || []).map(ev => (
            <div key={ev.id} className="card px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-display text-lg text-white tracking-wide leading-none">
                  {ev.label.toUpperCase()}
                </p>
                <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-1.5">{ev.year}</p>
              </div>
              <StatusBadge status={ev.status} />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
