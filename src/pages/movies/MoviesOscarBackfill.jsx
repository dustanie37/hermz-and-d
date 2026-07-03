import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ACTING_CATEGORIES, normalizeCategory } from '../../lib/oscarCategories'

const WIKIDATA_URL = 'https://query.wikidata.org/sparql'
const BATCH_SIZE          = 10
const CEREMONY_BATCH_SIZE = 5
const DELAY_MS            = 2500

/* Category normalisation moved to src/lib/oscarCategories.js (2026-07-03) —
   shared with OscarsNewYear.jsx. Edit it THERE, never inline. */
// ── SPARQL query builders ──────────────────────────────────────────────────────

function buildFilmPageQuery(imdbIds) {
  const values = imdbIds.map(id => `"${id}"`).join(' ')
  return `
SELECT ?imdbId ?awardUri ?awardLabel ?won ?year ?nomineeName WHERE {
  VALUES ?imdbId { ${values} }
  ?film wdt:P345 ?imdbId .
  {
    ?film p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    BIND(true AS ?won)
  } UNION {
    ?film p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    BIND(false AS ?won)
  }
  ?award wdt:P31 wd:Q19020 .
  BIND(str(?award) AS ?awardUri)
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
  }
  OPTIONAL {
    ?stmt pq:P585 ?date .
    BIND(YEAR(?date) AS ?year)
  }
  OPTIONAL {
    ?stmt pq:P1706 ?nomineeEntity .
    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "en" .
      ?nomineeEntity rdfs:label ?nomineeName .
    }
  }
}
`
}

function buildCeremonyPageQuery(ceremonyYear, imdbIds) {
  const values = imdbIds.map(id => `"${id}"`).join(' ')
  return `
SELECT ?filmImdbId ?awardUri ?awardLabel ?won ?nomineeName WHERE {
  ?ceremony wdt:P31 wd:Q4688419 .
  ?ceremony wdt:P585 ?date .
  FILTER(YEAR(?date) = ${ceremonyYear})

  VALUES ?filmImdbId { ${values} }
  ?film wdt:P345 ?filmImdbId .

  {
    ?film p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    ?stmt pq:P805 ?ceremony .
    BIND(true AS ?won)
  } UNION {
    ?film p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    ?stmt pq:P805 ?ceremony .
    BIND(false AS ?won)
  }

  ?award wdt:P31 wd:Q19020 .
  BIND(str(?award) AS ?awardUri)

  OPTIONAL {
    ?stmt pq:P1706 ?nomineeEntity .
    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "en" .
      ?nomineeEntity rdfs:label ?nomineeName .
    }
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
  }
}
`
}

function buildCeremonyActorQuery(ceremonyYear, imdbIds) {
  const values = imdbIds.map(id => `"${id}"`).join(' ')
  return `
SELECT ?filmImdbId ?awardUri ?awardLabel ?won ?actorName WHERE {
  ?ceremony wdt:P31 wd:Q4688419 .
  ?ceremony wdt:P585 ?date .
  FILTER(YEAR(?date) = ${ceremonyYear})

  VALUES ?filmImdbId { ${values} }
  ?film wdt:P345 ?filmImdbId .

  {
    ?actor p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    ?stmt pq:P805 ?ceremony .
    ?stmt pq:P1716 ?film .
    BIND(true AS ?won)
  } UNION {
    ?actor p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    ?stmt pq:P805 ?ceremony .
    ?stmt pq:P1716 ?film .
    BIND(false AS ?won)
  }

  ?award wdt:P31 wd:Q19020 .
  BIND(str(?award) AS ?awardUri)
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
    ?actor rdfs:label ?actorName .
  }
}
`
}

// ── Row processing ─────────────────────────────────────────────────────────────

function processRows(rows, imdbIdKey = 'imdbId', nomineeKey = 'nomineeName') {
  const seenActing = new Set()
  const seenOther  = new Set()
  const result     = []

  for (const row of rows) {
    const rawLabel    = row.awardLabel   || ''
    const awardUri    = row.awardUri     || ''
    const nomineeName = row[nomineeKey]  || null
    const canon       = normalizeCategory(rawLabel, awardUri)
    if (!canon) continue
    const won  = row.won === true || row.won === 'true'
    const year = row.year != null ? parseInt(row.year) : null

    if (ACTING_CATEGORIES.has(canon) && nomineeName) {
      // Named acting rows: different people may hold a win and a nomination in the
      // same category (e.g. Amadeus — Abraham won, Hulce nominated). Keep separately.
      const key = `${canon}|${year}|${nomineeName}|${won}`
      if (!seenActing.has(key)) { seenActing.add(key); result.push({ category_name: canon, is_winner: won, ceremony_year: year, nominee_name: nomineeName }) }
    } else {
      // Unnamed rows (acting included): Wikidata film pages often carry BOTH a
      // "nominated for" and an "award received" statement for the SAME winner.
      // Keeping both created phantom extra nominations (2026-07 bug fix) —
      // collapse to a single row where a win beats a nomination.
      const key = `${canon}|${year}|${nomineeName}`
      if (seenOther.has(key)) {
        if (won) {
          const idx = result.findIndex(r => r.category_name === canon && r.ceremony_year === year && r.nominee_name === nomineeName)
          if (idx >= 0) result[idx].is_winner = true
        }
      } else {
        seenOther.add(key)
        result.push({ category_name: canon, is_winner: won, ceremony_year: year, nominee_name: nomineeName })
      }
    }
  }
  return result
}

// ── Wikidata fetch ─────────────────────────────────────────────────────────────

async function queryWikidata(sparql) {
  const url  = `${WIKIDATA_URL}?query=${encodeURIComponent(sparql)}&format=json`
  const resp = await fetch(url, {
    headers: {
      'Accept':     'application/sparql-results+json',
      'User-Agent': 'HermzAndDMoviesApp/2.0 (film ranking app; contact: bard37@gmail.com)',
    },
  })
  if (!resp.ok) throw new Error(`Wikidata ${resp.status} — ${resp.statusText}`)
  const data = await resp.json()
  return data?.results?.bindings || []
}

function parseFilmPageBindings(bindings) {
  return bindings.map(b => ({
    imdbId:      b.imdbId?.value      || '',
    awardUri:    b.awardUri?.value    || '',
    awardLabel:  b.awardLabel?.value  || '',
    won:         b.won?.value === 'true',
    year:        b.year ? parseInt(b.year.value) : null,
    nomineeName: b.nomineeName?.value || null,
  }))
}

function parseCeremonyBindings(bindings, imdbIdKey = 'filmImdbId', nomineeKey = 'nomineeName') {
  return bindings.map(b => ({
    imdbId:      b[imdbIdKey]?.value   || '',
    awardUri:    b.awardUri?.value     || '',
    awardLabel:  b.awardLabel?.value   || '',
    won:         b.won?.value === 'true',
    year:        b.year ? parseInt(b.year.value) : null,
    nomineeName: (b[nomineeKey] || b.actorName)?.value || null,
  }))
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const cls =
    status === 'ok'      ? 'bg-emerald-400' :
    status === 'none'    ? 'bg-gold-400' :
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
          <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1 uppercase">
            {entry.count} nomination{entry.count !== 1 ? 's' : ''} saved
          </p>
        )}
        {entry.status === 'none' && (
          <p className="font-mono text-[10px] tracking-kicker text-gold-400 mt-1 uppercase">
            No Wikidata results from film-page query
          </p>
        )}
        {entry.status === 'error' && (
          <p className="text-xs text-red-400 mt-1">{entry.message}</p>
        )}
      </div>
      {entry.status === 'ok' && (
        <span className="font-mono text-[10px] tracking-kicker text-emerald-400 shrink-0 mt-1.5">
          {entry.count}
        </span>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MoviesOscarBackfill() {
  const [films,   setFilms]   = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [mode, setMode] = useState('fill')   // 'fill' | 'force'

  const [log,      setLog]      = useState([])
  const [running,  setRunning]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [progress, setProgress] = useState(0)
  const stopRef = useRef(false)
  const logRef  = useRef(null)

  const [ceremonyLog,      setCeremonyLog]      = useState([])
  const [ceremonyRunning,  setCeremonyRunning]  = useState(false)
  const [ceremonyDone,     setCeremonyDone]     = useState(false)
  const [ceremonyProgress, setCeremonyProgress] = useState(0)
  const [ceremonyTotal,    setCeremonyTotal]    = useState(0)
  const stopCeremonyRef = useRef(false)
  const ceremonyLogRef  = useRef(null)

  async function loadFilms() {
    setLoadErr(null); setLog([]); setDone(false); setProgress(0)
    setCeremonyLog([]); setCeremonyDone(false)

    const { data: allFilms, error: filmsErr } = await supabase
      .from('films').select('id, title, release_year, omdb_id')
      .not('omdb_id', 'is', null).order('title')
    if (filmsErr) { setLoadErr(filmsErr.message); return }

    const { data: existingNoms, error: nomsErr } = await supabase
      .from('film_oscar_noms').select('film_id')
    if (nomsErr) { setLoadErr(nomsErr.message); return }

    const filmsWithData = new Set((existingNoms || []).map(n => n.film_id))
    const needsData     = allFilms.filter(f => !filmsWithData.has(f.id))
    const hasData       = allFilms.filter(f =>  filmsWithData.has(f.id))
    setFilms({ all: allFilms, needsData, hasData })
  }

  const targets = films
    ? mode === 'force' ? films.all : films.needsData
    : []

  const amberFilms = log
    .filter(e => e.status === 'none')
    .map(e => films?.all.find(f => f.id === e.id))
    .filter(Boolean)

  async function startBackfill() {
    if (!films) return
    stopRef.current = false
    setRunning(true); setDone(false); setLog([]); setProgress(0)
    setCeremonyLog([]); setCeremonyDone(false)

    let processed = 0
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      if (stopRef.current) break
      const batch   = targets.slice(i, i + BATCH_SIZE)
      const imdbIds = batch.map(f => f.omdb_id)
      setLog(prev => [...prev, ...batch.map(f => ({ id: f.id, title: f.title, status: 'pending' }))])

      let bindings = []
      try {
        bindings = await queryWikidata(buildFilmPageQuery(imdbIds))
      } catch (err) {
        setLog(prev => prev.map(e =>
          batch.find(f => f.id === e.id) ? { ...e, status: 'error', message: err.message } : e
        ))
        processed += batch.length; setProgress(processed)
        if (i + BATCH_SIZE < targets.length) await sleep(DELAY_MS)
        continue
      }

      const rows   = parseFilmPageBindings(bindings)
      const byImdb = {}
      for (const row of rows) {
        if (!byImdb[row.imdbId]) byImdb[row.imdbId] = []
        byImdb[row.imdbId].push(row)
      }

      for (const film of batch) {
        if (stopRef.current) break
        const filmRows = byImdb[film.omdb_id] || []
        const noms     = processRows(filmRows)
        if (noms.length === 0) {
          setLog(prev => prev.map(e => e.id === film.id ? { ...e, status: 'none' } : e))
          processed++; setProgress(processed); continue
        }
        if (mode === 'force') {
          await supabase.from('film_oscar_noms').delete().eq('film_id', film.id)
        }
        const insertRows = noms.map(n => ({
          film_id: film.id, category_name: n.category_name, is_winner: n.is_winner,
          ceremony_year: n.ceremony_year, nominee_name: n.nominee_name,
        }))
        const { error: insertErr } = await supabase
          .from('film_oscar_noms')
          .upsert(insertRows, { ignoreDuplicates: mode !== 'force' })
        setLog(prev => prev.map(e =>
          e.id === film.id
            ? insertErr ? { ...e, status: 'error', message: insertErr.message } : { ...e, status: 'ok', count: noms.length }
            : e
        ))
        processed++; setProgress(processed)
      }
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      if (i + BATCH_SIZE < targets.length && !stopRef.current) await sleep(DELAY_MS)
    }
    setRunning(false); setDone(true)
  }

  async function startCeremonyPass() {
    if (amberFilms.length === 0) return
    stopCeremonyRef.current = false
    setCeremonyRunning(true); setCeremonyDone(false); setCeremonyLog([]); setCeremonyProgress(0)

    const byCeremonyYear = {}
    for (const film of amberFilms) {
      const cy = (film.release_year || 2000) + 1
      if (!byCeremonyYear[cy]) byCeremonyYear[cy] = []
      byCeremonyYear[cy].push(film)
    }
    const total = amberFilms.length
    setCeremonyTotal(total)
    let processed = 0

    for (const [ceremonyYearStr, yearFilms] of Object.entries(byCeremonyYear)) {
      if (stopCeremonyRef.current) break
      const ceremonyYear = parseInt(ceremonyYearStr)

      for (let i = 0; i < yearFilms.length; i += CEREMONY_BATCH_SIZE) {
        if (stopCeremonyRef.current) break
        const batch   = yearFilms.slice(i, i + CEREMONY_BATCH_SIZE)
        const imdbIds = batch.map(f => f.omdb_id)
        setCeremonyLog(prev => [...prev, ...batch.map(f => ({ id: f.id, title: f.title, status: 'pending' }))])

        let filmBindings = [], actorBindings = []
        try {
          ;[filmBindings, actorBindings] = await Promise.all([
            queryWikidata(buildCeremonyPageQuery(ceremonyYear, imdbIds)),
            queryWikidata(buildCeremonyActorQuery(ceremonyYear, imdbIds)),
          ])
        } catch (err) {
          setCeremonyLog(prev => prev.map(e =>
            batch.find(f => f.id === e.id) ? { ...e, status: 'error', message: err.message } : e
          ))
          processed += batch.length; setCeremonyProgress(processed)
          await sleep(DELAY_MS); continue
        }

        const filmRows  = parseCeremonyBindings(filmBindings,  'filmImdbId', 'nomineeName')
        const actorRows = parseCeremonyBindings(actorBindings, 'filmImdbId', 'actorName')

        const byImdb = {}
        for (const row of [...filmRows, ...actorRows]) {
          if (!byImdb[row.imdbId]) byImdb[row.imdbId] = []
          byImdb[row.imdbId].push(row)
        }

        for (const film of batch) {
          if (stopCeremonyRef.current) break
          const filmRows = byImdb[film.omdb_id] || []
          const actingRows    = filmRows.filter(r => ACTING_CATEGORIES.has(normalizeCategory(r.awardLabel, r.awardUri)))
          const nonActingRows = filmRows.filter(r => !ACTING_CATEGORIES.has(normalizeCategory(r.awardLabel, r.awardUri)))
          const noms = [
            ...processRows(actingRows,    'imdbId', 'nomineeName'),
            ...processRows(nonActingRows, 'imdbId', 'nomineeName'),
          ]
          if (noms.length === 0) {
            setCeremonyLog(prev => prev.map(e => e.id === film.id ? { ...e, status: 'none' } : e))
            processed++; setCeremonyProgress(processed); continue
          }
          await supabase.from('film_oscar_noms').delete().eq('film_id', film.id)
          const insertRows = noms.map(n => ({
            film_id: film.id, category_name: n.category_name, is_winner: n.is_winner,
            ceremony_year: n.ceremony_year, nominee_name: n.nominee_name,
          }))
          const { error: insertErr } = await supabase
            .from('film_oscar_noms')
            .upsert(insertRows, { ignoreDuplicates: false })
          setCeremonyLog(prev => prev.map(e =>
            e.id === film.id
              ? insertErr ? { ...e, status: 'error', message: insertErr.message } : { ...e, status: 'ok', count: noms.length }
              : e
          ))
          processed++; setCeremonyProgress(processed)
        }

        if (ceremonyLogRef.current) ceremonyLogRef.current.scrollTop = ceremonyLogRef.current.scrollHeight
        await sleep(DELAY_MS * 1.5)
      }
    }
    setCeremonyRunning(false); setCeremonyDone(true)
  }

  function stopBackfill()     { stopRef.current = true }
  function stopCeremonyPass() { stopCeremonyRef.current = true }

  const okCount   = log.filter(e => e.status === 'ok').length
  const noneCount = log.filter(e => e.status === 'none').length
  const errCount  = log.filter(e => e.status === 'error').length
  const pct       = targets.length ? Math.round((progress / targets.length) * 100) : 0

  const cOk   = ceremonyLog.filter(e => e.status === 'ok').length
  const cNone = ceremonyLog.filter(e => e.status === 'none').length
  const cErr  = ceremonyLog.filter(e => e.status === 'error').length
  const cPct  = ceremonyTotal ? Math.round((ceremonyProgress / ceremonyTotal) * 100) : 0

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">

      <div className="flex items-center gap-3 mb-4">
        <Link to="/settings" className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors">
          ← SETTINGS
        </Link>
        <span className="text-gray-700">/</span>
        <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Oscar Backfill</span>
      </div>

      <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-3">
        OSCAR NOMS BACKFILL
      </h1>
      <p className="font-serif italic text-base text-gray-400 mb-7 leading-relaxed">
        Two-pass tool. <strong className="not-italic text-gray-200">Film-page pass</strong> queries each film's own Wikidata entity.
        <strong className="not-italic text-gray-200"> Ceremony-page pass</strong> uses the Oscar ceremony entity as a fallback —
        more complete for historical films where Wikidata's film page is missing nomination data.
        <strong className="not-italic text-gray-200"> Force Re-fetch</strong> clears existing data and re-runs everything.
      </p>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { val: 'fill',  label: 'Fill Missing',   desc: 'Skip films that already have data',     accent: 'film' },
          { val: 'force', label: 'Force Re-fetch', desc: 'Clear existing data and re-fetch all', accent: 'gold' },
        ].map(({ val, label, desc, accent }) => {
          const active = mode === val
          const ring = active
            ? (accent === 'gold' ? 'border-gold-500/60 bg-gold-500/[0.08]' : 'border-film-500/60 bg-film-500/[0.08]')
            : 'border-night-600 hover:border-night-500'
          const titleColor = active
            ? (accent === 'gold' ? 'text-gold-400' : 'text-film-400')
            : 'text-white'
          return (
            <button
              key={val}
              onClick={() => { setMode(val); setFilms(null); setLog([]); setDone(false) }}
              className={`text-left px-4 py-3.5 rounded-xl border transition-colors ${ring}`}
            >
              <div className={`font-display text-lg tracking-wide leading-none ${titleColor}`}>{label}</div>
              <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">{desc}</div>
            </button>
          )
        })}
      </div>

      {mode === 'force' && (
        <div className="mb-6 px-4 py-3 rounded-xl border border-gold-500/40 bg-gold-500/[0.06]
                        font-mono text-[11px] tracking-kicker text-gold-300 uppercase leading-relaxed">
          ⚠ Force Re-fetch will delete and replace Oscar nomination data for every film.
        </div>
      )}

      {!films && (
        <button onClick={loadFilms} className="btn-gold">Load Films</button>
      )}

      {loadErr && <p className="text-sm text-red-400 mt-3">{loadErr}</p>}

      {films && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total Films',  value: films.all.length, color: 'text-white' },
              { label: mode === 'force' ? 'Will Re-fetch' : 'Need Data',
                value: targets.length,
                color: targets.length > 0 ? 'text-gold-400' : 'text-gray-500' },
              { label: 'Already Good', value: films.hasData.length,
                color: films.hasData.length > 0 ? 'text-emerald-400' : 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="card text-center py-4">
                <div className={`font-display text-3xl leading-none tracking-wide ${s.color}`}>{s.value}</div>
                <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pass 1 progress */}
          {(running || done) && (
            <div className="mb-5">
              <p className="kicker mb-2">Pass 1 · Film-Page Query</p>
              <div className="flex justify-between font-mono text-[10px] tracking-kicker text-gray-400 mb-2 uppercase">
                <span>{progress} / {targets.length} processed</span>
                <span className="tabular-nums">
                  <span className="text-emerald-400">{okCount} ok</span>
                  {' · '}
                  <span className="text-gold-400">{noneCount} amber</span>
                  {' · '}
                  <span className={errCount ? 'text-red-400' : 'text-gray-500'}>{errCount} err</span>
                </span>
              </div>
              <div className="h-1.5 bg-night-700 rounded-full overflow-hidden">
                <div className="h-full bg-gold-500 transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              {done && (
                <p className={`font-mono text-[10px] tracking-kicker mt-3 uppercase ${stopRef.current ? 'text-gold-400' : 'text-emerald-400'}`}>
                  {stopRef.current
                    ? `Stopped at ${progress} / ${targets.length}`
                    : `✓ Complete · ${okCount} updated · ${noneCount} no film-page data · ${errCount} errors`}
                </p>
              )}
            </div>
          )}

          {/* Pass 1 actions */}
          <div className="flex gap-3 mb-6">
            {!running && !done && targets.length > 0 && (
              <button onClick={startBackfill} className="btn-gold">
                {mode === 'force' ? `Force Re-fetch All (${targets.length} films)` : `Run Pass 1 (${targets.length} films)`}
              </button>
            )}
            {running && <button onClick={stopBackfill} className="btn-ghost">Stop</button>}
            {done && (
              <button onClick={() => { setFilms(null); setLog([]); setDone(false); setProgress(0); setCeremonyLog([]); setCeremonyDone(false) }}
                      className="btn-ghost">
                Reload &amp; Check Again
              </button>
            )}
            {!running && !done && targets.length === 0 && (
              <p className="font-mono text-[11px] tracking-kicker text-emerald-400 uppercase">
                ✓ All films already have Oscar nomination data
              </p>
            )}
          </div>

          {/* Pass 1 log */}
          {log.length > 0 && (
            <div className="card p-0 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-night-700/60">
                <span className="kicker">Pass 1 Results</span>
              </div>
              <div ref={logRef} className="max-h-72 overflow-y-auto px-5">
                {log.map(entry => <LogRow key={entry.id} entry={entry} />)}
              </div>
            </div>
          )}

          {/* Pass 2 section */}
          {done && amberFilms.length > 0 && (
            <div className="card p-0 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-night-700/60">
                <span className="kicker-cinema">Pass 2 · Ceremony-Page Query</span>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  {amberFilms.length} film{amberFilms.length !== 1 ? 's' : ''} returned no data from the film-page pass.
                  This pass queries Wikidata's Oscar ceremony entities directly — more complete for historical films
                  and catches nominations stored with the
                  {' '}<code className="font-mono text-[12px] bg-night-700 text-cinema-400 px-1 py-px rounded">P805</code> ceremony qualifier.
                </p>
              </div>

              <div className="px-5 py-4">
                {(ceremonyRunning || ceremonyDone) && (
                  <div className="mb-4">
                    <div className="flex justify-between font-mono text-[10px] tracking-kicker text-gray-400 mb-2 uppercase">
                      <span>{ceremonyProgress} / {ceremonyTotal} processed</span>
                      <span className="tabular-nums">
                        <span className="text-emerald-400">{cOk} ok</span>
                        {' · '}
                        <span className="text-gray-500">{cNone} still no data</span>
                        {' · '}
                        <span className={cErr ? 'text-red-400' : 'text-gray-500'}>{cErr} err</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-night-700 rounded-full overflow-hidden">
                      <div className="h-full bg-film-500 transition-all duration-300" style={{ width: `${cPct}%` }} />
                    </div>
                    {ceremonyDone && (
                      <p className={`font-mono text-[10px] tracking-kicker mt-3 uppercase ${stopCeremonyRef.current ? 'text-gold-400' : 'text-emerald-400'}`}>
                        {stopCeremonyRef.current
                          ? `Stopped at ${ceremonyProgress} / ${ceremonyTotal}`
                          : `✓ Complete · ${cOk} rescued · ${cNone} still missing · ${cErr} errors`}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 mb-4">
                  {!ceremonyRunning && !ceremonyDone && (
                    <button onClick={startCeremonyPass} className="btn-film text-sm">
                      Run Pass 2 ({amberFilms.length} films)
                    </button>
                  )}
                  {ceremonyRunning && (
                    <button onClick={stopCeremonyPass} className="btn-ghost text-sm">Stop Pass 2</button>
                  )}
                  {ceremonyDone && (
                    <p className="font-mono text-[10px] tracking-kicker text-emerald-400 uppercase">Pass 2 complete.</p>
                  )}
                </div>

                {!ceremonyRunning && !ceremonyDone && (
                  <div className="rounded-xl border border-night-700/60 divide-y divide-night-700/60 max-h-48 overflow-y-auto">
                    {amberFilms.map(f => (
                      <div key={f.id} className="px-3 py-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0" />
                        <span className="text-sm text-gray-200">{f.title}</span>
                        <span className="font-mono text-[10px] tracking-kicker text-gray-500 ml-auto">{f.release_year}</span>
                      </div>
                    ))}
                  </div>
                )}

                {ceremonyLog.length > 0 && (
                  <div ref={ceremonyLogRef} className="max-h-72 overflow-y-auto border border-night-700/60 rounded-xl px-4 mt-3">
                    {ceremonyLog.map(entry => <LogRow key={entry.id} entry={entry} />)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All clean */}
          {done && amberFilms.length === 0 && okCount > 0 && (
            <div className="card flex items-center gap-3 text-sm text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              No ceremony-page pass needed — all processed films returned data from the film-page query.
            </div>
          )}
        </>
      )}
    </div>
  )
}