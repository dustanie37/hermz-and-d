import { useMemo } from 'react'
import {
  EVENTS_ORDER, PanelHeader, EmptyNote, RosterList, HBarChart,
  primaryGenre, decade, decadeLabel,
} from './shared'

// ── DECADE BAR CHART ─────────────────────────────────────────────────────────
function DecadeChart({ films, color }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => { const d = decade(f.release_year); if (d) counts[d] = (counts[d] || 0) + 1 })
    return Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b))
      .map(([d, count]) => ({ label: decadeLabel(Number(d)), count }))
  }, [films])
  return <HBarChart data={data} color={color} />
}

// ── GENRE BAR CHART ───────────────────────────────────────────────────────────
function GenreChart({ films, color }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => { const g = primaryGenre(f); if (g) counts[g] = (counts[g] || 0) + 1 })
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 14)
      .map(([genre, count]) => ({ label: genre, count }))
  }, [films])
  return <HBarChart data={data} color={color} maxRows={14} />
}

// ── PERSON ROSTER ─────────────────────────────────────────────────────────────
function PersonChart({ films, type, color }) {
  const data = useMemo(() => {
    const counts = {}
    films.forEach(f => {
      if (type === 'director') {
        if (f.director) { const d = f.director.split(',')[0].trim(); counts[d] = (counts[d] || 0) + 1 }
      } else if (type === 'actor') {
        // Top-billed only (actor_1–3) — avoids noise from large ensembles
        ;['actor_1', 'actor_2', 'actor_3'].forEach(k => {
          const a = f[k]; if (a) counts[a] = (counts[a] || 0) + 1
        })
      } else if (type === 'writer') {
        if (f.writer) {
          f.writer.split(',').forEach(w => {
            const name = w.trim().replace(/\s*\(.*?\)\s*$/, '').trim()
            if (name) counts[name] = (counts[name] || 0) + 1
          })
        }
      }
    })
    return Object.entries(counts).filter(([, n]) => n > 1)
      .sort(([, a], [, b]) => b - a).slice(0, 15)
      .map(([k, count]) => ({ label: k, count }))
  }, [films, type])
  if (data.length === 0) return <EmptyNote pad="py-6">No {type}s with multiple films</EmptyNote>
  return <RosterList data={data} color={color} />
}

// ── QUICK STATS ───────────────────────────────────────────────────────────────
function QuickStats({ films }) {
  const decades = {}, genres = {}, directors = {}, actors = {}
  films.forEach(f => {
    const d = decade(f.release_year); if (d) decades[d] = (decades[d] || 0) + 1
    const g = primaryGenre(f);        if (g) genres[g]  = (genres[g] || 0) + 1
    if (f.director) { const dir = f.director.split(',')[0].trim(); directors[dir] = (directors[dir] || 0) + 1 }
    for (let i = 1; i <= 10; i++) { const a = f[`actor_${i}`]; if (a) actors[a] = (actors[a] || 0) + 1 }
  })
  const top = obj => Object.entries(obj).sort(([, a], [, b]) => b - a)[0]
  const td = top(decades), tg = top(genres), tdir = top(directors), tact = top(actors)
  const items = [
    { label: 'TOTAL FILMS',  value: films.length },
    { label: 'TOP DECADE',   value: td   ? decadeLabel(Number(td[0])) : '—' },
    { label: 'TOP GENRE',    value: tg   ? tg[0]   : '—' },
    { label: 'TOP DIRECTOR', value: tdir ? tdir[0] : '—' },
    { label: 'TOP ACTOR',    value: tact ? tact[0] : '—' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
      {items.map(s => (
        <div key={s.label} className="card text-center py-4 px-3">
          <div className="font-display text-xl text-white tracking-wide leading-tight truncate" title={String(s.value)}>{s.value}</div>
          <div className="stat-label mt-2">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── CHARTS TAB ────────────────────────────────────────────────────────────────
export default function ChartsTab({ eventYear, view, setEvent, setView, films, loading, error, chartColor }) {
  return (
    <>
      {/* Event + view selectors */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-1.5">
          {EVENTS_ORDER.map(yr => (
            <button key={yr} onClick={() => setEvent(yr)} className={yr === eventYear ? 'pill-film' : 'pill'}>{yr}</button>
          ))}
        </div>
        <span className="hidden sm:block w-px h-6 bg-night-700" />
        <div className="flex gap-1 p-1 bg-night-800/80 rounded-full">
          {[{ value: 'combined', label: 'Combined' }, { value: 'dustin', label: "Dust's List" }, { value: 'matt', label: "Hermz's List" }].map(opt => (
            <button key={opt.value} onClick={() => setView(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                view === opt.value
                  ? opt.value === 'matt'    ? 'bg-gold-500 text-night-950'
                  : opt.value === 'dustin'  ? 'bg-film-500 text-night-950'
                  : 'bg-cinema-500 text-night-950'
                  : 'text-gray-400 hover:text-white'
              }`}>{opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-16 flex items-center justify-center">
          <span className="font-mono text-sm tracking-kicker text-gray-400 animate-pulse">LOADING {eventYear} STATS…</span>
        </div>
      )}
      {error && <div className="py-8 text-center text-red-400 text-sm">Error: {error}</div>}

      {!loading && !error && films.length > 0 && (
        <>
          <QuickStats films={films} />

          {/* Decade + Genre */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div className="card">
              <PanelHeader title="By Decade" />
              <DecadeChart films={films} color={chartColor} />
            </div>
            <div className="card">
              <PanelHeader title="By Genre" subtitle="First-billed genre only" />
              <GenreChart films={films} color={chartColor} />
            </div>
          </div>

          {/* Directors + Actors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div className="card">
              <PanelHeader title="Top Directors" subtitle="2+ films on this list" />
              <PersonChart films={films} type="director" color={chartColor} />
            </div>
            <div className="card">
              <PanelHeader title="Top Actors" subtitle="Top-billed roles only · 2+ films" />
              <PersonChart films={films} type="actor" color={chartColor} />
            </div>
          </div>

          {/* Screenwriters */}
          <div className="mb-5">
            <div className="card">
              <PanelHeader title="Top Screenwriters" subtitle="2+ films on this list" />
              <PersonChart films={films} type="writer" color={chartColor} />
            </div>
          </div>
        </>
      )}
    </>
  )
}
