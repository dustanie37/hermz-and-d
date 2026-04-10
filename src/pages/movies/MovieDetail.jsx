import { useState, useEffect } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceDot,
} from 'recharts'

// ── constants ─────────────────────────────────────────────────────────────────

const EVENTS = [2001, 2007, 2016, 2026]
const HC = '#d97706'   // gold  — Matt / Hermz
const DC = '#6170f5'   // film  — Dustin
const CC = '#10b981'   // emerald — Combined

// Scoring categories in display order
const SCORE_CATS = [
  { key: 'score_lead_performance',  label: 'Lead Performance',       max: 10, years: 'all' },
  { key: 'score_supp_performance',  label: 'Supporting Performance', max: 10, years: 'all' },
  { key: 'score_direction',         label: 'Direction',              max: 10, years: 'all' },
  { key: 'score_cinematography',    label: 'Cinematography',         max: 10, years: 'all' },
  { key: 'score_influence',         label: 'Influence',              max: 10, years: 'all' },
  { key: 'score_acclaim',           label: 'Acclaim',                max: 10, years: 'all' },
  { key: 'score_personal_impact',   label: 'Personal Impact',        max: 20, years: 'all' },
  { key: 'score_plot',              label: 'Plot',                   max: 10, years: [2001], note: '2001 only' },
  { key: 'score_dialogue',          label: 'Dialogue',               max: 10, years: [2001], note: '2001 only' },
  { key: 'score_screenplay',        label: 'Screenplay',             max: 10, years: [2007, 2016, 2026], note: '2007+' },
  { key: 'score_production_design', label: 'Production Design',      max: 10, years: [2007, 2016, 2026], note: '2007+' },
]

const ACCLAIM_LISTS = [
  { key: 'afi_top100_rank',        label: 'AFI Top 100',         ranked: true  },
  { key: 'afi_comedies_rank',      label: 'AFI Top 100 Comedies',ranked: true  },
  { key: 'imdb_top250_rank',       label: 'IMDB Top 250',        ranked: true  },
  { key: 'nyt_2000s_rank',         label: 'NYT Best of 2000s',   ranked: true  },
  { key: 'sight_sound_2022_rank',  label: "Sight & Sound '22",   ranked: true  },
  { key: 'variety_comedies_rank',  label: 'Variety Comedies',    ranked: true  },
  { key: 'national_film_registry', label: 'National Film Registry', ranked: false },
]

const OSCAR_WINS = [
  { key: 'won_best_picture',       label: 'Best Picture'       },
  { key: 'won_best_director',      label: 'Best Director'      },
  { key: 'won_best_actor',         label: 'Best Actor'         },
  { key: 'won_best_actress',       label: 'Best Actress'       },
  { key: 'won_best_supp_actor',    label: 'Best Supp. Actor'   },
  { key: 'won_best_supp_actress',  label: 'Best Supp. Actress' },
  { key: 'won_screenplay',         label: 'Best Screenplay'    },
  { key: 'won_cinematography',     label: 'Best Cinematography'},
  { key: 'won_production_design',  label: 'Best Prod. Design'  },
]

// ── tiny helpers ──────────────────────────────────────────────────────────────

function PosterFull({ url, title }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div className="w-full h-full flex items-center justify-center
                      bg-stone-200 dark:bg-night-700 text-5xl rounded-xl">
        🎬
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={title}
      onError={() => setErr(true)}
      className="w-full h-full object-cover rounded-xl shadow-xl"
    />
  )
}

function ScoreCell({ value, max = 10 }) {
  if (value == null) return <span className="text-gray-300 dark:text-gray-700">—</span>
  const pct = (value / max) * 100
  const color = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400'
              : pct >= 60 ? 'text-gold-600 dark:text-gold-400'
              : 'text-gray-600 dark:text-gray-400'
  return <span className={`font-semibold ${color}`}>{value}</span>
}

function RankBadge({ rank, label }) {
  if (!rank) return <span className="text-xs text-gray-400 italic">NR</span>
  return (
    <span className="font-bold text-gray-900 dark:text-white">#{rank}</span>
  )
}

function RankMovement({ from, to }) {
  if (from == null || to == null) return null
  const diff = from - to   // positive = improved
  if (diff > 0) return <span className="text-xs rank-up ml-1">↑{diff}</span>
  if (diff < 0) return <span className="text-xs rank-down ml-1">↓{Math.abs(diff)}</span>
  return <span className="text-xs rank-same ml-1">●</span>
}

// Custom recharts tooltip
function RankTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-night-800 border border-stone-200 dark:border-night-600
                    rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="font-bold text-gray-900 dark:text-white mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-gray-600 dark:text-gray-400">{p.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {p.value != null ? `#${p.value}` : 'NR'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MovieDetail() {
  const { filmId }   = useParams()
  const location     = useLocation()
  const navigate     = useNavigate()

  const [film,     setFilm]     = useState(null)
  const [events,   setEvents]   = useState([])   // ranking_events ordered by year
  const [dustinRows, setDustinRows] = useState({})  // { eventYear: individual_rankings row }
  const [mattRows,   setMattRows]   = useState({})
  const [combined,   setCombined]   = useState({})  // { eventYear: combined_rankings row }
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  // Back-link: prefer the referrer passed via router state, else /movies/list
  const backTo = location.state?.from || '/movies/list'

  useEffect(() => {
    if (!filmId) return
    fetchAll(Number(filmId))
  }, [filmId])

  async function fetchAll(id) {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: filmData, error: fe },
        { data: evData,   error: ee },
        { data: indData,  error: ie },
        { data: combData, error: ce },
      ] = await Promise.all([
        supabase.from('films').select('*').eq('id', id).single(),
        supabase.from('ranking_events').select('id,year,label').order('year'),
        supabase
          .from('individual_rankings')
          .select(`*, profiles(username, display_name), ranking_events(year)`)
          .eq('film_id', id),
        supabase
          .from('combined_rankings')
          .select(`*, ranking_events(year)`)
          .eq('film_id', id),
      ])

      if (fe) throw fe
      if (ee) throw ee
      if (ie) throw ie
      if (ce) throw ce

      setFilm(filmData)
      setEvents(evData || [])

      // Index individual rows by person+year
      const dRows = {}
      const mRows = {}
      ;(indData || []).forEach(r => {
        const yr = r.ranking_events?.year
        if (!yr) return
        if (r.profiles?.username === 'dustin') dRows[yr] = r
        if (r.profiles?.username === 'matt')   mRows[yr] = r
      })
      setDustinRows(dRows)
      setMattRows(mRows)

      // Index combined by year
      const cRows = {}
      ;(combData || []).forEach(r => {
        const yr = r.ranking_events?.year
        if (yr) cRows[yr] = r
      })
      setCombined(cRows)

    } catch (e) {
      setError(e.message || 'Failed to load film')
    } finally {
      setLoading(false)
    }
  }

  // ── derived data ───────────────────────────────────────────────────────────

  // Which events does this film appear on (any of the three lists)
  const appearsIn = EVENTS.filter(yr =>
    dustinRows[yr] || mattRows[yr] || combined[yr]
  )

  // Genres array from comma-separated OMDB string
  const genres = film?.omdb_genres
    ? film.omdb_genres.split(',').map(g => g.trim()).filter(Boolean)
    : []

  // Actors array
  const actors = [film?.actor_1, film?.actor_2, film?.actor_3, film?.actor_4, film?.actor_5]
    .filter(Boolean)

  // Oscar major wins
  const majorWins = OSCAR_WINS.filter(w => film?.[w.key])

  // Acclaim list hits
  const acclaimHits = ACCLAIM_LISTS.filter(a =>
    a.ranked ? film?.[a.key] != null : film?.[a.key]
  )

  // Chart data — one point per event year that has ANY ranking data
  // Y-axis = rank (lower number = higher on list → invert axis)
  const chartData = EVENTS.map(yr => ({
    year: String(yr),
    Dustin:   dustinRows[yr]?.rank   ?? null,
    Hermz:    mattRows[yr]?.rank     ?? null,
    Combined: combined[yr]?.combined_rank ?? null,
  }))

  // Score categories to actually show (at least one event has a value for it)
  const activeCats = SCORE_CATS.filter(cat => {
    if (cat.years === 'all') return true
    return cat.years.some(yr => dustinRows[yr]?.[cat.key] != null || mattRows[yr]?.[cat.key] != null)
  })

  // ── render states ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center">
      <span className="text-gray-400 animate-pulse text-sm">Loading film…</span>
    </div>
  )

  if (error || !film) return (
    <div className="max-w-5xl mx-auto px-4 py-16 text-center">
      <p className="text-red-400 text-sm mb-4">{error || 'Film not found.'}</p>
      <Link to="/movies/list" className="btn-ghost text-sm">← Back to Rankings</Link>
    </div>
  )

  // ── main render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* ── Back link ── */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          ← Back
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          HERO — Poster + Film Info
      ══════════════════════════════════════════════════════════ */}
      <div className="card p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-0">

          {/* Poster */}
          <div className="md:w-52 flex-shrink-0 bg-stone-100 dark:bg-night-900
                          flex items-stretch min-h-[200px] md:min-h-0">
            <div className="w-full p-4">
              <PosterFull url={film.poster_url} title={film.title} />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 p-6 flex flex-col justify-between gap-4">
            <div>
              {/* Title + year */}
              <div className="flex flex-wrap items-baseline gap-3 mb-1">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
                  {film.title}
                </h1>
                {film.release_year && (
                  <span className="text-lg text-gray-400 dark:text-gray-500 font-light">
                    {film.release_year}
                  </span>
                )}
              </div>

              {/* Director */}
              {film.director && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Directed by <span className="text-gray-700 dark:text-gray-300 font-medium">{film.director}</span>
                </p>
              )}

              {/* Genres */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {genres.map(g => (
                    <span key={g}
                      className="text-xs px-2.5 py-0.5 rounded-full
                                 bg-stone-100 text-gray-600 border border-stone-200
                                 dark:bg-night-700 dark:text-gray-400 dark:border-night-600">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Actors */}
              {actors.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cast</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {actors.join(' · ')}
                  </p>
                </div>
              )}
            </div>

            {/* Acclaim score + Oscar quick stats */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-stone-100 dark:border-night-700">
              {film.acclaim_score != null && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gold-600 dark:text-gold-400 font-display">
                    {film.acclaim_score}<span className="text-sm text-gray-400">/10</span>
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Acclaim</div>
                </div>
              )}
              {film.oscar_nominations > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white font-display">
                    {film.oscar_nominations}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Oscar Nom{film.oscar_nominations !== 1 ? 's' : ''}</div>
                </div>
              )}
              {film.oscar_wins > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gold-500 dark:text-gold-400 font-display">
                    {film.oscar_wins}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Oscar Win{film.oscar_wins !== 1 ? 's' : ''}</div>
                </div>
              )}
              {/* How many combined lists it appeared on */}
              <div className="text-center">
                <div className="text-2xl font-bold text-film-600 dark:text-film-400 font-display">
                  {appearsIn.length}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Event{appearsIn.length !== 1 ? 's' : ''} Listed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TWO-COLUMN ROW — Oscar wins + Acclaim Lists
      ══════════════════════════════════════════════════════════ */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Oscar wins panel */}
        <div className="card">
          <h2 className="section-title text-lg mb-1">Oscar Wins</h2>
          <p className="section-subtitle mb-4">
            {film.oscar_nominations || 0} nomination{film.oscar_nominations !== 1 ? 's' : ''} · {film.oscar_wins || 0} win{film.oscar_wins !== 1 ? 's' : ''}
          </p>
          {majorWins.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {majorWins.map(w => (
                <span key={w.key} className="badge-gold flex items-center gap-1">
                  🏆 {w.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              {film.oscar_nominations > 0
                ? 'Nominated but did not win a tracked major category.'
                : 'No Oscar nominations on record.'}
            </p>
          )}
        </div>

        {/* Acclaim list appearances */}
        <div className="card">
          <h2 className="section-title text-lg mb-1">Acclaim Lists</h2>
          <p className="section-subtitle mb-4">External recognition</p>
          {acclaimHits.length > 0 ? (
            <div className="space-y-2">
              {acclaimHits.map(a => (
                <div key={a.key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{a.label}</span>
                  {a.ranked
                    ? <span className="font-bold text-gold-600 dark:text-gold-400">#{film[a.key]}</span>
                    : <span className="badge-gold">Listed</span>
                  }
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No tracked list appearances.</p>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          RANK HISTORY TABLE
      ══════════════════════════════════════════════════════════ */}
      {appearsIn.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-stone-100 dark:border-night-700">
            <h2 className="section-title text-lg mb-0.5">Rank History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ranking across all four events — NR if not on that list
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Event</th>
                  <th className="table-header text-center" style={{ color: DC }}>Dustin's Rank</th>
                  <th className="table-header text-center" style={{ color: HC }}>Hermz's Rank</th>
                  <th className="table-header text-center">Combined Rank</th>
                  <th className="table-header text-center hidden sm:table-cell">Combined Score</th>
                </tr>
              </thead>
              <tbody>
                {EVENTS.map((yr, i) => {
                  const dRow = dustinRows[yr]
                  const mRow = mattRows[yr]
                  const cRow = combined[yr]
                  const prevYr = EVENTS[i - 1]
                  const dPrev = prevYr ? dustinRows[prevYr]?.rank : null
                  const mPrev = prevYr ? mattRows[prevYr]?.rank : null
                  const cPrev = prevYr ? combined[prevYr]?.combined_rank : null
                  const onAny = dRow || mRow || cRow
                  const isDropOff = !onAny && i > 0 && EVENTS.slice(0, i).some(py => dustinRows[py] || mattRows[py])

                  return (
                    <tr key={yr} className={`table-row-hover ${!onAny ? 'opacity-40' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-gray-900 dark:text-white">{yr}</span>
                          {isDropOff && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-stone-100 dark:bg-night-700
                                           text-gray-400 dark:text-gray-500 italic">
                              off list
                            </span>
                          )}
                          {onAny && !dPrev && i > 0 && (
                            <span className="badge-gold text-xs">NEW</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        {dRow ? (
                          <span className="flex items-center justify-center gap-0.5">
                            <span className="font-semibold text-gray-900 dark:text-white">#{dRow.rank}</span>
                            <RankMovement from={dPrev} to={dRow.rank} />
                          </span>
                        ) : <span className="text-xs text-gray-400 italic">NR</span>}
                      </td>
                      <td className="table-cell text-center">
                        {mRow ? (
                          <span className="flex items-center justify-center gap-0.5">
                            <span className="font-semibold text-gray-900 dark:text-white">#{mRow.rank}</span>
                            <RankMovement from={mPrev} to={mRow.rank} />
                          </span>
                        ) : <span className="text-xs text-gray-400 italic">NR</span>}
                      </td>
                      <td className="table-cell text-center">
                        {cRow ? (
                          <span className="flex items-center justify-center gap-0.5">
                            <span className="font-bold text-gray-900 dark:text-white">#{cRow.combined_rank}</span>
                            <RankMovement from={cPrev} to={cRow.combined_rank} />
                          </span>
                        ) : <span className="text-xs text-gray-400 italic">NR</span>}
                      </td>
                      <td className="table-cell text-center hidden sm:table-cell">
                        {cRow
                          ? <span className="text-sm font-semibold text-gray-900 dark:text-white">{cRow.total_score}</span>
                          : <span className="text-xs text-gray-400 italic">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          RANK MOVEMENT CHART
      ══════════════════════════════════════════════════════════ */}
      {appearsIn.length > 1 && (
        <div className="card">
          <h2 className="section-title text-lg mb-0.5">Rank Movement</h2>
          <p className="section-subtitle mb-5">Personal and combined rank across all events (lower = better)</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                reversed
                tick={{ fontSize: 11, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `#${v}`}
                width={36}
              />
              <Tooltip content={<RankTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Line
                type="monotone"
                dataKey="Dustin"
                stroke={DC}
                strokeWidth={2}
                dot={{ r: 4, fill: DC }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="Hermz"
                stroke={HC}
                strokeWidth={2}
                dot={{ r: 4, fill: HC }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="Combined"
                stroke={CC}
                strokeWidth={2.5}
                strokeDasharray="5 3"
                dot={{ r: 4, fill: CC }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SCORE HISTORY TABLE
      ══════════════════════════════════════════════════════════ */}
      {appearsIn.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-stone-100 dark:border-night-700">
            <h2 className="section-title text-lg mb-0.5">Score History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Per-category scores across every event this film appeared in
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-44">Category</th>
                  {EVENTS.map(yr => (
                    (dustinRows[yr] || mattRows[yr]) && (
                      <th key={`d-${yr}`}
                        className="table-header text-center"
                        style={{ color: DC }}
                      >
                        Dust {yr}
                      </th>
                    )
                  ))}
                  {EVENTS.map(yr => (
                    (dustinRows[yr] || mattRows[yr]) && (
                      <th key={`m-${yr}`}
                        className="table-header text-center"
                        style={{ color: HC }}
                      >
                        Hermz {yr}
                      </th>
                    )
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeCats.map(cat => {
                  // Is this category relevant for each event year?
                  const catYears = cat.years === 'all'
                    ? EVENTS
                    : EVENTS.filter(yr => cat.years.includes(yr))

                  return (
                    <tr key={cat.key} className="table-row-hover">
                      <td className="table-cell">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {cat.label}
                        </span>
                        {cat.note && (
                          <span className="block text-xs text-gray-400">{cat.note}</span>
                        )}
                        <span className="text-xs text-gray-400">/{cat.max}</span>
                      </td>
                      {/* Dustin columns */}
                      {EVENTS.map(yr => {
                        if (!dustinRows[yr] && !mattRows[yr]) return null
                        const inYear = cat.years === 'all' || cat.years.includes(yr)
                        return (
                          <td key={`d-${yr}`} className="table-cell text-center">
                            {inYear
                              ? <ScoreCell value={dustinRows[yr]?.[cat.key]} max={cat.max} />
                              : <span className="text-xs text-gray-300 dark:text-gray-700">n/a</span>
                            }
                          </td>
                        )
                      })}
                      {/* Hermz (Matt) columns */}
                      {EVENTS.map(yr => {
                        if (!dustinRows[yr] && !mattRows[yr]) return null
                        const inYear = cat.years === 'all' || cat.years.includes(yr)
                        return (
                          <td key={`m-${yr}`} className="table-cell text-center">
                            {inYear
                              ? <ScoreCell value={mattRows[yr]?.[cat.key]} max={cat.max} />
                              : <span className="text-xs text-gray-300 dark:text-gray-700">n/a</span>
                            }
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* Total score row */}
                <tr className="bg-stone-50 dark:bg-night-900/50 font-semibold">
                  <td className="table-cell text-sm font-bold text-gray-900 dark:text-white">
                    Total Score
                  </td>
                  {EVENTS.map(yr => {
                    if (!dustinRows[yr] && !mattRows[yr]) return null
                    return (
                      <td key={`d-total-${yr}`} className="table-cell text-center">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {dustinRows[yr]?.total_score ?? '—'}
                        </span>
                      </td>
                    )
                  })}
                  {EVENTS.map(yr => {
                    if (!dustinRows[yr] && !mattRows[yr]) return null
                    return (
                      <td key={`m-total-${yr}`} className="table-cell text-center">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {mattRows[yr]?.total_score ?? '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No list appearances at all */}
      {appearsIn.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-gray-400 text-sm italic">This film has not appeared on any ranking list.</p>
        </div>
      )}

    </div>
  )
}
