import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { enrichFilmCast } from '../../lib/tmdb'

const DELAY_MS   = 250
const CAST_LIMIT = 10

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function castToColumns(cast) {
  const obj = {}
  for (let i = 0; i < CAST_LIMIT; i++) {
    obj[`actor_${i + 1}`] = cast[i] ?? null
  }
  return obj
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  if (status === 'ok')      return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
  if (status === 'error')   return <span className="w-2 h-2 rounded-full bg-red-500    shrink-0 mt-1.5" />
  if (status === 'pending') return <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 mt-1.5 animate-pulse" />
  return                           <span className="w-2 h-2 rounded-full bg-gray-400   shrink-0 mt-1.5" />
}

function LogRow({ entry }) {
  return (
    <div className="flex gap-3 items-start py-1.5 border-b border-stone-100 dark:border-night-700 last:border-0">
      <StatusDot status={entry.status} />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.title}</span>
        {entry.status === 'ok' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {entry.cast.join(' · ')}
          </p>
        )}
        {entry.status === 'error' && (
          <p className="text-xs text-red-500 mt-0.5">{entry.message}</p>
        )}
      </div>
      {entry.status === 'ok' && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0 font-medium">
          {entry.cast.length} actor{entry.cast.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MoviesBackfill() {
  const [films,    setFilms]    = useState(null)
  const [log,      setLog]      = useState([])
  const [running,  setRunning]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadErr,  setLoadErr]  = useState(null)
  const stopRef = useRef(false)
  const logRef  = useRef(null)

  const hasTmdbKey = !!import.meta.env.VITE_TMDB_API_KEY

  // ── load films ───────────────────────────────────────────────────────────────
  // Only select actor_1–5. actor_6–10 may not exist until add_actor_columns.sql
  // is run — selecting them causes a Postgres error. We only need actor_4 to
  // determine which films need updating (OMDB gives ≤3, so actor_4 = null means
  // the film hasn't been TMDb-enriched yet).
  async function loadFilms() {
    setLoadErr(null)
    const { data, error } = await supabase
      .from('films')
      .select('id, title, release_year, omdb_id, actor_1, actor_2, actor_3, actor_4, actor_5')
      .order('title')
    if (error) { setLoadErr(error.message); return }
    setFilms(data)
  }

  // Films where actor_4 is empty haven't been TMDb-enriched yet
  const needsUpdate = films?.filter(f => !f.actor_4) ?? []
  const alreadyGood = films ? films.length - needsUpdate.length : 0

  // ── run backfill ─────────────────────────────────────────────────────────────
  async function startBackfill() {
    if (!films) return
    stopRef.current = false
    setRunning(true)
    setDone(false)
    setLog([])
    setProgress(0)

    const targets = needsUpdate

    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) break
      const film = targets[i]

      // Guard against malformed IDs
      if (!film?.id || !Number.isInteger(film.id)) {
        setProgress(i + 1)
        continue
      }

      setLog(prev => [...prev, { id: film.id, title: film.title, status: 'pending' }])

      try {
        const { cast } = await enrichFilmCast(film)

        const { error } = await supabase
          .from('films')
          .update(castToColumns(cast))
          .eq('id', film.id)
        if (error) throw new Error(error.message)

        setLog(prev => prev.map(e =>
          e.id === film.id ? { ...e, status: 'ok', cast } : e
        ))
      } catch (err) {
        setLog(prev => prev.map(e =>
          e.id === film.id ? { ...e, status: 'error', message: err.message } : e
        ))
      }

      setProgress(i + 1)
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      if (i < targets.length - 1) await sleep(DELAY_MS)
    }

    setRunning(false)
    setDone(true)
  }

  function stopBackfill() { stopRef.current = true }

  const okCount  = log.filter(e => e.status === 'ok').length
  const errCount = log.filter(e => e.status === 'error').length
  const pct      = needsUpdate.length ? Math.round((progress / needsUpdate.length) * 100) : 0

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      <div className="flex items-center gap-3 mb-1">
        <Link to="/settings"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← Settings
        </Link>
      </div>

      <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 mb-1">
        TMDb Actor Backfill
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Fetches up to 10 cast members per film from The Movie Database and saves them to Supabase.
        Films with 4+ actors already are skipped.
      </p>

      {!hasTmdbKey && (
        <div className="card border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 mb-6 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">TMDb API key not configured</p>
          <p className="text-xs text-red-600 dark:text-red-500">
            Add <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">VITE_TMDB_API_KEY</code> to your{' '}
            <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">.env</code> file and Vercel.
          </p>
        </div>
      )}

      <div className="card border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 mb-6 p-4">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Prerequisite</p>
        <p className="text-xs text-amber-700 dark:text-amber-500">
          Run <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">add_actor_columns.sql</code> in
          Supabase SQL Editor first to add the <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">actor_6</code>–<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">actor_10</code> columns before running the backfill.
        </p>
      </div>

      {!films && (
        <button onClick={loadFilms} disabled={!hasTmdbKey} className="btn-gold disabled:opacity-50">
          Load Films
        </button>
      )}

      {loadErr && <p className="text-sm text-red-500 mt-3">{loadErr}</p>}

      {films && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Films',  value: films.length },
              { label: 'Need Update',  value: needsUpdate.length, accent: needsUpdate.length > 0 },
              { label: 'Already Good', value: alreadyGood, green: alreadyGood > 0 },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <div className={`text-2xl font-bold font-display mb-0.5
                  ${s.accent ? 'text-yellow-500' : s.green ? 'text-emerald-500' : 'text-gray-900 dark:text-gray-100'}`}>
                  {s.value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {(running || done) && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{progress} / {needsUpdate.length} processed</span>
                <span className="tabular-nums">{okCount} ok · {errCount} errors</span>
              </div>
              <div className="h-2 bg-stone-200 dark:bg-night-700 rounded-full overflow-hidden">
                <div className="h-full bg-gold-500 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }} />
              </div>
              {done && !stopRef.current && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                  ✓ Backfill complete — {okCount} updated, {errCount} errors
                </p>
              )}
              {done && stopRef.current && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-medium">
                  Stopped at {progress} / {needsUpdate.length}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 mb-6">
            {!running && !done && needsUpdate.length > 0 && (
              <button onClick={startBackfill} disabled={!hasTmdbKey} className="btn-gold disabled:opacity-50">
                Run Backfill ({needsUpdate.length} films)
              </button>
            )}
            {running && (
              <button onClick={stopBackfill} className="btn-secondary">Stop</button>
            )}
            {done && (
              <button onClick={() => { setFilms(null); setLog([]); setDone(false); setProgress(0) }}
                className="btn-secondary">
                Reload & Check Again
              </button>
            )}
            {!running && !done && needsUpdate.length === 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ All films already have full actor data
              </p>
            )}
          </div>

          {log.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 dark:border-night-700">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Results
                </h2>
              </div>
              <div ref={logRef} className="max-h-[480px] overflow-y-auto px-4">
                {log.map(entry => <LogRow key={entry.id} entry={entry} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
