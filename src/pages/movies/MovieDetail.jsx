import { useState, useEffect } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
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
  { key: 'score_screenplay',        label: 'Screenplay',             max: 10, years: [2007, 2016, 2026], note: '2007+' },
  { key: 'score_cinematography',    label: 'Cinematography',         max: 10, years: 'all' },
  { key: 'score_production_design', label: 'Production Design',      max: 10, years: [2007, 2016, 2026], note: '2007+' },
  { key: 'score_influence',         label: 'Influence',              max: 10, years: 'all' },
  { key: 'score_acclaim',           label: 'Acclaim',                max: 10, years: 'all' },
  { key: 'score_personal_impact',   label: 'Personal Impact',        max: 20, years: 'all' },
  { key: 'score_plot',              label: 'Plot',                   max: 10, years: [2001], note: '2001 only' },
  { key: 'score_dialogue',          label: 'Dialogue',               max: 10, years: [2001], note: '2001 only' },
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
  if (value == null) return <span className="text-base text-gray-300 dark:text-gray-700">—</span>
  const pct = (value / max) * 100
  const color = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400'
              : pct >= 60 ? 'text-gold-600 dark:text-gold-400'
              : 'text-gray-600 dark:text-gray-400'
  return <span className={`text-base font-semibold ${color}`}>{value}</span>
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

// ── suggestAcclaim ────────────────────────────────────────────────────────────
// Computes a suggested acclaim score (1–10) from Oscar data + external lists.
// Returns { score: Number, factors: String[] }

function suggestAcclaim(film) {
  if (!film) return null
  let pts = 0
  const factors = []

  // ── Sight & Sound 2022 (most prestigious critical poll) ────────────────────
  if (film.sight_sound_2022_rank != null) {
    if (film.sight_sound_2022_rank <= 10) {
      pts += 3.5; factors.push(`Sight & Sound Top 10 (#${film.sight_sound_2022_rank})`)
    } else if (film.sight_sound_2022_rank <= 100) {
      pts += 2.5; factors.push(`Sight & Sound Top 100 (#${film.sight_sound_2022_rank})`)
    } else {
      pts += 1.5; factors.push(`Sight & Sound 2022 listed (#${film.sight_sound_2022_rank})`)
    }
  }

  // ── AFI Top 100 ────────────────────────────────────────────────────────────
  if (film.afi_top100_rank != null) {
    if (film.afi_top100_rank <= 25) {
      pts += 2.5; factors.push(`AFI Top 25 (#${film.afi_top100_rank})`)
    } else {
      pts += 1.5; factors.push(`AFI Top 100 (#${film.afi_top100_rank})`)
    }
  }

  // ── Oscar wins ─────────────────────────────────────────────────────────────
  if (film.won_best_picture) {
    pts += 2.5; factors.push('Won Best Picture')
  }
  const prestiWins = [
    'won_best_director', 'won_best_actor', 'won_best_actress',
    'won_screenplay', 'won_cinematography',
  ].filter(k => film[k] && k !== 'won_best_picture')
  if (prestiWins.length > 0) {
    const boost = Math.min(prestiWins.length * 0.5, 1.5)
    pts += boost
    factors.push(`${prestiWins.length} major Oscar win${prestiWins.length > 1 ? 's' : ''}`)
  }

  // ── Oscar nominations ──────────────────────────────────────────────────────
  const noms = film.oscar_nominations || 0
  if (!film.won_best_picture && noms >= 10) {
    pts += 1.5; factors.push(`${noms} Oscar nominations`)
  } else if (!film.won_best_picture && noms >= 5) {
    pts += 0.75; factors.push(`${noms} Oscar nominations`)
  } else if (!film.won_best_picture && noms >= 2) {
    pts += 0.25
  }

  // ── IMDB Top 250 ──────────────────────────────────────────────────────────
  if (film.imdb_top250_rank != null) {
    if (film.imdb_top250_rank <= 25) {
      pts += 1.5; factors.push(`IMDB Top 25 (#${film.imdb_top250_rank})`)
    } else if (film.imdb_top250_rank <= 100) {
      pts += 1.0; factors.push(`IMDB Top 100 (#${film.imdb_top250_rank})`)
    } else {
      pts += 0.5; factors.push(`IMDB Top 250 (#${film.imdb_top250_rank})`)
    }
  }

  // ── National Film Registry ─────────────────────────────────────────────────
  if (film.national_film_registry) {
    pts += 0.5; factors.push('National Film Registry')
  }

  // ── Minor lists ────────────────────────────────────────────────────────────
  if (film.nyt_2000s_rank != null)       { pts += 0.25; factors.push(`NYT Best of 2000s (#${film.nyt_2000s_rank})`) }
  if (film.afi_comedies_rank != null)    { pts += 0.25; factors.push(`AFI Top Comedies (#${film.afi_comedies_rank})`) }
  if (film.variety_comedies_rank != null){ pts += 0.25; factors.push(`Variety Comedies (#${film.variety_comedies_rank})`) }

  // ── Map to 1–10 scale ─────────────────────────────────────────────────────
  // 0 pts → 2, 5 pts → 7, 10+ pts → 10
  const score = Math.min(10, Math.max(1, Math.round(2 + pts * 0.8)))
  return { score, factors }
}

// ── OscarNomsList ─────────────────────────────────────────────────────────────
// Renders the full Oscar nomination list from film_oscar_noms rows.
// Wins shown as gold badges, nominations as plain text pills.
// Groups by ceremony year if the film was nominated across multiple years.

function OscarNomsList({ noms, filmYear }) {
  // Group by ceremony_year (null → 'unknown')
  const byYear = {}
  noms.forEach(n => {
    const yr = n.ceremony_year ?? 'unknown'
    if (!byYear[yr]) byYear[yr] = []
    byYear[yr].push(n)
  })

  const years = Object.keys(byYear).sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return Number(a) - Number(b)
  })

  const singleYear = years.length === 1

  return (
    <div className="space-y-4">
      {years.map(yr => {
        const rows = byYear[yr]
        // Sort: wins first, then alphabetical
        const sorted = [...rows].sort((a, b) => {
          if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1
          return a.category_name.localeCompare(b.category_name)
        })

        // Show year label only for multi-year films or when year differs from release year
        const showYearLabel =
          !singleYear && yr !== 'unknown'

        return (
          <div key={yr}>
            {showYearLabel && (
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                {yr} Academy Awards
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {sorted.map((nom, i) =>
                nom.is_winner ? (
                  <span
                    key={`${nom.category_name}-${i}`}
                    className="badge-gold flex items-center gap-1 text-sm"
                  >
                    🏆 {nom.category_name}
                  </span>
                ) : (
                  <span
                    key={`${nom.category_name}-${i}`}
                    className="text-sm text-gray-500 dark:text-gray-400
                               px-2.5 py-0.5 rounded-full border
                               border-stone-200 dark:border-night-600
                               bg-stone-50 dark:bg-night-800"
                  >
                    {nom.category_name}
                  </span>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function MovieDetail() {
  const { filmId }   = useParams()
  const location     = useLocation()
  const navigate     = useNavigate()
  const { isAuthenticated } = useAuth()

  const [film,       setFilm]       = useState(null)
  const [events,     setEvents]     = useState([])   // ranking_events ordered by year
  const [dustinRows, setDustinRows] = useState({})   // { eventYear: individual_rankings row }
  const [mattRows,   setMattRows]   = useState({})
  const [combined,   setCombined]   = useState({})   // { eventYear: combined_rankings row }
  const [oscarNoms,  setOscarNoms]  = useState([])   // film_oscar_noms rows
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  // Acclaim score editing
  const [acclaimEditing, setAcclaimEditing] = useState(false)
  const [acclaimValue,   setAcclaimValue]   = useState('')
  const [acclaimSaving,  setAcclaimSaving]  = useState(false)
  const [acclaimError,   setAcclaimError]   = useState(null)

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
        { data: nomData,  error: ne },
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
        supabase
          .from('film_oscar_noms')
          .select('*')
          .eq('film_id', id)
          .order('is_winner', { ascending: false })
          .order('category_name'),
      ])

      if (fe) throw fe
      if (ee) throw ee
      if (ie) throw ie
      if (ce) throw ce
      // ne (oscar noms) is non-fatal — table may not exist yet

      setFilm(filmData)
      setEvents(evData || [])
      setOscarNoms(nomData || [])

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

  // ── acclaim score editing ──────────────────────────────────────────────────

  function startAcclaimEdit() {
    setAcclaimValue(film?.acclaim_score != null ? String(film.acclaim_score) : '')
    setAcclaimError(null)
    setAcclaimEditing(true)
  }

  function cancelAcclaimEdit() {
    setAcclaimEditing(false)
    setAcclaimError(null)
  }

  async function saveAcclaim() {
    const parsed = parseInt(acclaimValue, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 10) {
      setAcclaimError('Enter a number from 1 to 10')
      return
    }
    setAcclaimSaving(true)
    setAcclaimError(null)
    const { error: saveErr } = await supabase
      .from('films')
      .update({ acclaim_score: parsed })
      .eq('id', film.id)

    if (saveErr) {
      setAcclaimError(saveErr.message)
      setAcclaimSaving(false)
      return
    }
    // Optimistic update
    setFilm(f => ({ ...f, acclaim_score: parsed }))
    setAcclaimEditing(false)
    setAcclaimSaving(false)
  }

  async function clearAcclaim() {
    setAcclaimSaving(true)
    const { error: saveErr } = await supabase
      .from('films')
      .update({ acclaim_score: null })
      .eq('id', film.id)
    if (!saveErr) setFilm(f => ({ ...f, acclaim_score: null }))
    setAcclaimEditing(false)
    setAcclaimSaving(false)
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

  // Suggested acclaim score
  const suggestion = film ? suggestAcclaim(film) : null

  // Most recent event year this film appeared in (for hero rank display)
  const latestYear = [...EVENTS].reverse().find(yr => dustinRows[yr] || mattRows[yr] || combined[yr])

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

            {/* Rank quick stats — most recent event */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-stone-100 dark:border-night-700">
              <div className="text-center">
                <div className="text-2xl font-bold font-display" style={{ color: DC }}>
                  {latestYear && dustinRows[latestYear] ? `#${dustinRows[latestYear].rank}` : 'NR'}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Dustin's Rank</div>
                {latestYear && <div className="text-xs text-gray-400">{latestYear}</div>}
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-display" style={{ color: HC }}>
                  {latestYear && mattRows[latestYear] ? `#${mattRows[latestYear].rank}` : 'NR'}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Hermz's Rank</div>
                {latestYear && <div className="text-xs text-gray-400">{latestYear}</div>}
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-display">
                  {latestYear && combined[latestYear] ? `#${combined[latestYear].combined_rank}` : 'NR'}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Combined Rank</div>
                {latestYear && <div className="text-xs text-gray-400">{latestYear}</div>}
              </div>
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

        {/* Oscar history panel */}
        <div className="card">
          <h2 className="section-title text-lg mb-3">Oscar History</h2>

          {/* Totals strip */}
          <div className="flex gap-6 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white font-display">
                {film.oscar_nominations || 0}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">
                Nomination{film.oscar_nominations !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gold-500 dark:text-gold-400 font-display">
                {film.oscar_wins || 0}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">
                Win{film.oscar_wins !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Full nomination list from film_oscar_noms */}
          {oscarNoms.length > 0 ? (
            <>
              <OscarNomsList noms={oscarNoms} filmYear={film.release_year} />
              {oscarNoms.length < (film.oscar_nominations || 0) && (
                <p className="text-xs text-gray-400 italic mt-3">
                  Showing {oscarNoms.length} of {film.oscar_nominations} nominations — some categories unavailable.
                </p>
              )}
            </>
          ) : majorWins.length > 0 ? (
            /* Fallback: legacy boolean win badges */
            <div className="flex flex-wrap gap-2">
              {majorWins.map(w => (
                <span key={w.key} className="badge-gold flex items-center gap-1">
                  🏆 {w.label}
                </span>
              ))}
              {(film.oscar_wins || 0) > majorWins.length && (
                <p className="text-xs text-gray-400 italic w-full mt-1">
                  + {film.oscar_wins - majorWins.length} additional win{film.oscar_wins - majorWins.length !== 1 ? 's' : ''} — detailed breakdown unavailable.
                </p>
              )}
            </div>
          ) : film.oscar_nominations > 0 ? (
            <p className="text-sm text-gray-400 italic">
              {film.oscar_wins > 0
                ? `${film.oscar_wins} win${film.oscar_wins !== 1 ? 's' : ''} — detailed breakdown unavailable.`
                : 'Nominated but did not win a tracked major category.'}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">No Oscar nominations on record.</p>
          )}
        </div>

        {/* Acclaim score + external lists */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-lg mb-0">Acclaim</h2>
            {isAuthenticated && !acclaimEditing && (
              <button
                onClick={startAcclaimEdit}
                className="text-xs text-gray-400 hover:text-gold-500 dark:hover:text-gold-400
                           transition-colors flex items-center gap-1"
                title="Edit acclaim score"
              >
                ✏️ {film.acclaim_score != null ? 'Edit score' : 'Set score'}
              </button>
            )}
          </div>

          {/* ── Acclaim Score Display / Edit ── */}
          {acclaimEditing ? (
            <div className="mb-4 pb-4 border-b border-stone-100 dark:border-night-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Agreed score out of 10 — set collaboratively by both players.
              </p>

              {/* Suggestion hint */}
              {suggestion && suggestion.factors.length > 0 && (
                <div className="mb-3 rounded-lg bg-stone-50 dark:bg-night-900/60
                                border border-stone-200 dark:border-night-600 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Algorithm suggests
                    </span>
                    <span className="text-lg font-bold text-gold-600 dark:text-gold-400 font-display">
                      {suggestion.score}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.factors.map((f, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full
                                               bg-stone-100 dark:bg-night-700
                                               text-gray-500 dark:text-gray-400
                                               border border-stone-200 dark:border-night-600">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Input row */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={acclaimValue}
                  onChange={e => setAcclaimValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveAcclaim()
                    if (e.key === 'Escape') cancelAcclaimEdit()
                  }}
                  placeholder="1–10"
                  className="w-20 px-3 py-1.5 text-center text-lg font-bold
                             rounded-lg border border-stone-300 dark:border-night-500
                             bg-white dark:bg-night-800
                             text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-gold-400"
                  autoFocus
                />
                <button
                  onClick={saveAcclaim}
                  disabled={acclaimSaving}
                  className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
                >
                  {acclaimSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={cancelAcclaimEdit}
                  disabled={acclaimSaving}
                  className="btn-ghost text-sm px-3 py-1.5"
                >
                  Cancel
                </button>
                {film.acclaim_score != null && (
                  <button
                    onClick={clearAcclaim}
                    disabled={acclaimSaving}
                    className="text-xs text-red-400 hover:text-red-500 transition-colors ml-auto"
                    title="Clear acclaim score"
                  >
                    Clear
                  </button>
                )}
              </div>
              {acclaimError && (
                <p className="text-xs text-red-400 mt-2">{acclaimError}</p>
              )}
            </div>
          ) : (
            <div className="mb-4 pb-4 border-b border-stone-100 dark:border-night-700">
              {film.acclaim_score != null ? (
                <div className="text-center">
                  <div className="text-3xl font-bold text-gold-600 dark:text-gold-400 font-display">
                    {film.acclaim_score}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Acclaim Score</div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-400 italic">No acclaim score set.</p>
                  {suggestion && suggestion.factors.length > 0 && (
                    <span className="text-xs text-gray-500">
                      (algorithm suggests {suggestion.score})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* External list appearances */}
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
                          <span className="font-display font-bold text-xl text-gray-900 dark:text-white">{yr}</span>
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
                          <span className="flex items-center justify-center gap-1">
                            <span className="font-bold text-xl text-gray-900 dark:text-white">#{dRow.rank}</span>
                            <RankMovement from={dPrev} to={dRow.rank} />
                          </span>
                        ) : <span className="text-sm text-gray-400 italic">NR</span>}
                      </td>
                      <td className="table-cell text-center">
                        {mRow ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="font-bold text-xl text-gray-900 dark:text-white">#{mRow.rank}</span>
                            <RankMovement from={mPrev} to={mRow.rank} />
                          </span>
                        ) : <span className="text-sm text-gray-400 italic">NR</span>}
                      </td>
                      <td className="table-cell text-center">
                        {cRow ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="font-bold text-xl text-gray-900 dark:text-white">#{cRow.combined_rank}</span>
                            <RankMovement from={cPrev} to={cRow.combined_rank} />
                          </span>
                        ) : <span className="text-sm text-gray-400 italic">NR</span>}
                      </td>
                      <td className="table-cell text-center hidden sm:table-cell">
                        {cRow
                          ? <span className="text-base font-bold text-gray-900 dark:text-white">{cRow.total_score}</span>
                          : <span className="text-sm text-gray-400 italic">—</span>}
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
                tick={{ fontSize: 15, fill: 'currentColor', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                reversed
                tick={{ fontSize: 14, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `#${v}`}
                width={42}
              />
              <Tooltip content={<RankTooltip />} />
              <Legend
                iconType="circle"
                iconSize={10}
                wrapperStyle={{ fontSize: 14, paddingTop: 10 }}
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
              All scores out of 10 except Personal Impact which is out of 20
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-44">Category</th>
                  {EVENTS.map(yr => (
                    dustinRows[yr] && (
                      <th key={`d-${yr}`}
                        className="table-header text-center"
                        style={{ color: DC }}
                      >
                        Dust {yr}
                      </th>
                    )
                  ))}
                  {EVENTS.map(yr => (
                    mattRows[yr] && (
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
                        <span className="text-base font-medium text-gray-700 dark:text-gray-300">
                          {cat.label}
                        </span>
                        {cat.note && (
                          <span className="block text-xs text-gray-400">{cat.note}</span>
                        )}
                      </td>
                      {/* Dustin columns */}
                      {EVENTS.map(yr => {
                        if (!dustinRows[yr]) return null
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
                        if (!mattRows[yr]) return null
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
                  <td className="table-cell text-base font-bold text-gray-900 dark:text-white">
                    Total Score
                  </td>
                  {EVENTS.map(yr => {
                    if (!dustinRows[yr]) return null
                    return (
                      <td key={`d-total-${yr}`} className="table-cell text-center">
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          {dustinRows[yr]?.total_score ?? '—'}
                        </span>
                      </td>
                    )
                  })}
                  {EVENTS.map(yr => {
                    if (!mattRows[yr]) return null
                    return (
                      <td key={`m-total-${yr}`} className="table-cell text-center">
                        <span className="text-base font-bold text-gray-900 dark:text-white">
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
