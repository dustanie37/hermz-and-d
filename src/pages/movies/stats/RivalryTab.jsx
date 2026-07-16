import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DC, HC, sortTitle } from '../../../lib/helpers'
import {
  EVENTS_ORDER, latestEventYear, PanelHeader, EmptyNote, H2HBar,
  primaryGenre, decade, decadeLabel,
} from './shared'

// ── H2H TASTE COMPARISON ──────────────────────────────────────────────────────
function computeH2HData(dustFilms, mattFilms, accessor) {
  const dustCounts = {}, mattCounts = {}
  dustFilms.forEach(f => { const l = accessor(f); if (l) dustCounts[l] = (dustCounts[l] || 0) + 1 })
  mattFilms.forEach(f => { const l = accessor(f); if (l) mattCounts[l] = (mattCounts[l] || 0) + 1 })
  const allLabels = new Set([...Object.keys(dustCounts), ...Object.keys(mattCounts)])
  return [...allLabels]
    .map(label => ({ label, dustCount: dustCounts[label] || 0, mattCount: mattCounts[label] || 0 }))
    .sort((a, b) => (b.dustCount + b.mattCount) - (a.dustCount + a.mattCount))
}

function TasteComparisonSection({ allH2HFilms, loading }) {
  const [selectedYear, setSelectedYear] = useState(() => latestEventYear())
  const h2hFilms = allH2HFilms[selectedYear] || { dustin: [], matt: [] }
  const { dustin: dustFilms, matt: mattFilms } = h2hFilms

  const decadeH2H = useMemo(() =>
    computeH2HData(dustFilms, mattFilms, f => { const d = decade(f.release_year); return d ? decadeLabel(d) : null })
    .sort((a, b) => {
      const da = parseInt(a.label), db = parseInt(b.label)
      return isNaN(da) || isNaN(db) ? (a.label || '').localeCompare(b.label || '') : da - db
    })
  , [dustFilms, mattFilms])

  const genreH2H = useMemo(() =>
    computeH2HData(dustFilms, mattFilms, f => primaryGenre(f)).slice(0, 12)
  , [dustFilms, mattFilms])

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="font-display text-3xl text-white tracking-wide leading-none">TASTE FACE-OFF</h2>
          <p className="kicker-dim mt-2">Individual lists, not combined</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EVENTS_ORDER.map(yr => (
            <button key={yr} onClick={() => setSelectedYear(yr)}
                    className={yr === selectedYear ? 'pill-film' : 'pill'}>{yr}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <span className="font-mono text-sm tracking-kicker text-gray-400 animate-pulse">LOADING FACE-OFF DATA…</span>
        </div>
      ) : !dustFilms.length || !mattFilms.length ? (
        <EmptyNote pad="py-6">No data for {selectedYear}</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <PanelHeader title="Decade Face-Off" />
            <H2HBar data={decadeH2H} />
          </div>
          <div className="card">
            <PanelHeader title="Genre Face-Off" />
            <H2HBar data={genreH2H} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── RIVALRY TAB ───────────────────────────────────────────────────────────────
export default function RivalryTab({ rivalryData, allH2HFilms, allH2HLoading }) {
  const { gapsByFilm, filmMap: rivalFilmMap, dustOnly, mattOnly } = rivalryData
  const [eventFilter, setEventFilter] = useState(() => latestEventYear())

  // Gap film row
  function GapRow({ filmId, title, dustRank, mattRank, gap, direction }) {
    const color = direction === 'dust' ? DC : HC
    return (
      <Link to={`/movies/${filmId}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{title}</div>
          <div className="font-mono text-xs tracking-kicker text-gray-400 mt-0.5 uppercase flex items-center gap-2">
            <span style={{ color: DC }}>D #{dustRank}</span>
            <span className="text-gray-600">·</span>
            <span style={{ color: HC }}>H #{mattRank}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-display text-2xl tracking-wide leading-none" style={{ color }}>+{Math.abs(gap)}</div>
        </div>
      </Link>
    )
  }

  // Largest gap in Dust's favor (positive gap = mattRank > dustRank = Dust ranked higher)
  const dustFavors = useMemo(() =>
    Object.entries(gapsByFilm)
      .filter(([, evts]) => evts[eventFilter] != null && evts[eventFilter].gap > 0)
      .map(([filmId, evts]) => ({
        filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?',
        dustRank: evts[eventFilter].dustRank, mattRank: evts[eventFilter].mattRank,
        gap: evts[eventFilter].gap,
      }))
      .sort((a, b) => b.gap - a.gap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap, eventFilter])

  const hermzFavors = useMemo(() =>
    Object.entries(gapsByFilm)
      .filter(([, evts]) => evts[eventFilter] != null && evts[eventFilter].gap < 0)
      .map(([filmId, evts]) => ({
        filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?',
        dustRank: evts[eventFilter].dustRank, mattRank: evts[eventFilter].mattRank,
        gap: evts[eventFilter].gap,
      }))
      .sort((a, b) => a.gap - b.gap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap, eventFilter])

  // Most polarizing: 2+ shared events, sorted by avg |gap|
  const mostPolarizing = useMemo(() =>
    Object.entries(gapsByFilm)
      .map(([filmId, evts]) => {
        const shared = Object.values(evts)
        if (shared.length < 2) return null
        const avgGap = shared.reduce((s, e) => s + Math.abs(e.gap), 0) / shared.length
        const years = new Set(Object.keys(evts).map(Number))
        return { filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?', avgGap: +avgGap.toFixed(1), years }
      })
      .filter(Boolean)
      .sort((a, b) => b.avgGap - a.avgGap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap])

  // Most agreed: 2+ shared events, sorted by smallest avg |gap|
  const mostAgreed = useMemo(() =>
    Object.entries(gapsByFilm)
      .map(([filmId, evts]) => {
        const shared = Object.values(evts)
        if (shared.length < 2) return null
        const avgGap = shared.reduce((s, e) => s + Math.abs(e.gap), 0) / shared.length
        const years = new Set(Object.keys(evts).map(Number))
        return { filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?', avgGap: +avgGap.toFixed(1), years }
      })
      .filter(Boolean)
      .sort((a, b) => a.avgGap - b.avgGap).slice(0, 10)
  , [gapsByFilm, rivalFilmMap])

  // The Flip: gap direction changed between events
  const theFlip = useMemo(() =>
    Object.entries(gapsByFilm)
      .map(([filmId, evts]) => {
        const orderedGaps = EVENTS_ORDER
          .filter(y => evts[y] != null)
          .map(y => ({ year: y, gap: evts[y].gap, dustRank: evts[y].dustRank, mattRank: evts[y].mattRank }))
        if (orderedGaps.length < 2) return null
        let flipped = false
        for (let i = 1; i < orderedGaps.length; i++) {
          const prev = orderedGaps[i - 1].gap, curr = orderedGaps[i].gap
          if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) { flipped = true; break }
        }
        if (!flipped) return null
        return { filmId: Number(filmId), title: rivalFilmMap[filmId]?.title || '?', orderedGaps }
      })
      .filter(Boolean)
      .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
  , [gapsByFilm, rivalFilmMap])

  return (
    <div className="space-y-7">

      {/* Taste Face-Off */}
      <TasteComparisonSection allH2HFilms={allH2HFilms} loading={allH2HLoading} />

      <div className="border-t border-night-700/60" />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'FILMS BOTH RANKED', value: Object.keys(gapsByFilm).length, color: 'text-white' },
          { label: 'DUST EXCLUSIVES',   value: dustOnly.length,  color: `text-film-400`  },
          { label: 'HERMZ EXCLUSIVES',  value: mattOnly.length,  color: `text-gold-400`  },
          { label: 'ALLEGIANCE FLIPS',  value: theFlip.length,   color: 'text-cinema-400' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <div className={`font-display text-3xl leading-none tracking-wide ${s.color}`}>{s.value}</div>
            <div className="stat-label mt-2">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Biggest Gaps */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-display text-3xl text-white tracking-wide leading-none">BIGGEST GAPS</h2>
            <p className="kicker-dim mt-2">Individual rankings</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EVENTS_ORDER.map(yr => (
              <button key={yr} onClick={() => setEventFilter(yr)}
                      className={yr === eventFilter ? 'pill-film' : 'pill'}>{yr}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: DC }} />
              <PanelHeader title="Dust Favors" />
            </div>
            {dustFavors.length === 0
              ? <EmptyNote>No shared rankings for {eventFilter}</EmptyNote>
              : <div className="space-y-0.5">{dustFavors.map(f => <GapRow key={f.filmId} {...f} direction="dust" />)}</div>
            }
          </div>
          <div className="card">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: HC }} />
              <PanelHeader title="Hermz Favors" />
            </div>
            {hermzFavors.length === 0
              ? <EmptyNote>No shared rankings for {eventFilter}</EmptyNote>
              : <div className="space-y-0.5">{hermzFavors.map(f => <GapRow key={f.filmId} {...f} direction="hermz" />)}</div>
            }
          </div>
        </div>
      </div>

      {/* Polarizing vs Agreed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <PanelHeader title="Most Polarizing" subtitle="Average gap · 2+ shared editions" />
          <div className="space-y-0.5">
            {mostPolarizing.map(f => (
              <Link key={f.filmId} to={`/movies/${f.filmId}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{f.title}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {EVENTS_ORDER.map(yr => (
                      <span key={yr} title={String(yr)} className={`w-2 h-2 rounded-full flex-shrink-0 ${f.years.has(yr) ? 'bg-cinema-400' : 'bg-night-600'}`} />
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display text-xl tracking-wide text-cinema-400 leading-none">{f.avgGap}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <PanelHeader title="Most Agreed-Upon" subtitle="Smallest average gap · 2+ shared editions" />
          <div className="space-y-0.5">
            {mostAgreed.map(f => (
              <Link key={f.filmId} to={`/movies/${f.filmId}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{f.title}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {EVENTS_ORDER.map(yr => (
                      <span key={yr} title={String(yr)} className={`w-2 h-2 rounded-full flex-shrink-0 ${f.years.has(yr) ? 'bg-emerald-400' : 'bg-night-600'}`} />
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display text-xl tracking-wide text-emerald-400 leading-none">{f.avgGap}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* The Flip */}
      {theFlip.length > 0 && (
        <div className="card">
          <PanelHeader title="The Flip" subtitle={`${theFlip.length} films where allegiance switched sides between editions`} />
          <div className="space-y-1">
            {theFlip.map(f => (
              <Link key={f.filmId} to={`/movies/${f.filmId}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-night-700/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{f.title}</div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {f.orderedGaps.map(eg => {
                    const c = eg.gap > 0 ? DC : HC
                    const who = eg.gap > 0 ? 'D' : 'H'
                    return (
                      <div key={eg.year} className="text-center min-w-[52px]">
                        <div className="font-mono text-xs text-gray-400 leading-none">{eg.year}</div>
                        <div className="font-mono text-base leading-tight tabular-nums mt-1 font-bold" style={{ color: c }}>
                          {who}+{Math.abs(eg.gap)}
                        </div>
                        <div className="font-mono text-xs text-gray-400 leading-none mt-1">D{eg.dustRank} · H{eg.mattRank}</div>
                      </div>
                    )
                  })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Solo Picks */}
      <div>
        <h2 className="font-display text-3xl text-white tracking-wide leading-none mb-1">SOLO PICKS</h2>
        <p className="kicker-dim mb-5">Ranked by one, never by the other · all {EVENTS_ORDER.length} editions</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: DC }} />
              <PanelHeader title="Dust's Exclusives" subtitle={`${dustOnly.length} films`} />
            </div>
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {dustOnly.map(f => (
                <Link key={f.filmId} to={`/movies/${f.filmId}`}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                  <span className="text-base text-gray-200 group-hover:text-film-400 transition-colors truncate">{f.title}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: HC }} />
              <PanelHeader title="Hermz's Exclusives" subtitle={`${mattOnly.length} films`} />
            </div>
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {mattOnly.map(f => (
                <Link key={f.filmId} to={`/movies/${f.filmId}`}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-night-700/40 transition-colors group">
                  <span className="text-base text-gray-200 group-hover:text-film-400 transition-colors truncate">{f.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
