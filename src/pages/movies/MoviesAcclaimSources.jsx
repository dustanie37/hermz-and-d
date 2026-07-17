// MoviesAcclaimSources.jsx — Phase 12c: confirm the acclaim source lists for an event
//
// Before acclaim opens, the players agree which external lists count as
// official sources. Confirming freezes the set: each chosen list's film-linked
// rows are COPIED into event_list_snapshot, so later re-imports can't change
// the evidence mid-event. Volatile lists carry the snapshot date prominently.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TestBadge } from './MoviesEventAdmin'

// Display metadata for the known imported lists. `volatile` = the source
// changes over time, so the day-of snapshot matters.
const LIST_META = {
  afi_top100:       { label: 'AFI Top 100',              volatile: false },
  afi_comedies:     { label: 'AFI 100 Laughs',           volatile: false },
  imdb_top250:      { label: 'IMDB Top 250',             volatile: true  },
  nfr:              { label: 'National Film Registry',   volatile: true  },
  nyt_2000s:        { label: 'NYT Best of the 2000s',    volatile: false },
  sight_sound:      { label: 'Sight & Sound (2022)',     volatile: false },
  variety_comedies: { label: 'Variety 100 Comedies',     volatile: false },
}

export default function MoviesAcclaimSources() {
  const { isDustin } = useAuth()
  const [event, setEvent]       = useState(undefined)
  const [lists, setLists]       = useState([])     // [{ list_name, entries, linked }]
  const [sources, setSources]   = useState([])     // confirmed event_list_sources rows
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState(null)

  async function load() {
    setLoading(true); setError(null)
    const { data: events, error: evErr } = await supabase
      .from('ranking_events').select('*').neq('status', 'published')
      .order('created_at', { ascending: false }).limit(1)
    if (evErr) { setError(evErr.message); setLoading(false); return }
    const ev = events?.[0] ?? null
    setEvent(ev)
    if (!ev) { setLoading(false); return }

    // Page through ALL entries — a single select caps at 1,000 rows and the
    // lists total ~1,600 (the NFR alone is 900+), which silently undercounts.
    const allEntries = []
    for (let from = 0; ; from += 1000) {
      const { data, error: pageErr } = await supabase
        .from('external_list_entries').select('list_name, film_id')
        .range(from, from + 999)
      if (pageErr) { setError(pageErr.message); setLoading(false); return }
      allEntries.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    const sourcesRes = await supabase.from('event_list_sources').select('*').eq('event_id', ev.id)
    if (sourcesRes.error) { setError(sourcesRes.error.message); setLoading(false); return }

    const agg = {}
    for (const row of allEntries) {
      if (!agg[row.list_name]) agg[row.list_name] = { list_name: row.list_name, entries: 0, linked: 0 }
      agg[row.list_name].entries++
      if (row.film_id != null) agg[row.list_name].linked++
    }
    const listArr = Object.values(agg).sort((a, b) =>
      (LIST_META[a.list_name]?.label ?? a.list_name).localeCompare(LIST_META[b.list_name]?.label ?? b.list_name))
    setLists(listArr)
    setSources(sourcesRes.data || [])
    // Default selection: all lists (or the already-confirmed set)
    setSelected(new Set(
      (sourcesRes.data?.length ? sourcesRes.data.map(s => s.list_name) : listArr.map(l => l.list_name)),
    ))
    setLoading(false)
  }
  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const confirmed = sources.length > 0
  const confirmedAt = confirmed ? sources[0].confirmed_at : null

  function toggle(name) {
    if (confirmed) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  async function handleConfirm() {
    if (!event || selected.size === 0) return
    if (!window.confirm(
      `Confirm ${selected.size} source list${selected.size !== 1 ? 's' : ''} for ${event.label}?\n\nThe set freezes for the whole event — every film gets judged against identical data.`
    )) return
    setBusy(true); setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const now   = new Date().toISOString()
      const sourceRows = [...selected].map(name => ({
        event_id: event.id,
        list_name: name,
        label: LIST_META[name]?.label ?? name,
        volatile: LIST_META[name]?.volatile ?? false,
        snapshot_date: today,
        confirmed_at: now,
      }))
      const { error: srcErr } = await supabase.from('event_list_sources').insert(sourceRows)
      if (srcErr) throw srcErr

      // Freeze the evidence: copy film-linked rows for each confirmed list
      // (paged — same 1,000-row cap caution as the counts above)
      const entries = []
      for (let from = 0; ; from += 1000) {
        const { data, error: entErr } = await supabase
          .from('external_list_entries')
          .select('list_name, film_id, rank')
          .in('list_name', [...selected])
          .not('film_id', 'is', null)
          .range(from, from + 999)
        if (entErr) throw entErr
        entries.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      const snapRows = (entries || []).map(e => ({
        event_id: event.id, list_name: e.list_name, film_id: e.film_id, rank: e.rank,
      }))
      if (snapRows.length) {
        const { error: snapErr } = await supabase
          .from('event_list_snapshot')
          .upsert(snapRows, { onConflict: 'event_id,list_name,film_id', ignoreDuplicates: true })
        if (snapErr) throw snapErr
      }
      await load()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function handleReset() {
    if (!event || !isDustin) return
    if (!window.confirm('Reset the confirmed sources? The frozen snapshot for this event is deleted and the set can be chosen again.')) return
    setBusy(true); setError(null)
    const del1 = await supabase.from('event_list_snapshot').delete().eq('event_id', event.id)
    const del2 = await supabase.from('event_list_sources').delete().eq('event_id', event.id)
    if (del1.error || del2.error) setError((del1.error || del2.error).message)
    else await load()
    setBusy(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Link to="/movies/cultivate" className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors">
            ← CULTIVATION
          </Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-[11px] tracking-kicker text-white uppercase inline-flex items-center gap-2">
            Acclaim Sources {event?.is_test && <TestBadge />}
          </span>
        </div>
        <h1 className="font-display text-5xl text-white tracking-wide leading-none">ACCLAIM SOURCES</h1>
        <p className="font-sans text-base text-gray-300 mt-3">
          Agree the official lists for {event?.label ?? 'the event'} — confirming freezes the set so every film
          is judged against identical data.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING…</div>
      ) : !event ? (
        <div className="card text-center py-16">
          <p className="font-sans text-base text-gray-400">No active event.</p>
        </div>
      ) : (
        <>
          {/* Status banner */}
          <div className={`mb-6 p-4 rounded-xl border text-sm flex items-center justify-between gap-4 flex-wrap
            ${confirmed
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-gold-500/30 bg-gold-500/10 text-gold-300'}`}>
            <span>
              {confirmed
                ? `Source set confirmed ${confirmedAt ? new Date(confirmedAt).toLocaleDateString() : ''} — ${sources.length} lists frozen for this event.`
                : 'Not yet confirmed — tick the lists that count, then freeze the set.'}
            </span>
            {confirmed && isDustin && (
              <button onClick={handleReset} disabled={busy}
                      className="font-mono text-[11px] tracking-kicker text-gray-400 hover:text-red-400 uppercase transition-colors">
                Reset
              </button>
            )}
          </div>

          {/* List picker */}
          <div className="flex flex-col gap-3 mb-8">
            {lists.map(l => {
              const meta = LIST_META[l.list_name] ?? { label: l.list_name, volatile: false }
              const isOn = selected.has(l.list_name)
              const src  = sources.find(s => s.list_name === l.list_name)
              return (
                <button key={l.list_name} onClick={() => toggle(l.list_name)}
                  disabled={confirmed}
                  className={`card px-5 py-4 flex items-center gap-4 text-left transition-all
                    ${confirmed
                      ? src ? 'border-emerald-500/30' : 'opacity-40'
                      : isOn ? 'border-gold-500/50' : 'opacity-60 hover:opacity-90'}`}>
                  <span className={`w-5 h-5 rounded flex items-center justify-center border text-xs flex-shrink-0
                    ${(confirmed ? !!src : isOn)
                      ? 'bg-gold-500 border-gold-500 text-night-950'
                      : 'border-night-600 text-transparent'}`}>✓</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg text-white tracking-wide leading-none flex items-center gap-2">
                      {meta.label.toUpperCase()}
                      {meta.volatile && (
                        <span className="font-mono text-[9px] tracking-cinema uppercase px-1.5 py-px rounded
                                         bg-cinema-500/10 border border-cinema-500/30 text-cinema-300">
                          {src?.snapshot_date ? `snapshot ${src.snapshot_date}` : 'volatile — snapshotted on confirm'}
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-1.5">
                      {l.entries} entries · {l.linked} in our database
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {!confirmed && (
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={handleConfirm} disabled={busy || selected.size === 0}
                      className="btn-gold text-sm disabled:opacity-50">
                {busy ? 'Freezing…' : `Confirm ${selected.size} Source${selected.size !== 1 ? 's' : ''}`}
              </button>
              <p className="font-sans text-sm text-gray-400 max-w-md">
                Volatile lists (IMDB Top 250, National Film Registry) are frozen as they exist right now —
                re-import them first if you want fresher data.
              </p>
            </div>
          )}

          {confirmed && (
            <div className="text-center">
              <Link to="/movies/event-acclaim" className="btn-gold text-sm inline-block">
                Open the Acclaim Workspace →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
