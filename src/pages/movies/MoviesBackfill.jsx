import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { enrichFilmCast } from '../../lib/tmdb'

const DELAY_MS   = 250
const CAST_LIMIT = 10

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function castToColumns(cast) {
  const obj = {}
  for (let i = 0; i < CAST_LIMIT; i++) obj[`actor_${i + 1}`] = cast[i] ?? null
  return obj
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const cls =
    status === 'ok'      ? 'bg-emerald-400' :
    status === 'error'   ? 'bg-red-400' :
    status === 'pending' ? 'bg-cinema-400 animate-pulse' :
                           'bg-gray-500'
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${cls}`} />
}

function LogRow({ entry }) {
  return (
    <div className="flex gap-3 items-start py-2 border-b border-night-700/60 last:border-0">
      <StatusDot status={entry.status} />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-white">{entry.title}</span>
        {entry.status === 'ok' && (
          <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1 uppercase truncate">
            {entry.cast.join(' · ')}
          </p>
        )}
        {entry.status === 'error' && (
          <p className="text-xs text-red-400 mt-1">{entry.message}</p>
        )}
      </div>
      {entry.status === 'ok' && (
        <span className="font-mono text-[10px] tracking-kicker text-emerald-400 shrink-0 mt-1.5 uppercase">
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

  async function loadFilms() {
    setLoadErr(null)
    const { data, error } = await supabase
      .from('films')
      .select('id, title, release_year, omdb_id, actor_1, actor_2, actor_3, actor_4, actor_5')
      .order('title')
    if (error) { setLoadErr(error.message); return }
    setFilms(data)
  }

  const needsUpdate = films?.filter(f => !f.actor_4) ?? []
  const alreadyGood = films ? films.length - needsUpdate.length : 0

  async function startBackfill() {
    if (!films) return
    stopRef.current = false
    setRunning(true); setDone(false); setLog([]); setProgress(0)

    const targets = needsUpdate
    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) break
      const film = targets[i]
      if (!film?.id || !Number.isInteger(film.id)) { setProgress(i + 1); continue }

      setLog(prev => [...prev, { id: film.id, title: film.title, status: 'pending' }])
      try {
        const { cast } = await enrichFilmCast(film)
        const { error } = await supabase.from('films').update(castToColumns(cast)).eq('id', film.id)
        if (error) throw new Error(error.message)
        setLog(prev => prev.map(e => e.id === film.id ? { ...e, status: 'ok', cast } : e))
      } catch (err) {
        setLog(prev => prev.map(e => e.id === film.id ? { ...e, status: 'error', message: err.message } : e))
      }
      setProgress(i + 1)
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      if (i < targets.length - 1) await sleep(DELAY_MS)
    }
    setRunning(false); setDone(true)
  }
  function stopBackfill() { stopRef.current = true }

  const okCount  = log.filter(e => e.status === 'ok').length
  const errCount = log.filter(e => e.status === 'error').length
  const pct      = needsUpdate.length ? Math.round((progress / needsUpdate.length) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">

      <div className="flex items-center gap-3 mb-4">
        <Link to="/settings" className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors">
          ← SETTINGS
        </Link>
        <span className="text-gray-700">/</span>
        <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Actor Backfill</span>
      </div>

      <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-3">
        TMDB ACTOR BACKFILL
      </h1>
      <p className="font-serif italic text-base text-gray-400 mb-7 max-w-2xl">
        Fetches up to 10 cast members per film from The Movie Database and saves them to
        Supabase. Films with 4+ actors already are skipped.
      </p>

      {!hasTmdbKey && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 mb-5 p-4">
          <p className="font-mono text-[11px] tracking-kicker text-red-400 uppercase mb-1.5">
            ● TMDb API key not configured
          </p>
          <p className="text-xs text-red-300">
            Add <code className="font-mono bg-red-500/15 px-1 rounded">VITE_TMDB_API_KEY</code> to
            your <code className="font-mono bg-red-500/15 px-1 rounded">.env</code> file and Vercel.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-gold-500/40 bg-gold-500/[0.06] mb-7 p-4">
        <p className="font-mono text-[11px] tracking-kicker text-gold-400 uppercase mb-1.5">
          ● Prerequisite
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">
          Run <code className="font-mono bg-gold-500/15 text-gold-300 px-1 rounded">add_actor_columns.sql</code> in
          Supabase SQL Editor first to add the
          <code className="font-mono bg-gold-500/15 text-gold-300 px-1 rounded mx-1">actor_6</code>–
          <code className="font-mono bg-gold-500/15 text-gold-300 px-1 rounded ml-1">actor_10</code> columns
          before running the backfill.
        </p>
      </div>

      {!films && (
        <button onClick={loadFilms} disabled={!hasTmdbKey} className="btn-gold disabled:opacity-50">
          Load Films
        </button>
      )}

      {loadErr && <p className="text-sm text-red-400 mt-3">{loadErr}</p>}

      {films && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total Films',  value: films.length,                                       color: 'text-white' },
              { label: 'Need Update',  value: needsUpdate.length, color: needsUpdate.length > 0 ? 'text-gold-400'    : 'text-gray-500' },
              { label: 'Already Good', value: alreadyGood,        color: alreadyGood > 0         ? 'text-emerald-400' : 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="card text-center py-4">
                <div className={`font-display text-3xl leading-none tracking-wide ${s.color}`}>{s.value}</div>
                <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">{s.label}</div>
              </div>
            ))}
          </div>

          {(running || done) && (
            <div className="mb-5">
              <div className="flex justify-between font-mono text-[10px] tracking-kicker text-gray-400 mb-2 uppercase">
                <span>{progress} / {needsUpdate.length} processed</span>
                <span className="tabular-nums">
                  <span className="text-emerald-400">{okCount} ok</span>
                  {' · '}
                  <span className={errCount ? 'text-red-400' : 'text-gray-500'}>{errCount} errors</span>
                </span>
              </div>
              <div className="h-1.5 bg-night-700 rounded-full overflow-hidden">
                <div className="h-full bg-gold-500 transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              {done && !stopRef.current && (
                <p className="font-mono text-[10px] tracking-kicker text-emerald-400 mt-3 uppercase">
                  ✓ Backfill complete — {okCount} updated, {errCount} errors
                </p>
              )}
              {done && stopRef.current && (
                <p className="font-mono text-[10px] tracking-kicker text-gold-400 mt-3 uppercase">
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
            {running && <button onClick={stopBackfill} className="btn-ghost">Stop</button>}
            {done && (
              <button onClick={() => { setFilms(null); setLog([]); setDone(false); setProgress(0) }}
                      className="btn-ghost">
                Reload &amp; Check Again
              </button>
            )}
            {!running && !done && needsUpdate.length === 0 && (
              <p className="font-mono text-[11px] tracking-kicker text-emerald-400 uppercase">
                ✓ All films already have full actor data
              </p>
            )}
          </div>

          {log.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-night-700/60">
                <span className="kicker">Results</span>
              </div>
              <div ref={logRef} className="max-h-[480px] overflow-y-auto px-5">
                {log.map(entry => <LogRow key={entry.id} entry={entry} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}