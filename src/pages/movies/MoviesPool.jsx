// MoviesPool.jsx — Phase 12a: candidate pool building for the active ranking event
//
// Each player builds their own PRIVATE pool (RLS: own rows only) via three
// intake paths: prior-edition rankings, the Future Consideration watchlist,
// and manual OMDB search (new films are created + fully enriched on add —
// see lib/filmEnrich.js). Cultivation to exactly 125 (triage buckets) is 12b.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { searchFilmsByQuery } from '../../lib/omdb'
import { createAndEnrichFilm } from '../../lib/filmEnrich'
import FilmStill from '../../components/FilmStill'
import { sortTitle } from '../../lib/helpers'

const SOURCE_META = {
  prior:     { label: 'Prior Edition', color: 'text-film-400',   chip: 'bg-film-500/15 text-film-300 border-film-500/30' },
  watchlist: { label: 'Watchlist',     color: 'text-cinema-400', chip: 'bg-cinema-500/15 text-cinema-300 border-cinema-500/30' },
  manual:    { label: 'Search',        color: 'text-gold-400',   chip: 'bg-gold-500/15 text-gold-300 border-gold-500/30' },
}

const INTAKE_TABS = [
  { id: 'prior',     label: 'Prior Editions' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'manual',    label: 'Search' },
]

// ── Small pieces ──────────────────────────────────────────────────────────────

function EditionBadges({ years }) {
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {years.map(y => (
        <span key={y} className="font-mono text-[9px] tracking-cinema px-1.5 py-px rounded
                                 bg-film-500/10 border border-film-500/30 text-film-300">
          {y}
        </span>
      ))}
    </span>
  )
}

function AddState({ state, onAdd }) {
  if (state === 'in')     return <span className="font-mono text-[11px] tracking-kicker text-emerald-400 uppercase whitespace-nowrap">✓ In pool</span>
  if (state === 'adding') return <span className="font-mono text-[11px] tracking-kicker text-gray-400 uppercase whitespace-nowrap animate-pulse">Adding…</span>
  return (
    <button onClick={onAdd} className="btn-film text-xs px-3 py-1.5 whitespace-nowrap">＋ Add</button>
  )
}

// ── Intake row (shared by prior + watchlist lists) ────────────────────────────

function IntakeRow({ poster, title, year, right, sub }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors">
      <FilmStill src={poster} title={title}
                 className="w-10 h-14 rounded border border-white/10 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        <p className="font-mono text-[11px] tracking-kicker text-gray-500 mt-0.5 uppercase flex items-center gap-2">
          {year ?? '—'} {sub}
        </p>
      </div>
      {right}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MoviesPool() {
  const { session, isDustin } = useAuth()
  const user = session?.user

  const [event, setEvent]       = useState(undefined)  // undefined = loading, null = none
  const [pool, setPool]         = useState([])
  const [prior, setPrior]       = useState([])          // [{ film, years: [] }]
  const [watch, setWatch]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [tab, setTab]           = useState('prior')
  const [addingIds, setAddingIds] = useState(new Set())  // film ids / watchlist ids / imdb ids in flight
  const [bulkAdding, setBulkAdding] = useState(false)
  const [notice, setNotice]     = useState(null)

  // Manual search
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState(null)
  const searchRef = useRef(null)

  // ── Load everything ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true); setError(null)

      // Active (non-published) event
      const { data: events, error: evErr } = await supabase
        .from('ranking_events').select('*').neq('status', 'published')
        .order('created_at', { ascending: false }).limit(1)
      if (evErr) { setError(evErr.message); setLoading(false); return }
      const ev = events?.[0] ?? null
      setEvent(ev)
      if (!ev) { setLoading(false); return }

      const [poolRes, ranksRes, eventsRes, watchRes] = await Promise.all([
        supabase.from('event_pool')
          .select('*, films (id, title, release_year, poster_url)')
          .eq('event_id', ev.id).eq('user_id', user.id),
        supabase.from('individual_rankings')
          .select('film_id, event_id, films (id, title, release_year, poster_url)')
          .eq('user_id', user.id),
        supabase.from('ranking_events').select('id, year').eq('status', 'published'),
        supabase.from('watchlist').select('*').eq('user_id', user.id),
      ])
      const err = poolRes.error || ranksRes.error || eventsRes.error || watchRes.error
      if (err) { setError(err.message); setLoading(false); return }

      setPool(poolRes.data || [])

      // Dedupe prior rankings into { film, years[] }
      const yearById = Object.fromEntries((eventsRes.data || []).map(e => [e.id, e.year]))
      const byFilm = new Map()
      for (const r of ranksRes.data || []) {
        if (!r.films) continue
        if (!byFilm.has(r.film_id)) byFilm.set(r.film_id, { film: r.films, years: [] })
        const y = yearById[r.event_id]
        if (y && !byFilm.get(r.film_id).years.includes(y)) byFilm.get(r.film_id).years.push(y)
      }
      const priorList = [...byFilm.values()]
      priorList.forEach(p => p.years.sort())
      priorList.sort((a, b) => sortTitle(a.film.title).localeCompare(sortTitle(b.film.title)))
      setPrior(priorList)

      const watchSorted = [...(watchRes.data || [])]
        .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
      setWatch(watchSorted)
      setLoading(false)
    }
    load()
  }, [user])

  useEffect(() => {
    if (tab === 'manual') searchRef.current?.focus()
  }, [tab])

  const poolFilmIds = useMemo(() => new Set(pool.map(p => p.film_id)), [pool])
  const poolSorted  = useMemo(
    () => [...pool].sort((a, b) => sortTitle(a.films?.title ?? '').localeCompare(sortTitle(b.films?.title ?? ''))),
    [pool],
  )
  const sourceCounts = useMemo(() => {
    const c = { prior: 0, watchlist: 0, manual: 0 }
    pool.forEach(p => { c[p.source] = (c[p.source] ?? 0) + 1 })
    return c
  }, [pool])

  const priorRemaining = useMemo(() => prior.filter(p => !poolFilmIds.has(p.film.id)), [prior, poolFilmIds])

  function markAdding(key, on) {
    setAddingIds(prev => {
      const next = new Set(prev)
      if (on) next.add(key); else next.delete(key)
      return next
    })
  }

  // ── Add paths ───────────────────────────────────────────────────────────

  async function addFilmToPool(filmId, source) {
    const { data, error } = await supabase
      .from('event_pool')
      .upsert(
        { event_id: event.id, user_id: user.id, film_id: filmId, source },
        { onConflict: 'event_id,user_id,film_id', ignoreDuplicates: true },
      )
      .select('*, films (id, title, release_year, poster_url)')
    if (error) throw error
    if (data?.length) setPool(prev => [...prev, ...data])
  }

  async function handleAddPrior(entry) {
    const key = `f${entry.film.id}`
    markAdding(key, true)
    try { await addFilmToPool(entry.film.id, 'prior') }
    catch (err) { setError(err.message) }
    markAdding(key, false)
  }

  async function handleAddAllPrior() {
    if (!priorRemaining.length) return
    if (!window.confirm(`Add all ${priorRemaining.length} films from your past editions to the pool?`)) return
    setBulkAdding(true); setError(null)
    const rows = priorRemaining.map(p => ({
      event_id: event.id, user_id: user.id, film_id: p.film.id, source: 'prior',
    }))
    const { data, error } = await supabase
      .from('event_pool')
      .upsert(rows, { onConflict: 'event_id,user_id,film_id', ignoreDuplicates: true })
      .select('*, films (id, title, release_year, poster_url)')
    if (error) setError(error.message)
    else if (data?.length) setPool(prev => [...prev, ...data])
    setBulkAdding(false)
  }

  async function handleAddWatch(item) {
    const key = `w${item.id}`
    markAdding(key, true); setError(null)
    try {
      let filmId = item.film_id
      if (!filmId && item.imdb_id) {
        // Film isn't in the database yet — create + enrich it now (no backfill debt)
        const res = await createAndEnrichFilm(item.imdb_id)
        filmId = res.filmId
        // Link the watchlist row so the film connects everywhere
        await supabase.from('watchlist').update({ film_id: filmId }).eq('id', item.id).eq('user_id', user.id)
        setWatch(prev => prev.map(w => w.id === item.id ? { ...w, film_id: filmId } : w))
        if (res.warnings.length) setNotice(`${item.title} added — enrichment notes: ${res.warnings.join(' · ')}`)
      }
      if (!filmId) throw new Error('No IMDb link on this watchlist entry')
      await addFilmToPool(filmId, 'watchlist')
    } catch (err) {
      setError(err.message)
    }
    markAdding(key, false)
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true); setSearchErr(null); setResults([])
    try {
      const hits = await searchFilmsByQuery(query.trim())
      if (hits.length === 0) setSearchErr('No results found. Try a different title.')
      setResults(hits)
    } catch {
      setSearchErr('Search failed. Check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  async function handleAddManual(item) {
    const key = `m${item.imdbId}`
    markAdding(key, true); setError(null)
    try {
      const res = await createAndEnrichFilm(item.imdbId)
      await addFilmToPool(res.filmId, 'manual')
      if (res.created) {
        setNotice(res.warnings.length
          ? `${item.title} created — enrichment notes: ${res.warnings.join(' · ')}`
          : `${item.title} created and fully enriched (cast + Oscar record).`)
      }
    } catch (err) {
      setError(err.message)
    }
    markAdding(key, false)
  }

  async function handleRemove(poolRow) {
    const { error } = await supabase
      .from('event_pool').delete().eq('id', poolRow.id).eq('user_id', user.id)
    if (error) setError(error.message)
    else setPool(prev => prev.filter(p => p.id !== poolRow.id))
  }

  // Search-result add-state needs film lookups by imdb id — pool rows carry films
  const [imdbInPool, setImdbInPool] = useState(new Set())
  useEffect(() => {
    // Resolve which search results are already pooled (by checking films.omdb_id)
    async function check() {
      if (!results.length || !event) return
      const ids = results.map(r => r.imdbId)
      const { data } = await supabase.from('films').select('id, omdb_id').in('omdb_id', ids)
      const inPool = new Set(
        (data || []).filter(f => poolFilmIds.has(f.id)).map(f => f.omdb_id),
      )
      setImdbInPool(inPool)
    }
    check()
  }, [results, poolFilmIds, event])

  // ── Gates ───────────────────────────────────────────────────────────────

  const poolingOpen = event && event.status === 'pooling'

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <FilmStill title="Pool Building" hue={222} mood="cool" className="w-full h-[300px] sm:h-[340px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-[11px] tracking-kicker text-film-400 hover:text-film-300 transition-colors">
              ← FILMS
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase">
              {event?.label ?? 'Next Edition'}
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            BUILD YOUR POOL
          </h1>
          <p className="font-serif italic text-base text-gray-400 mt-3">
            Gather every candidate worth considering — you'll cultivate down to exactly 125 next.
            {!loading && poolingOpen && (
              <span className="text-gray-300 ml-2">· {pool.length} in your pool</span>
            )}
          </p>
        </div>
      </FilmStill>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {/* ── Gate states ──────────────────────────────────────────────── */}
        {loading && (
          <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">
            LOADING…
          </div>
        )}

        {!loading && event === null && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-6xl text-gray-700 leading-none">🎬</p>
            <p className="font-display text-2xl text-white tracking-wide leading-none">NO ACTIVE EVENT</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              The next Canon edition hasn't been created yet.
              {isDustin && <> Start one from the <Link to="/movies/event-admin" className="text-gold-400 hover:text-gold-300">event admin</Link>.</>}
            </p>
          </div>
        )}

        {!loading && event && event.status === 'setup' && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-6xl text-gray-700 leading-none">🎞</p>
            <p className="font-display text-2xl text-white tracking-wide leading-none">
              {event.label.toUpperCase()} IS COMING
            </p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              The event exists but pooling hasn't opened yet.
              {isDustin && <> Open it from the <Link to="/movies/event-admin" className="text-gold-400 hover:text-gold-300">event admin</Link>.</>}
            </p>
          </div>
        )}

        {!loading && event && !poolingOpen && event.status !== 'setup' && (
          <div className="card text-center py-16 space-y-4">
            <p className="font-display text-2xl text-white tracking-wide leading-none">POOLING IS CLOSED</p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              {event.label} has moved on to the {event.status} stage.
            </p>
          </div>
        )}

        {/* ── Pool building ────────────────────────────────────────────── */}
        {!loading && poolingOpen && (
          <>
            {error && (
              <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300 flex items-start justify-between gap-4">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
              </div>
            )}
            {notice && (
              <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300 flex items-start justify-between gap-4">
                <span>{notice}</span>
                <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-emerald-200">✕</button>
              </div>
            )}

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="card px-5 py-4">
                <p className="font-display text-4xl leading-none text-white">{pool.length}</p>
                <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-2">In your pool</p>
              </div>
              {INTAKE_TABS.map(t => (
                <div key={t.id} className="card px-5 py-4">
                  <p className={`font-display text-4xl leading-none ${SOURCE_META[t.id].color}`}>{sourceCounts[t.id]}</p>
                  <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-2">from {SOURCE_META[t.id].label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

              {/* ── Intake panel ─────────────────────────────────────── */}
              <div className="lg:col-span-2">
                <div className="card p-0 overflow-hidden lg:sticky lg:top-20">
                  {/* Tabs */}
                  <div className="flex border-b border-night-700/60">
                    {INTAKE_TABS.map(t => (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex-1 px-3 py-3.5 font-display text-sm tracking-wide transition-all relative
                          ${tab === t.id
                            ? `${SOURCE_META[t.id].color} after:absolute after:bottom-0 after:inset-x-0 after:h-[2px]
                               ${t.id === 'prior' ? 'after:bg-film-400' : t.id === 'watchlist' ? 'after:bg-cinema-400' : 'after:bg-gold-400'}`
                            : 'text-gray-500 hover:text-gray-300'}`}>
                        {t.label.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Prior editions */}
                  {tab === 'prior' && (
                    <div>
                      <div className="p-4 border-b border-night-700/60 flex items-center justify-between gap-3">
                        <p className="font-serif italic text-xs text-gray-500">
                          Every film from your past ranked lists, deduped.
                        </p>
                        <button onClick={handleAddAllPrior}
                                disabled={bulkAdding || priorRemaining.length === 0}
                                className="btn-film text-xs whitespace-nowrap disabled:opacity-50">
                          {bulkAdding ? 'Adding…' : `＋ Add all ${priorRemaining.length}`}
                        </button>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto p-2">
                        {prior.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-8 italic">No prior rankings found.</p>
                        )}
                        {prior.map(entry => (
                          <IntakeRow key={entry.film.id}
                            poster={entry.film.poster_url} title={entry.film.title}
                            year={entry.film.release_year}
                            sub={<EditionBadges years={entry.years} />}
                            right={
                              <AddState
                                state={poolFilmIds.has(entry.film.id) ? 'in' : addingIds.has(`f${entry.film.id}`) ? 'adding' : 'out'}
                                onAdd={() => handleAddPrior(entry)}
                              />
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Watchlist */}
                  {tab === 'watchlist' && (
                    <div>
                      <div className="p-4 border-b border-night-700/60">
                        <p className="font-serif italic text-xs text-gray-500">
                          Your Future Consideration lists. New films are created and enriched on add.
                        </p>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto p-2">
                        {watch.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-8 italic">
                            Your watchlist is empty. <Link to="/movies/watchlist" className="text-cinema-400 hover:text-cinema-300 not-italic">Open Future Consideration →</Link>
                          </p>
                        )}
                        {watch.map(item => {
                          const inPool = item.film_id && poolFilmIds.has(item.film_id)
                          const canAdd = item.film_id || item.imdb_id
                          return (
                            <IntakeRow key={item.id}
                              poster={item.poster_url} title={item.title} year={item.year}
                              sub={!canAdd && <span className="text-gray-600">no IMDb link</span>}
                              right={
                                canAdd ? (
                                  <AddState
                                    state={inPool ? 'in' : addingIds.has(`w${item.id}`) ? 'adding' : 'out'}
                                    onAdd={() => handleAddWatch(item)}
                                  />
                                ) : (
                                  <span className="font-mono text-[10px] tracking-kicker text-gray-600 uppercase">—</span>
                                )
                              }
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manual search */}
                  {tab === 'manual' && (
                    <div>
                      <div className="p-4 border-b border-night-700/60">
                        <form onSubmit={handleSearch} className="flex gap-2">
                          <input ref={searchRef} type="text" value={query}
                                 onChange={e => setQuery(e.target.value)}
                                 placeholder="Search any film…" className="input flex-1 text-sm" />
                          <button type="submit" disabled={searching || !query.trim()}
                                  className="btn-gold text-sm px-4 disabled:opacity-50">
                            {searching ? '…' : 'Search'}
                          </button>
                        </form>
                        {searchErr && <p className="text-xs text-red-400 mt-2">{searchErr}</p>}
                        <p className="font-serif italic text-xs text-gray-500 mt-2">
                          Films not yet in the database are created and enriched automatically.
                        </p>
                      </div>
                      <div className="max-h-[480px] overflow-y-auto p-2">
                        {results.length === 0 && !searching && (
                          <p className="text-sm text-gray-500 text-center py-8 italic">Search for a film to add it.</p>
                        )}
                        {results.map(item => (
                          <IntakeRow key={item.imdbId}
                            poster={item.posterUrl} title={item.title} year={item.year}
                            right={
                              <AddState
                                state={imdbInPool.has(item.imdbId) ? 'in' : addingIds.has(`m${item.imdbId}`) ? 'adding' : 'out'}
                                onAdd={() => handleAddManual(item)}
                              />
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Pool grid ────────────────────────────────────────── */}
              <div className="lg:col-span-3">
                <div className="flex items-center gap-3 mb-4">
                  <span className="kicker">Your Pool</span>
                  <span className="flex-1 h-px bg-night-700" />
                  <span className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase">
                    {pool.length} film{pool.length !== 1 ? 's' : ''} · private to you
                  </span>
                </div>

                {poolSorted.length === 0 ? (
                  <div className="card text-center py-16 space-y-3">
                    <p className="font-display text-2xl text-white tracking-wide leading-none">AN EMPTY VAULT</p>
                    <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
                      Start with your prior editions — one click pulls every film you've ever ranked.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {poolSorted.map(row => (
                      <div key={row.id} className="group relative">
                        <FilmStill
                          src={row.films?.poster_url} title={row.films?.title ?? ''}
                          className="aspect-[2/3] rounded-lg border border-white/10 shadow-still
                                     group-hover:border-gold-500/50 group-hover:-translate-y-0.5 transition-all"
                        >
                          <div className="absolute inset-x-0 bottom-0 p-3 pointer-events-none"
                               style={{ background: 'linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.93) 100%)' }}>
                            <p className="font-mono text-xs tracking-kicker text-white/60 uppercase mb-0.5">
                              {row.films?.release_year ?? '—'}
                            </p>
                            <p className="font-display text-base text-white tracking-wide leading-tight line-clamp-2">
                              {row.films?.title?.toUpperCase()}
                            </p>
                            <span className={`inline-block mt-1.5 font-mono text-[9px] tracking-cinema uppercase
                                              px-1.5 py-px rounded border ${SOURCE_META[row.source].chip}`}>
                              {SOURCE_META[row.source].label}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemove(row)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-night-950/80 border border-white/20
                                       text-gray-300 hover:bg-red-500/80 hover:text-white hover:border-red-500
                                       transition-all flex items-center justify-center text-xs
                                       opacity-0 group-hover:opacity-100"
                            title="Remove from pool"
                          >✕</button>
                        </FilmStill>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
