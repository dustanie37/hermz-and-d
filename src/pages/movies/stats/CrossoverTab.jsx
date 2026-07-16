import { useEffect, useMemo, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import FilmStill from '../../../components/FilmStill'
import { HC, CC } from '../../../lib/helpers'
import { EVENTS_ORDER, EVENTS_LABEL, latestEventYear, PanelHeader, EmptyNote } from './shared'

const MAJOR_CATS = [
  { key: 'Best Picture',             label: 'Picture'           },
  { key: 'Best Director',            label: 'Director'          },
  { key: 'Best Actor',               label: 'Actor'             },
  { key: 'Best Actress',             label: 'Actress'           },
  { key: 'Best Supporting Actor',    label: 'Supp. Actor'       },
  { key: 'Best Supporting Actress',  label: 'Supp. Actress'     },
  { key: 'Best Original Screenplay', label: 'Orig. Screenplay'  },
  { key: 'Best Adapted Screenplay',  label: 'Adapt. Screenplay' },
]

// ── GUILTY PLEASURES & HOMEWORK — our ranks vs the agreed acclaim score ──────
function GuiltyPleasuresSection({ allTimeData, profiles, events }) {
  const [acclaimMap, setAcclaimMap] = useState(null)
  const latest = latestEventYear()

  useEffect(() => {
    if (acclaimMap || !profiles?.dustin || !events?.length) return
    const ev = events.find(e => e.year === latest)
    if (!ev) return
    async function load() {
      // Acclaim is scored jointly — either player's rows carry the agreed value
      const { data } = await supabase
        .from('individual_rankings')
        .select('film_id, score_acclaim')
        .eq('event_id', ev.id)
        .eq('user_id', profiles.dustin)
      const map = {}
      data?.forEach(r => { if (r.score_acclaim != null) map[r.film_id] = r.score_acclaim })
      setAcclaimMap(map)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, events])

  const list = useMemo(() => {
    if (!acclaimMap || !allTimeData) return null
    return (allTimeData.byEvent[latest] || [])
      .filter(({ filmId }) => acclaimMap[filmId] != null)
      .map(({ filmId, rank }) => ({
        filmId, rank,
        title: allTimeData.filmMap[filmId]?.title || '?',
        acclaim: acclaimMap[filmId],
      }))
  }, [acclaimMap, allTimeData, latest])

  const guilty   = useMemo(() => list ? list.filter(f => f.acclaim <= 6).sort((a, b) => a.rank - b.rank).slice(0, 8) : [], [list])
  const homework = useMemo(() => list ? list.filter(f => f.acclaim >= 9).sort((a, b) => b.rank - a.rank).slice(0, 8) : [], [list])

  if (!list || (!guilty.length && !homework.length)) return null

  function Row({ f, accent }) {
    return (
      <Link to={`/movies/${f.filmId}`}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-night-700/40 transition-colors group">
        <span className="font-display text-2xl tracking-wide leading-none w-11 text-right flex-shrink-0" style={{ color: accent }}>#{f.rank}</span>
        <span className="text-sm font-semibold text-white flex-1 truncate group-hover:text-film-400 transition-colors">{f.title}</span>
        <span className="font-mono text-xs tracking-kicker text-gray-400 flex-shrink-0 uppercase">acclaim {f.acclaim}</span>
      </Link>
    )
  }

  return (
    <div className="card">
      <PanelHeader title="Guilty Pleasures & Homework" subtitle={`${latest} combined list · our rank vs the agreed acclaim score`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        <div>
          <div className="font-mono text-xs tracking-kicker uppercase pb-2 mb-2 border-b border-night-700" style={{ color: HC }}>
            🍿 Guilty Pleasures · acclaim ≤ 6, ranked anyway
          </div>
          {guilty.length === 0
            ? <EmptyNote>Nothing to be ashamed of</EmptyNote>
            : <div className="space-y-0.5">{guilty.map(f => <Row key={f.filmId} f={f} accent={HC} />)}</div>}
        </div>
        <div>
          <div className="font-mono text-xs tracking-kicker uppercase pb-2 mb-2 border-b border-night-700" style={{ color: CC }}>
            📚 Homework · acclaim 9–10, ranked lowest
          </div>
          {homework.length === 0
            ? <EmptyNote>All the classics get their due</EmptyNote>
            : <div className="space-y-0.5">{homework.map(f => <Row key={f.filmId} f={f} accent={CC} />)}</div>}
        </div>
      </div>
    </div>
  )
}

// ── CROSSOVER TAB ─────────────────────────────────────────────────────────────
export default function CrossoverTab({ data, allTimeData, profiles, events }) {
  const { films, totalWithNoms, totalWithWins, totalFilmsOnLists } = data
  const [filter,     setFilter]     = useState('all')
  const [catFilter,  setCatFilter]  = useState(null)
  const [yearFilter, setYearFilter] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  let displayed = filter === 'wins' ? films.filter(f => f.oscarWins > 0)
    : filter === 'noms' ? films.filter(f => f.oscarWins === 0 && f.oscarNoms > 0)
    : films
  if (yearFilter)  displayed = displayed.filter(f => f.combinedRanks[yearFilter] != null)
  if (catFilter)   displayed = displayed.filter(f => f.winCategories.includes(catFilter))
  displayed = [...displayed].sort((a, b) => {
    if (yearFilter) {
      const ra = a.combinedRanks[yearFilter] ?? 999, rb = b.combinedRanks[yearFilter] ?? 999
      return ra - rb || b.oscarWins - a.oscarWins
    }
    return b.oscarWins - a.oscarWins || (a.bestCombinedRank ?? 999) - (b.bestCombinedRank ?? 999)
  })
  function toggleCat(key) { setCatFilter(prev => prev === key ? null : key); if (catFilter !== key) setFilter('all') }
  return (
    <div className="space-y-7">
      <GuiltyPleasuresSection allTimeData={allTimeData} profiles={profiles} events={events} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { v: totalFilmsOnLists,              label: 'On Combined Lists', color: 'text-white' },
          { v: totalWithNoms,                   label: 'With Oscar Noms',   color: 'text-gold-400' },
          { v: totalWithWins,                   label: 'With Oscar Wins',   color: 'text-emerald-400' },
          { v: totalFilmsOnLists - totalWithNoms, label: 'No Oscar Data',   color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="card text-center py-5">
            <div className={`font-display text-3xl leading-none tracking-wide ${s.color}`}>{s.v}</div>
            <div className="stat-label mt-2">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <PanelHeader title="Oscar × Our Rankings" subtitle="Combined-list films with Oscar recognition" />
            <div className="flex gap-1 p-1 bg-night-900/60 rounded-full flex-shrink-0">
              {[{ v: 'all', label: 'All' }, { v: 'wins', label: '🏆 Winners' }, { v: 'noms', label: 'Noms Only' }].map(opt => (
                <button key={opt.v} onClick={() => { setFilter(opt.v); setCatFilter(null) }}
                  className={`px-3 py-1 rounded-full font-mono text-xs tracking-kicker uppercase transition-all ${
                    filter === opt.v && !catFilter ? 'bg-white text-night-950' : 'text-gray-400 hover:text-white'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase flex-shrink-0">LIST</span>
            {[null, ...EVENTS_ORDER].map(yr => (
              <button key={yr ?? 'all'} onClick={() => setYearFilter(yr)} className={yearFilter === yr ? 'pill-film' : 'pill'}>{yr ?? 'All'}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase flex-shrink-0">WON</span>
            {MAJOR_CATS.map(cat => (
              <button key={cat.key} onClick={() => toggleCat(cat.key)}
                className={catFilter === cat.key
                  ? 'px-3 py-1.5 rounded-full font-medium text-xs bg-emerald-500 text-night-950 border-0'
                  : 'pill'}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header text-left w-10">#</th>
                <th className="table-header">Film</th>
                <th className="table-header text-center">Wins</th>
                <th className="table-header text-center">Noms</th>
                <th className="table-header text-center hidden sm:table-cell">{yearFilter ? `${yearFilter} Rank` : 'Best Rank'}</th>
                <th className="table-header text-center hidden lg:table-cell">Combined Ranks</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((f, i) => {
                const isExpanded = expandedId === f.filmId
                const hasBP = f.winCategories.includes('Best Picture')
                const hasBD = f.winCategories.includes('Best Director')
                return (
                  <Fragment key={f.filmId}>
                    <tr className="table-row-hover cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : f.filmId)}>
                      <td className="table-cell text-gray-500 font-mono text-sm tracking-kicker">{i + 1}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <FilmStill src={f.poster_url} title={f.title} className="w-9 h-12 rounded border border-white/10 flex-shrink-0" />
                          <div className="min-w-0">
                            <Link to={`/movies/${f.filmId}`} onClick={e => e.stopPropagation()}
                                  className="text-sm font-semibold text-white hover:text-film-400 transition-colors truncate block">{f.title}</Link>
                            <div className="font-mono text-xs tracking-kicker text-gray-400 mt-1 flex items-center gap-2 uppercase flex-wrap">
                              {f.release_year && <span>{f.release_year}</span>}
                              {hasBP && <span className="text-gold-400">● Best Picture</span>}
                              {hasBD && !hasBP && <span className="text-cinema-400">● Best Director</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        {f.oscarWins > 0
                          ? <span className="font-display text-xl text-emerald-400 tracking-wide leading-none">{f.oscarWins}</span>
                          : <span className="font-mono text-xs text-gray-600">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        <span className="font-mono text-sm text-gray-400 tabular-nums">{f.oscarNoms}</span>
                      </td>
                      <td className="table-cell text-center hidden sm:table-cell">
                        {(() => {
                          const r = yearFilter ? f.combinedRanks[yearFilter] : f.bestCombinedRank
                          if (r == null) return <span className="text-gray-600">—</span>
                          const c = r <= 5 ? 'text-gold-400' : r <= 15 ? 'text-film-400' : 'text-gray-400'
                          return <span className={`font-display text-xl tracking-wide leading-none ${c}`}>#{r}</span>
                        })()}
                      </td>
                      <td className="table-cell text-center hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-2">
                          {EVENTS_ORDER.map(yr => {
                            const r = f.combinedRanks[yr]
                            return (
                              <div key={yr} className="text-center">
                                <div className="font-mono text-sm tracking-kicker text-gray-500 leading-none">{EVENTS_LABEL[yr]}</div>
                                <div className={`font-mono text-xs leading-tight mt-0.5 tabular-nums ${r ? (r <= 5 ? 'text-gold-400' : r <= 15 ? 'text-film-400' : 'text-gray-400') : 'text-gray-600'}`}>
                                  {r ? `#${r}` : '–'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-night-700/60 bg-night-900/40">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          {f.winCategories.length > 0 && (
                            <div className="mb-2">
                              <span className="font-mono text-xs tracking-cinema text-emerald-400 uppercase mr-2">WON</span>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {f.winCategories.map(c => (
                                  <span key={c} className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {f.nomCategories.length > 0 && (
                            <div>
                              <span className="font-mono text-xs tracking-cinema text-gray-400 uppercase mr-2">NOMINATED</span>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {f.nomCategories.map(c => (
                                  <span key={c} className="text-xs bg-night-700 text-gray-400 border border-night-600 px-2 py-0.5 rounded-full">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {displayed.length === 0 && (
            <EmptyNote pad="py-12">
              {catFilter && yearFilter ? `No films on our ${yearFilter} combined list won ${catFilter}`
                : catFilter ? `No films on our combined lists won ${catFilter}`
                : yearFilter ? `No Oscar data for films on our ${yearFilter} combined list`
                : 'No films match this filter'}
            </EmptyNote>
          )}
        </div>
      </div>
    </div>
  )
}
