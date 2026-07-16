import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { DC, HC } from '../../../lib/helpers'
import { EVENTS_ORDER, latestEventYear, SCORE_CATS, PanelHeader, EmptyNote } from './shared'

// ── MONEY & KRYPTONITE — scoring tendencies across all editions ──────────────
function MoneyKryptoniteSection({ scoresData }) {
  const players = useMemo(() => {
    // Per player: avg of per-edition category averages. Acclaim excluded (agreed
    // jointly, not a personal tendency); Impact normalized to /10; category must
    // appear in 2+ editions (drops the 2001-only Plot/Dialogue).
    function tendencies(userKey) {
      const perCat = {}
      EVENTS_ORDER.forEach(year => {
        const avgs = scoresData?.[year]?.[userKey]
        if (!avgs) return
        SCORE_CATS.forEach(cat => {
          if (cat.key === 'score_acclaim') return
          const v = avgs[cat.key]
          if (v == null) return
          const norm = cat.normalize ? v / 2 : v
          if (!perCat[cat.key]) perCat[cat.key] = { label: cat.label, vals: [] }
          perCat[cat.key].vals.push(norm)
        })
      })
      const rows = Object.values(perCat)
        .filter(c => c.vals.length >= 2)
        .map(c => ({ label: c.label, avg: c.vals.reduce((s, v) => s + v, 0) / c.vals.length }))
        .sort((a, b) => b.avg - a.avg)
      const overall = rows.length ? rows.reduce((s, r) => s + r.avg, 0) / rows.length : null
      return { rows, overall }
    }
    return [
      { name: 'HERMZ', color: HC, ...tendencies('matt')   },
      { name: 'DUST',  color: DC, ...tendencies('dustin') },
    ]
  }, [scoresData])

  const [h, d] = players
  const softer = h.overall != null && d.overall != null
    ? (h.overall > d.overall
        ? { name: 'HERMZ', color: HC, diff: h.overall - d.overall }
        : { name: 'DUST',  color: DC, diff: d.overall - h.overall })
    : null

  if (!players.some(p => p.rows.length)) return null

  return (
    <div className="card">
      <PanelHeader title="Money & Kryptonite" subtitle="Category generosity · all editions · Impact scaled to /10 · Acclaim excluded (scored jointly)" />
      {softer && softer.diff >= 0.05 && (
        <p className="font-mono text-xs tracking-kicker uppercase mb-5" style={{ color: softer.color }}>
          THE SOFTER GRADER · {softer.name} (+{softer.diff.toFixed(2)} AVG)
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {players.map(p => (
          <div key={p.name} className="rounded-xl border border-night-600 bg-night-900/50 p-4">
            <div className="font-mono text-xs tracking-kicker mb-3" style={{ color: p.color }}>{p.name}</div>
            <div className="kicker-dim mb-1.5">💰 MONEY</div>
            {p.rows.slice(0, 2).map(r => (
              <div key={r.label} className="flex items-baseline justify-between py-0.5">
                <span className="text-sm text-gray-200">{r.label}</span>
                <span className="font-display text-xl tracking-wide leading-none" style={{ color: p.color }}>{r.avg.toFixed(2)}</span>
              </div>
            ))}
            <div className="kicker-dim mt-3 mb-1.5">🪨 KRYPTONITE</div>
            {p.rows.slice(-2).reverse().map(r => (
              <div key={r.label} className="flex items-baseline justify-between py-0.5">
                <span className="text-sm text-gray-200">{r.label}</span>
                <span className="font-display text-xl tracking-wide leading-none text-gray-400">{r.avg.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SCORES TAB ────────────────────────────────────────────────────────────────
export default function ScoresTab({ scoresData, profiles, events }) {
  const [selectedEvent, setSelectedEvent] = useState(() => latestEventYear())
  const [expandedCat, setExpandedCat]     = useState(null)
  const [filmsCache, setFilmsCache]       = useState({})
  const [filmsLoading, setFilmsLoading]   = useState(false)

  const eventData = scoresData?.[selectedEvent]

  // Clear expansion when event changes
  useEffect(() => { setExpandedCat(null) }, [selectedEvent])

  const chartData = useMemo(() => {
    if (!eventData) return []
    return SCORE_CATS
      .filter(cat => {
        if (cat.until && selectedEvent > cat.until) return false
        if (cat.since && selectedEvent < cat.since) return false
        return true
      })
      .map(cat => {
        const dustVal = eventData.dustin?.[cat.key]
        const mattVal = eventData.matt?.[cat.key]
        const norm = cat.normalize ? 0.5 : 1
        return {
          category: cat.label,
          Dust:  dustVal != null ? +(dustVal * norm).toFixed(2) : null,
          Hermz: mattVal != null ? +(mattVal * norm).toFixed(2) : null,
        }
      })
      .filter(d => d.Dust != null || d.Hermz != null)
  }, [eventData, selectedEvent])

  const tensData = useMemo(() => {
    if (!eventData) return []
    return SCORE_CATS
      .filter(cat => {
        if (cat.until && selectedEvent > cat.until) return false
        if (cat.since && selectedEvent < cat.since) return false
        return true
      })
      .map(cat => ({
        category:  cat.label,
        catKey:    cat.key,
        threshold: cat.max,
        Dust:  eventData.dustinTens?.[cat.key] || 0,
        Hermz: eventData.mattTens?.[cat.key]   || 0,
      }))
      .filter(d => d.Dust > 0 || d.Hermz > 0)
      .sort((a, b) => (b.Dust + b.Hermz) - (a.Dust + a.Hermz))
  }, [eventData, selectedEvent])

  const dustTenTotal  = Object.values(eventData?.dustinTens || {}).reduce((s, v) => s + v, 0)
  const hermzTenTotal = Object.values(eventData?.mattTens   || {}).reduce((s, v) => s + v, 0)

  async function loadPerfectFilms(catKey, threshold) {
    const cacheKey = `${selectedEvent}_${catKey}`
    if (filmsCache[cacheKey]) return
    setFilmsLoading(true)
    const ev = events?.find(e => e.year === selectedEvent)
    if (!ev || !profiles) { setFilmsLoading(false); return }
    const dustinId = profiles['dustin']
    const mattId   = profiles['matt']
    const { data } = await supabase
      .from('individual_rankings')
      .select(`rank, ${catKey}, user_id, films (id, title)`)
      .eq('event_id', ev.id)
      .in('user_id', [dustinId, mattId].filter(Boolean))
      .gte(catKey, threshold)
      .order('rank', { ascending: true })
    if (data) {
      const dustFilms  = data.filter(r => r.user_id === dustinId).sort((a, b) => a.rank - b.rank)
      const hermzFilms = data.filter(r => r.user_id === mattId).sort((a, b) => a.rank - b.rank)
      setFilmsCache(prev => ({ ...prev, [cacheKey]: { dustFilms, hermzFilms } }))
    }
    setFilmsLoading(false)
  }

  function toggleCat(catKey, threshold) {
    if (expandedCat === catKey) { setExpandedCat(null); return }
    setExpandedCat(catKey)
    loadPerfectFilms(catKey, threshold)
  }

  const expandedRow  = tensData.find(t => t.catKey === expandedCat)
  const expandedData = expandedCat ? filmsCache[`${selectedEvent}_${expandedCat}`] : null

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-6">
        {EVENTS_ORDER.map(yr => (
          <button key={yr} onClick={() => setSelectedEvent(yr)}
                  className={yr === selectedEvent ? 'pill-film' : 'pill'}>{yr}</button>
        ))}
      </div>

      {!eventData ? (
        <EmptyNote pad="py-12">Loading score data…</EmptyNote>
      ) : (
        <div className="space-y-5">

          {/* ── Average scores — dumbbell chart ─────────────────────────────── */}
          <div className="card">
            <PanelHeader title="Average Scores by Category" subtitle={`${selectedEvent} · Impact scaled to /10`} />
            <div className="space-y-1">
              {chartData.map(row => {
                const dPct     = row.Dust  != null ? (row.Dust  / 10) * 100 : null
                const hPct     = row.Hermz != null ? (row.Hermz / 10) * 100 : null
                const leftPct  = dPct != null && hPct != null ? Math.min(dPct, hPct) : 0
                const widthPct = dPct != null && hPct != null ? Math.abs(dPct - hPct) : 0
                const gapColor = dPct != null && hPct != null ? (dPct >= hPct ? DC : HC) : '#2A2734'
                const diff     = row.Dust != null && row.Hermz != null ? +(row.Dust - row.Hermz).toFixed(2) : null
                const diffColor = diff == null ? '#9CA3AF' : diff > 0 ? DC : diff < 0 ? HC : '#9CA3AF'
                const diffLabel = diff == null ? '—' : diff > 0 ? `D +${diff.toFixed(2)}` : diff < 0 ? `H +${Math.abs(diff).toFixed(2)}` : '—'
                return (
                  <div key={row.category} className="flex items-center gap-3 py-1.5">
                    <span className="font-mono text-xs text-gray-100 w-[108px] flex-shrink-0 text-right truncate">{row.category}</span>
                    <div className="flex-1 relative h-5 flex items-center">
                      <div className="absolute inset-x-0 h-px bg-night-700" />
                      {dPct != null && hPct != null && (
                        <div className="absolute h-px" style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: `${gapColor}55` }} />
                      )}
                      {dPct != null && (
                        <div className="absolute w-3 h-3 rounded-full z-10" style={{ left: `${dPct}%`, transform: 'translateX(-50%)', background: DC, boxShadow: '0 0 0 2px #15141E' }} />
                      )}
                      {hPct != null && (
                        <div className="absolute w-3 h-3 rounded-full z-10" style={{ left: `${hPct}%`, transform: 'translateX(-50%)', background: HC, boxShadow: '0 0 0 2px #15141E' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 w-[168px] justify-end">
                      <span className="font-mono text-sm tabular-nums font-semibold" style={{ color: DC }}>{row.Dust?.toFixed(2) ?? '—'}</span>
                      <span className="font-mono text-xs text-gray-600">·</span>
                      <span className="font-mono text-sm tabular-nums font-semibold" style={{ color: HC }}>{row.Hermz?.toFixed(2) ?? '—'}</span>
                      <span className="font-mono text-sm tracking-kicker uppercase w-[60px] text-right font-semibold" style={{ color: diffColor }}>{diffLabel}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Perfect scores — interactive card grid ───────────────────────── */}
          {tensData.length > 0 && (
            <div className="card">
              <PanelHeader title="Perfect Scores" subtitle={`${selectedEvent} · 10s (20 for Impact) · tap a card for the films`} />

              {/* totals */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl border border-night-600 bg-night-900/60 py-3 px-4 text-center">
                  <div className="font-display text-4xl tracking-wide leading-none" style={{ color: DC }}>{dustTenTotal}</div>
                  <div className="stat-label mt-2">Dust total perfects</div>
                </div>
                <div className="rounded-xl border border-night-600 bg-night-900/60 py-3 px-4 text-center">
                  <div className="font-display text-4xl tracking-wide leading-none" style={{ color: HC }}>{hermzTenTotal}</div>
                  <div className="stat-label mt-2">Hermz total perfects</div>
                </div>
              </div>

              {/* category cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 mb-3">
                {tensData.map(row => {
                  const isActive = expandedCat === row.catKey
                  return (
                    <button
                      key={row.catKey}
                      onClick={() => toggleCat(row.catKey, row.threshold)}
                      className={`rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
                        isActive
                          ? 'border-film-500/70 bg-film-500/10'
                          : 'border-night-600 bg-night-900/60 hover:border-night-500 hover:bg-night-800/50'
                      }`}
                    >
                      <div className="font-mono text-xs tracking-kicker text-white uppercase leading-tight mb-2">{row.category}</div>
                      <div className="flex items-baseline gap-1.5 justify-end">
                        <span className="font-display text-2xl tracking-wide leading-none" style={{ color: DC }}>{row.Dust}</span>
                        <span className="font-mono text-sm text-gray-600">/</span>
                        <span className="font-display text-2xl tracking-wide leading-none" style={{ color: HC }}>{row.Hermz}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* expanded film list */}
              {expandedCat && (
                <div className="rounded-xl border border-night-600 bg-night-900/40 p-4 mt-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl text-white tracking-wide leading-none">{expandedRow?.category}</span>
                      <span className="kicker-dim">perfect scores · {selectedEvent}</span>
                    </div>
                    <button onClick={() => setExpandedCat(null)}
                            className="font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1">✕</button>
                  </div>

                  {filmsLoading && !expandedData ? (
                    <div className="py-6 text-center font-mono text-xs tracking-kicker text-gray-400 animate-pulse uppercase">Loading films…</div>
                  ) : expandedData ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Dust column */}
                      <div>
                        <div className="font-mono text-xs tracking-kicker uppercase pb-2 mb-2 border-b border-night-700" style={{ color: DC }}>
                          Dust · {expandedData.dustFilms.length} film{expandedData.dustFilms.length !== 1 ? 's' : ''}
                        </div>
                        {expandedData.dustFilms.length === 0 ? (
                          <EmptyNote pad="py-2">None</EmptyNote>
                        ) : (
                          <div className="space-y-0.5">
                            {expandedData.dustFilms.map((r, i) => (
                              <Link key={i} to={`/movies/${r.films?.id}`}
                                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-night-700/40 transition-colors group">
                                <span className="font-mono text-xs text-gray-500 w-7 text-right flex-shrink-0">#{r.rank}</span>
                                <span className="text-sm text-gray-200 group-hover:text-film-400 transition-colors truncate flex-1">{r.films?.title ?? '?'}</span>
                                <span className="font-display text-lg leading-none flex-shrink-0" style={{ color: DC }}>{r[expandedCat]}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Hermz column */}
                      <div>
                        <div className="font-mono text-xs tracking-kicker uppercase pb-2 mb-2 border-b border-night-700" style={{ color: HC }}>
                          Hermz · {expandedData.hermzFilms.length} film{expandedData.hermzFilms.length !== 1 ? 's' : ''}
                        </div>
                        {expandedData.hermzFilms.length === 0 ? (
                          <EmptyNote pad="py-2">None</EmptyNote>
                        ) : (
                          <div className="space-y-0.5">
                            {expandedData.hermzFilms.map((r, i) => (
                              <Link key={i} to={`/movies/${r.films?.id}`}
                                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-night-700/40 transition-colors group">
                                <span className="font-mono text-xs text-gray-500 w-7 text-right flex-shrink-0">#{r.rank}</span>
                                <span className="text-sm text-gray-200 group-hover:text-film-400 transition-colors truncate flex-1">{r.films?.title ?? '?'}</span>
                                <span className="font-display text-lg leading-none flex-shrink-0" style={{ color: HC }}>{r[expandedCat]}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* ── Money & Kryptonite — all-time scoring tendencies ─────────────── */}
          <MoneyKryptoniteSection scoresData={scoresData} />

        </div>
      )}
    </div>
  )
}
