import { useState, useEffect } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { fetchFilmById, searchFilmByTitle } from '../../lib/omdb'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import FilmStill from '../../components/FilmStill'
import { DC, HC, CC, sortTitle } from '../../lib/helpers'
import { useEventState } from '../../lib/useEventState'
import { hydrateAcclaim } from '../../lib/acclaimLists'

// ── constants ───────────────────────────────────────────────────────────────
const EVENTS = [2001, 2007, 2016, 2026]

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
  { key: 'afi_top100_rank',        label: 'AFI Top 100',           ranked: true  },
  { key: 'afi_comedies_rank',      label: 'AFI Top 100 Comedies',  ranked: true  },
  { key: 'imdb_top250_rank',       label: 'IMDB Top 250',          ranked: true  },
  { key: 'nyt_2000s_rank',         label: 'NYT Best of 2000s',     ranked: true  },
  { key: 'sight_sound_2022_rank',  label: "Sight & Sound '22",     ranked: true  },
  { key: 'variety_comedies_rank',  label: 'Variety Comedies',      ranked: true  },
  { key: 'national_film_registry', label: 'National Film Registry', ranked: false },
]

const OSCAR_WINS = [
  { key: 'won_best_picture',       label: 'Best Picture'        },
  { key: 'won_best_director',      label: 'Best Director'       },
  { key: 'won_best_actor',         label: 'Best Actor'          },
  { key: 'won_best_actress',       label: 'Best Actress'        },
  { key: 'won_best_supp_actor',    label: 'Best Supp. Actor'    },
  { key: 'won_best_supp_actress',  label: 'Best Supp. Actress'  },
  { key: 'won_screenplay',         label: 'Best Screenplay'     },
  { key: 'won_cinematography',     label: 'Best Cinematography' },
  { key: 'won_production_design',  label: 'Best Prod. Design'   },
]

// ── helpers ─────────────────────────────────────────────────────────────────
function ScoreCell({ value, max = 10 }) {
  if (value == null) return <span className="text-base text-gray-600">—</span>
  const color = value >= 8 ? 'text-emerald-400'
              : value >= 4 ? 'text-yellow-400'
              : 'text-red-400'
  return <span className={`font-mono text-lg font-semibold ${color}`}>{value}</span>
}

function RankMovement({ from, to }) {
  if (from == null || to == null) return null
  const diff = from - to
  if (diff > 0) return <span className="text-xs rank-up ml-1 font-mono">↑{diff}</span>
  if (diff < 0) return <span className="text-xs rank-down ml-1 font-mono">↓{Math.abs(diff)}</span>
  return <span className="text-xs rank-same ml-1 font-mono">●</span>
}

function RankTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card-panel px-3 py-2 text-xs">
      <div className="font-mono text-[11px] tracking-kicker text-white mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-mono font-semibold text-white">
            {p.value != null ? `#${p.value}` : 'NR'}
          </span>
        </div>
      ))}
    </div>
  )
}

function suggestAcclaim(film) {
  if (!film) return null
  let pts = 0
  const factors = []
  if (film.sight_sound_2022_rank != null) {
    if (film.sight_sound_2022_rank <= 10)      { pts += 3.5; factors.push(`Sight & Sound Top 10 (#${film.sight_sound_2022_rank})`) }
    else if (film.sight_sound_2022_rank <= 100){ pts += 2.5; factors.push(`Sight & Sound Top 100 (#${film.sight_sound_2022_rank})`) }
    else                                       { pts += 1.5; factors.push(`Sight & Sound 2022 listed (#${film.sight_sound_2022_rank})`) }
  }
  if (film.afi_top100_rank != null) {
    if (film.afi_top100_rank <= 25) { pts += 2.5; factors.push(`AFI Top 25 (#${film.afi_top100_rank})`) }
    else                            { pts += 1.5; factors.push(`AFI Top 100 (#${film.afi_top100_rank})`) }
  }
  if (film.won_best_picture) { pts += 2.5; factors.push('Won Best Picture') }
  const prestiWins = ['won_best_director','won_best_actor','won_best_actress','won_screenplay','won_cinematography']
    .filter(k => film[k])
  if (prestiWins.length > 0) {
    const boost = Math.min(prestiWins.length * 0.5, 1.5)
    pts += boost
    factors.push(`${prestiWins.length} major Oscar win${prestiWins.length > 1 ? 's' : ''}`)
  }
  const noms = film.oscar_nominations || 0
  if (!film.won_best_picture && noms >= 10)     { pts += 1.5; factors.push(`${noms} Oscar nominations`) }
  else if (!film.won_best_picture && noms >= 5) { pts += 0.75; factors.push(`${noms} Oscar nominations`) }
  else if (!film.won_best_picture && noms >= 2) { pts += 0.25 }
  if (film.imdb_top250_rank != null) {
    if (film.imdb_top250_rank <= 25)      { pts += 1.5; factors.push(`IMDB Top 25 (#${film.imdb_top250_rank})`) }
    else if (film.imdb_top250_rank <= 100){ pts += 1.0; factors.push(`IMDB Top 100 (#${film.imdb_top250_rank})`) }
    else                                  { pts += 0.5; factors.push(`IMDB Top 250 (#${film.imdb_top250_rank})`) }
  }
  if (film.national_film_registry) { pts += 0.5; factors.push('National Film Registry') }
  if (film.nyt_2000s_rank != null)       { pts += 0.25; factors.push(`NYT 2000s (#${film.nyt_2000s_rank})`) }
  if (film.afi_comedies_rank != null)    { pts += 0.25; factors.push(`AFI Comedies (#${film.afi_comedies_rank})`) }
  if (film.variety_comedies_rank != null){ pts += 0.25; factors.push(`Variety Comedies (#${film.variety_comedies_rank})`) }
  const score = Math.min(10, Math.max(1, Math.round(2 + pts * 0.8)))
  return { score, factors }
}

function OscarNomsList({ noms }) {
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
        const sorted = [...byYear[yr]].sort((a, b) => {
          if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1
          const catCmp = a.category_name.localeCompare(b.category_name)
          if (catCmp !== 0) return catCmp
          return (a.nominee_name || '').localeCompare(b.nominee_name || '')
        })
        return (
          <div key={yr}>
            {!singleYear && yr !== 'unknown' && (
              <p className="kicker-dim mb-2">{yr} ACADEMY AWARDS</p>
            )}
            <div className="flex flex-wrap gap-2">
              {sorted.map((nom, i) => {
                const label = nom.nominee_name ? `${nom.category_name} — ${nom.nominee_name}` : nom.category_name
                return nom.is_winner ? (
                  <span key={`${nom.category_name}-${nom.nominee_name ?? ''}-${i}`}
                        className="badge-gold flex items-center gap-1 text-sm">
                    🏆 {label}
                  </span>
                ) : (
                  <span key={`${nom.category_name}-${nom.nominee_name ?? ''}-${i}`}
                        className="text-sm text-gray-400 px-2.5 py-0.5 rounded-full border border-night-600 bg-night-800">
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── main component ──────────────────────────────────────────────────────────
export default function MovieDetail() {
  const { blackout } = useEventState()
  const { filmId } = useParams()
  const location   = useLocation()
  const navigate   = useNavigate()
  const { isAuthenticated, isDustin, session } = useAuth()

  const [film,       setFilm]       = useState(null)
  const [events,     setEvents]     = useState([])
  const [dustinRows, setDustinRows] = useState({})
  const [mattRows,   setMattRows]   = useState({})
  const [combined,   setCombined]   = useState({})
  const [oscarNoms,  setOscarNoms]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const [acclaimEditing, setAcclaimEditing] = useState(false)
  const [acclaimValue,   setAcclaimValue]   = useState('')
  const [acclaimSaving,  setAcclaimSaving]  = useState(false)
  const [acclaimError,   setAcclaimError]   = useState(null)

  const [omdbRefreshing, setOmdbRefreshing] = useState(false)
  const [omdbStatus,     setOmdbStatus]     = useState(null)
  const [omdbOverrideId, setOmdbOverrideId] = useState('')
  const [fixInfoOpen,    setFixInfoOpen]    = useState(false)

  const [onWatchlist,      setOnWatchlist]      = useState(false)
  const [watchlistId,      setWatchlistId]      = useState(null)
  const [watchlistLoading, setWatchlistLoading] = useState(false)

  const [directorFilms, setDirectorFilms] = useState([])
  const [yearPeers,     setYearPeers]     = useState([])

  useEffect(() => { if (filmId) fetchAll(Number(filmId)) }, [filmId])

  useEffect(() => {
    if (!film) return
    async function fetchPeers() {
      const FIELDS = 'id, title, release_year, combined_rankings(combined_rank, ranking_events(year)), individual_rankings(rank, profiles(username), ranking_events(year))'
      const latestOf = (rows) =>
        (rows || []).filter(r => r.ranking_events?.year)
          .sort((a, b) => b.ranking_events.year - a.ranking_events.year)[0]
      const withRanks = rows =>
        (rows || []).map(f => ({
          ...f,
          latestRank: latestOf(f.combined_rankings)?.combined_rank,
          dustRank:   latestOf(f.individual_rankings?.filter(r => r.profiles?.username === 'dustin'))?.rank,
          hermzRank:  latestOf(f.individual_rankings?.filter(r => r.profiles?.username === 'matt'))?.rank,
        })).sort((a, b) => (a.latestRank ?? 9999) - (b.latestRank ?? 9999))

      const [dirRes, yearRes] = await Promise.all([
        film.director
          ? supabase.from('films').select(FIELDS)
              .eq('director', film.director).neq('id', film.id).order('release_year')
          : Promise.resolve({ data: [] }),
        film.release_year
          ? supabase.from('films').select(FIELDS)
              .eq('release_year', film.release_year).neq('id', film.id).order('title')
          : Promise.resolve({ data: [] }),
      ])
      setDirectorFilms(withRanks(dirRes.data))
      setYearPeers(withRanks(yearRes.data))
    }
    fetchPeers()
  }, [film?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || !filmId) return
    async function checkWatchlist() {
      const { data } = await supabase.from('watchlist')
        .select('id').eq('user_id', userId).eq('film_id', filmId).maybeSingle()
      if (data) { setOnWatchlist(true); setWatchlistId(data.id) }
    }
    checkWatchlist()
  }, [filmId, session])

  async function fetchAll(id) {
    setLoading(true); setError(null)
    try {
      const [
        { data: filmData, error: fe },
        { data: evData,   error: ee },
        { data: indData,  error: ie },
        { data: combData, error: ce },
        { data: nomData },
      ] = await Promise.all([
        supabase.from('films').select('*').eq('id', id).single(),
        supabase.from('ranking_events').select('id,year,label').eq('status', 'published').order('year'),
        supabase.from('individual_rankings').select(`*, profiles(username), ranking_events(year)`).eq('film_id', id),
        supabase.from('combined_rankings').select(`*, ranking_events(year)`).eq('film_id', id),
        supabase.from('film_oscar_noms').select('*').eq('film_id', id).order('is_winner', { ascending: false }).order('category_name'),
      ])
      if (fe) throw fe; if (ee) throw ee; if (ie) throw ie; if (ce) throw ce

      // list membership comes from external_list_entries (single source), not the
      // legacy denormalized columns — so the Acclaim panel can never drift again
      setFilm(await hydrateAcclaim(filmData))
      setEvents(evData || [])
      setOscarNoms(nomData || [])

      const dRows = {}, mRows = {}
      ;(indData || []).forEach(r => {
        const yr = r.ranking_events?.year
        if (!yr) return
        if (r.profiles?.username === 'dustin') dRows[yr] = r
        if (r.profiles?.username === 'matt')   mRows[yr] = r
      })
      setDustinRows(dRows); setMattRows(mRows)

      const cRows = {}
      ;(combData || []).forEach(r => { if (r.ranking_events?.year) cRows[r.ranking_events.year] = r })
      setCombined(cRows)
    } catch (e) {
      setError(e.message || 'Failed to load film')
    } finally {
      setLoading(false)
    }
  }

  // ── acclaim handlers (unchanged) ───────────────────────────────────────
  function startAcclaimEdit() {
    setAcclaimValue(film?.acclaim_score != null ? String(film.acclaim_score) : '')
    setAcclaimError(null); setAcclaimEditing(true)
  }
  function cancelAcclaimEdit() { setAcclaimEditing(false); setAcclaimError(null) }
  async function saveAcclaim() {
    const parsed = parseInt(acclaimValue, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 10) { setAcclaimError('Enter a number from 1 to 10'); return }
    setAcclaimSaving(true); setAcclaimError(null)
    const { error: saveErr } = await supabase.from('films').update({ acclaim_score: parsed }).eq('id', film.id)
    if (saveErr) { setAcclaimError(saveErr.message); setAcclaimSaving(false); return }
    setFilm(f => ({ ...f, acclaim_score: parsed }))
    setAcclaimEditing(false); setAcclaimSaving(false)
  }
  async function clearAcclaim() {
    setAcclaimSaving(true)
    const { error: saveErr } = await supabase.from('films').update({ acclaim_score: null }).eq('id', film.id)
    if (!saveErr) setFilm(f => ({ ...f, acclaim_score: null }))
    setAcclaimEditing(false); setAcclaimSaving(false)
  }

  async function refreshOmdb() {
    if (!film) return
    setOmdbRefreshing(true); setOmdbStatus(null)
    try {
      const { data: freshFilm } = await supabase.from('films')
        .select('id, title, release_year, omdb_id').eq('id', film.id).single()
      const lookupId    = omdbOverrideId.trim() || freshFilm?.omdb_id || film.omdb_id
      const lookupTitle = freshFilm?.title        ?? film.title
      const lookupYear  = freshFilm?.release_year ?? film.release_year
      const omdbData = lookupId
        ? await fetchFilmById(lookupId)
        : await searchFilmByTitle(lookupTitle, lookupYear)
      const update = {
        omdb_id: omdbData.omdbId, poster_url: omdbData.posterUrl, omdb_genres: omdbData.genres,
        director: omdbData.director ?? film.director,
        omdb_fetched_at: new Date().toISOString(),
        actor_1: omdbData.actors[0] ?? null, actor_2: omdbData.actors[1] ?? null,
        actor_3: omdbData.actors[2] ?? null, actor_4: omdbData.actors[3] ?? null, actor_5: omdbData.actors[4] ?? null,
      }
      const { error: saveErr } = await supabase.from('films').update(update).eq('id', film.id)
      if (saveErr) throw saveErr
      setFilm(f => ({ ...f, ...update }))
      setOmdbStatus('ok')
      setTimeout(() => setOmdbStatus(null), 3000)
    } catch (e) {
      console.error('OMDB refresh failed:', e); setOmdbStatus('error')
      setTimeout(() => setOmdbStatus(null), 5000)
    } finally {
      setOmdbRefreshing(false)
    }
  }

  async function handleWatchlistToggle() {
    const userId = session?.user?.id
    if (!userId || !film || watchlistLoading) return
    setWatchlistLoading(true)
    if (onWatchlist && watchlistId) {
      const { error } = await supabase.from('watchlist').delete().eq('id', watchlistId)
      if (!error) { setOnWatchlist(false); setWatchlistId(null) }
    } else {
      const entry = {
        user_id: userId, title: film.title,
        year: film.release_year ? String(film.release_year) : null,
        poster_url: film.poster_url ?? null, imdb_id: film.omdb_id ?? null, film_id: film.id,
      }
      const { data, error } = await supabase.from('watchlist').insert(entry).select().single()
      if (!error && data) { setOnWatchlist(true); setWatchlistId(data.id) }
    }
    setWatchlistLoading(false)
  }

  // ── derived ─────────────────────────────────────────────────────────────
  const appearsIn = EVENTS.filter(yr => dustinRows[yr] || mattRows[yr] || combined[yr])
  const genres = film?.omdb_genres ? film.omdb_genres.split(',').map(g => g.trim()).filter(Boolean) : []
  const actors = [film?.actor_1, film?.actor_2, film?.actor_3, film?.actor_4, film?.actor_5,
                  film?.actor_6, film?.actor_7, film?.actor_8, film?.actor_9, film?.actor_10].filter(Boolean)
  const majorWins = OSCAR_WINS.filter(w => film?.[w.key])
  const acclaimHits = ACCLAIM_LISTS.filter(a => a.ranked ? film?.[a.key] != null : film?.[a.key])
  const suggestion = film ? suggestAcclaim(film) : null
  const latestYear = [...EVENTS].reverse().find(yr => dustinRows[yr] || mattRows[yr] || combined[yr])
  const chartData = EVENTS.map(yr => ({
    year: String(yr),
    Dustin:   dustinRows[yr]?.rank   ?? null,
    Hermz:    mattRows[yr]?.rank     ?? null,
    Combined: combined[yr]?.combined_rank ?? null,
  }))
  const activeCats = SCORE_CATS.filter(cat => {
    if (cat.years === 'all') return true
    return cat.years.some(yr => dustinRows[yr]?.[cat.key] != null || mattRows[yr]?.[cat.key] != null)
  })

  // ── render states ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING FILM…</span>
    </div>
  )
  if (error || !film) return (
    <div className="max-w-5xl mx-auto px-4 py-16 text-center">
      <p className="text-red-400 text-sm mb-4">{error || 'Film not found.'}</p>
      <Link to="/movies/list" className="btn-ghost text-sm">← Back to Rankings</Link>
    </div>
  )

  // ── main render ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <FilmStill title={film.title}
                 className="w-full h-[400px] sm:h-[340px]">
        <div className="absolute inset-0 scrim-bottom" />

        {/* Top: back link + admin */}
        <div className="absolute top-6 left-6 right-6 sm:left-10 sm:right-10 flex items-start justify-between z-10">
          <button onClick={() => navigate(-1)}
                  className="font-mono text-[11px] tracking-kicker text-gray-400 hover:text-white transition-colors">
            ← BACK
          </button>
          <div className="flex flex-col items-end gap-2">
            {isDustin && (
              <>
                <button onClick={() => { setFixInfoOpen(o => !o); setOmdbStatus(null) }}
                        className="font-mono text-[11px] tracking-kicker text-gray-400 hover:text-film-400 transition-colors">
                  🔧 {fixInfoOpen ? 'CLOSE' : 'FIX INFO'}
                </button>
                {fixInfoOpen && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-night-950/80 backdrop-blur-md border border-white/[0.1]">
                    <input type="text" value={omdbOverrideId} onChange={e => setOmdbOverrideId(e.target.value)}
                           placeholder="IMDb ID override (tt0000000)"
                           className="input text-xs px-2.5 py-1.5 w-56" />
                    <button onClick={refreshOmdb} disabled={omdbRefreshing}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                              omdbStatus === 'ok' ? 'bg-emerald-500 text-night-950' :
                              omdbStatus === 'error' ? 'bg-red-500 text-white' :
                              'bg-film-500 text-night-950 hover:bg-film-400'
                            } disabled:opacity-50`}>
                      {omdbRefreshing ? '↻ Refreshing…' :
                       omdbStatus === 'ok' ? '✓ Updated' :
                       omdbStatus === 'error' ? '✕ Failed' : '↻ Refresh OMDB'}
                    </button>
                  </div>
                )}
              </>
            )}
            {isAuthenticated && (
              <button onClick={handleWatchlistToggle} disabled={watchlistLoading}
                      className={`font-mono text-[11px] tracking-kicker flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                        onWatchlist
                          ? 'text-cinema-400 hover:text-cinema-300'
                          : 'text-gray-400 hover:text-cinema-400'
                      }`}>
                🔖 {watchlistLoading ? '…' : onWatchlist ? 'ON LIST' : 'WATCHLIST'}
              </button>
            )}
          </div>
        </div>

        {/* Bottom: title + meta + rank */}
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-5 sm:pb-7 z-10
                        flex flex-col md:flex-row md:items-end gap-4 sm:gap-8 md:gap-10">

          {/* Poster thumbnail */}
          {film.poster_url && (
            <div className="hidden md:block flex-shrink-0 self-end">
              <img
                src={film.poster_url}
                alt={`${film.title} poster`}
                className="w-[130px] h-[193px] object-cover rounded-lg border border-white/[0.15] shadow-still-lg"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white tracking-wide leading-[0.92]">
              {film.title?.toUpperCase()}
            </h1>
            <p className="font-sans text-base sm:text-xl text-gray-300 mt-2 sm:mt-3">
              {film.director && <>Directed by <span className="text-white">{film.director}</span> · </>}
              {film.release_year}
              {film.writer && <span className="text-gray-400"> · Written by {film.writer}</span>}
            </p>
            {genres.length > 0 && (
              <div className="hidden sm:flex flex-wrap gap-1.5 mt-4">
                {genres.map(g => (
                  <span key={g} className="font-mono text-[11px] tracking-kicker uppercase
                                           px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-gray-200">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Floating rank stats — hidden during scoring blackout */}
          {!blackout && (
            <div className="flex gap-4 items-center bg-night-950/70 backdrop-blur-md
                            border border-white/[0.12] rounded-2xl px-5 py-4 shadow-still-lg flex-shrink-0">
              <RankBig who="dustin"   rank={latestYear && dustinRows[latestYear]?.rank} />
              <span className="w-px h-14 bg-white/10" />
              <RankBig who="matt"     rank={latestYear && mattRows[latestYear]?.rank} />
              <span className="w-px h-14 bg-white/10" />
              <RankBig who="combined" rank={latestYear && combined[latestYear]?.combined_rank} />
            </div>
          )}
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-6">

        {/* Cast (if available) */}
        {actors.length > 0 && (
          <div className="card">
            <h2 className="font-display text-2xl text-white tracking-wide mb-4">CAST</h2>
            <div className="flex flex-wrap gap-2">
              {actors.map(a => (
                <span key={a} className="text-sm px-3 py-1 rounded-full bg-night-700/60 text-gray-200 border border-night-600">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Oscar history + Acclaim */}
        <div className="grid md:grid-cols-2 gap-5">

          {/* Oscars */}
          <div className="card">
            <h2 className="font-display text-2xl text-white tracking-wide mb-4">OSCAR HISTORY</h2>
            <div className="flex gap-6 mb-4">
              <div className="text-center">
                <div className="font-display text-3xl text-white leading-none">{film.oscar_nominations || 0}</div>
                <div className="kicker-dim mt-1">NOMINATION{film.oscar_nominations !== 1 ? 'S' : ''}</div>
              </div>
              <div className="text-center">
                <div className="font-display text-3xl text-gold-400 leading-none">{film.oscar_wins || 0}</div>
                <div className="kicker-dim mt-1">WIN{film.oscar_wins !== 1 ? 'S' : ''}</div>
              </div>
            </div>

            {oscarNoms.length > 0 ? (
              <>
                <OscarNomsList noms={oscarNoms} />
                {oscarNoms.length < (film.oscar_nominations || 0) && (
                  <p className="text-xs text-gray-500 mt-3">
                    Showing {oscarNoms.length} of {film.oscar_nominations} — some categories unavailable.
                  </p>
                )}
              </>
            ) : majorWins.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {majorWins.map(w => (
                  <span key={w.key} className="badge-gold flex items-center gap-1">🏆 {w.label}</span>
                ))}
              </div>
            ) : film.oscar_nominations > 0 ? (
              <p className="text-sm text-gray-500">Nominated but did not win a tracked category.</p>
            ) : (
              <p className="text-sm text-gray-500">No Oscar nominations on record.</p>
            )}
          </div>

          {/* Acclaim */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl text-white tracking-wide">ACCLAIM</h2>
              {isAuthenticated && !acclaimEditing && (
                <button onClick={startAcclaimEdit}
                        className="text-xs text-gray-400 hover:text-gold-400 transition-colors">
                  ✏️ {film.acclaim_score != null ? 'Edit score' : 'Set score'}
                </button>
              )}
            </div>

            {acclaimEditing ? (
              <div className="mb-4 pb-4 border-b border-night-700">
                <p className="text-xs text-gray-400 mb-2">Agreed score out of 10 — set collaboratively.</p>
                {suggestion && suggestion.factors.length > 0 && (
                  <div className="mb-3 rounded-lg bg-night-900/60 border border-night-600 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="kicker-dim">ALGORITHM SUGGESTS</span>
                      <span className="font-display text-2xl text-gold-400 leading-none">{suggestion.score}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.factors.map((f, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-night-700 text-gray-300 border border-night-600">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="10" value={acclaimValue}
                         onChange={e => setAcclaimValue(e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter') saveAcclaim(); if (e.key === 'Escape') cancelAcclaimEdit() }}
                         placeholder="1–10"
                         className="w-20 px-3 py-1.5 text-center text-lg font-bold input"
                         autoFocus />
                  <button onClick={saveAcclaim} disabled={acclaimSaving} className="btn-gold text-sm px-4 py-1.5 disabled:opacity-50">
                    {acclaimSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={cancelAcclaimEdit} disabled={acclaimSaving} className="btn-ghost text-sm px-3 py-1.5">
                    Cancel
                  </button>
                  {film.acclaim_score != null && (
                    <button onClick={clearAcclaim} disabled={acclaimSaving}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors ml-auto">
                      Clear
                    </button>
                  )}
                </div>
                {acclaimError && <p className="text-xs text-red-400 mt-2">{acclaimError}</p>}
              </div>
            ) : (
              <div className="mb-4 pb-4 border-b border-night-700">
                {film.acclaim_score != null ? (
                  <div className="text-center">
                    <div className="font-display text-4xl text-gold-400 leading-none">{film.acclaim_score}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-500">No acclaim score set.</p>
                    {suggestion && suggestion.factors.length > 0 && (
                      <span className="text-xs text-gray-500">(algorithm suggests {suggestion.score})</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {acclaimHits.length > 0 ? (
              <div className="space-y-2">
                {acclaimHits.map(a => (
                  <div key={a.key} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{a.label}</span>
                    {a.ranked
                      ? <span className="font-mono font-bold text-gold-400">#{film[a.key]}</span>
                      : <span className="badge-gold">Listed</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No tracked list appearances.</p>
            )}
          </div>
        </div>

        {/* Blackout notice (Phase 12d) */}
        {blackout && (
          <div className="card text-center py-8">
            <p className="font-sans text-sm text-gray-400">
              Ranking history is hidden while you're scoring — every film gets judged fresh.
              It returns when your list is locked.
            </p>
          </div>
        )}

        {/* Rank History Table */}
        {!blackout && appearsIn.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-night-700">
              <h2 className="font-display text-2xl text-white tracking-wide leading-none mb-1">RANK HISTORY</h2>
              <p className="text-sm text-gray-500">Ranking across all four editions — NR if not on that list.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Event</th>
                    <th className="table-header text-center" style={{ color: DC }}>Dust</th>
                    <th className="table-header text-center" style={{ color: HC }}>Hermz</th>
                    <th className="table-header text-center">Combined</th>
                    <th className="table-header text-center hidden sm:table-cell">Combined Score</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map((yr, i) => {
                    const dRow = dustinRows[yr], mRow = mattRows[yr], cRow = combined[yr]
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
                            <span className="font-display text-xl text-white tracking-wide">{yr}</span>
                            {isDropOff && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-night-700 text-gray-500 font-mono">off list</span>
                            )}
                            {onAny && !dPrev && i > 0 && (
                              <span className="badge-gold text-xs">NEW</span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell text-center">
                          {dRow ? (
                            <span className="inline-flex items-center justify-center gap-1">
                              <span className="font-mono font-bold text-xl text-white">#{dRow.rank}</span>
                              <RankMovement from={dPrev} to={dRow.rank} />
                            </span>
                          ) : <span className="text-sm text-gray-500">NR</span>}
                        </td>
                        <td className="table-cell text-center">
                          {mRow ? (
                            <span className="inline-flex items-center justify-center gap-1">
                              <span className="font-mono font-bold text-xl text-white">#{mRow.rank}</span>
                              <RankMovement from={mPrev} to={mRow.rank} />
                            </span>
                          ) : <span className="text-sm text-gray-500">NR</span>}
                        </td>
                        <td className="table-cell text-center">
                          {cRow ? (
                            <span className="inline-flex items-center justify-center gap-1">
                              <span className="font-mono font-bold text-xl" style={{ color: CC }}>#{cRow.combined_rank}</span>
                              <RankMovement from={cPrev} to={cRow.combined_rank} />
                            </span>
                          ) : <span className="text-sm text-gray-500">NR</span>}
                        </td>
                        <td className="table-cell text-center hidden sm:table-cell">
                          {cRow ? <span className="font-mono font-bold text-white">{cRow.total_score}</span> : <span className="text-sm text-gray-500">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rank Movement Chart */}
        {!blackout && appearsIn.length > 1 && (
          <div className="card">
            <h2 className="font-display text-2xl text-white tracking-wide leading-none mb-1">RANK MOVEMENT</h2>
            <p className="text-sm text-gray-500 mb-5">Personal and combined rank across editions (lower = better).</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="year" tick={{ fontSize: 13, fill: '#9298A6', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis reversed tick={{ fontSize: 12, fill: '#9298A6' }} axisLine={false} tickLine={false}
                       tickFormatter={v => `#${v}`} width={42} />
                <Tooltip content={<RankTooltip />} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, paddingTop: 10, color: '#9298A6' }} />
                <Line type="monotone" dataKey="Dustin"   stroke={DC} strokeWidth={2}   dot={{ r: 4, fill: DC }} activeDot={{ r: 6 }} connectNulls={false} />
                <Line type="monotone" dataKey="Hermz"    stroke={HC} strokeWidth={2}   dot={{ r: 4, fill: HC }} activeDot={{ r: 6 }} connectNulls={false} />
                <Line type="monotone" dataKey="Combined" stroke={CC} strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 4, fill: CC }} activeDot={{ r: 6 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Score History — chart / table toggle */}
        {!blackout && appearsIn.length > 0 && (
          <ScoreSection dustinRows={dustinRows} mattRows={mattRows} activeCats={activeCats} />
        )}

        {/* Fun Facts */}
        {!blackout && (
          <FunFacts film={film} dustinRows={dustinRows} mattRows={mattRows}
                    combined={combined} oscarNoms={oscarNoms} />
        )}

        {/* Director & Year Peers */}
        {!blackout && (
          <FilmPeers film={film} directorFilms={directorFilms} yearPeers={yearPeers} />
        )}

        {!blackout && appearsIn.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-gray-500 text-sm">This film has not appeared on any ranking list.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PeerStrip ───────────────────────────────────────────────────────────────
function PeerStrip({ kicker, title, films }) {
  if (films.length === 0) return null
  return (
    <div className="card">
      <p className="kicker-dim mb-1">{kicker}</p>
      <h2 className="font-display text-2xl text-white tracking-wide mb-4">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {films.map(f => (
          <Link key={f.id} to={`/movies/${f.id}`}
                className="flex flex-col px-3 py-2.5 rounded-lg bg-night-800/60 border border-night-600
                           hover:border-night-500 hover:bg-night-700/60 transition-all group min-w-[140px]">
            <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors mb-0.5">{f.title}</div>
            <div className="font-mono text-[11px] text-gray-500 mb-2">{f.release_year}</div>
            <div className="flex gap-3">
              <div className="text-center">
                <div className="font-mono text-xs font-semibold" style={{ color: DC }}>
                  {f.dustRank != null ? `#${f.dustRank}` : <span className="text-gray-700">NR</span>}
                </div>
                <div className="font-mono text-[11px] text-gray-600 mt-0.5">DUST</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xs font-semibold" style={{ color: HC }}>
                  {f.hermzRank != null ? `#${f.hermzRank}` : <span className="text-gray-700">NR</span>}
                </div>
                <div className="font-mono text-[11px] text-gray-600 mt-0.5">HERMZ</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xs font-semibold text-gray-300">
                  {f.latestRank != null ? `#${f.latestRank}` : <span className="text-gray-700">NR</span>}
                </div>
                <div className="font-mono text-[11px] text-gray-600 mt-0.5">CMB</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── FunFacts ─────────────────────────────────────────────────────────────────
function PeerTile({ f }) {
  return (
    <Link to={`/movies/${f.id}`}
          className="flex flex-col px-4 py-3 rounded-lg bg-night-800/60 border border-night-600
                     hover:border-night-500 hover:bg-night-700/60 transition-all group min-w-[160px]">
      <div className="text-base font-medium text-gray-200 group-hover:text-white transition-colors mb-1 leading-snug">{f.title}</div>
      <div className="font-mono text-xs text-gray-500 mb-3">{f.release_year}</div>
      <div className="flex gap-4">
        <div className="text-center">
          <div className="font-mono text-sm font-semibold" style={{ color: DC }}>
            {f.dustRank != null ? `#${f.dustRank}` : <span className="text-gray-700">NR</span>}
          </div>
          <div className="font-mono text-[11px] text-gray-600 mt-0.5">DUST</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-sm font-semibold" style={{ color: HC }}>
            {f.hermzRank != null ? `#${f.hermzRank}` : <span className="text-gray-700">NR</span>}
          </div>
          <div className="font-mono text-[11px] text-gray-600 mt-0.5">HERMZ</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-sm font-semibold text-gray-300">
            {f.latestRank != null ? `#${f.latestRank}` : <span className="text-gray-700">NR</span>}
          </div>
          <div className="font-mono text-[11px] text-gray-600 mt-0.5">CMB</div>
        </div>
      </div>
    </Link>
  )
}


function generateInsights(film, dustinRows, mattRows, combined, oscarNoms) {
  const insights    = []
  const LATEST      = EVENTS[EVENTS.length - 1]
  const PRIOR       = EVENTS.slice(0, -1)
  const dustYears   = EVENTS.filter(yr => dustinRows[yr]?.rank)
  const mattYears   = EVENTS.filter(yr => mattRows[yr]?.rank)
  const sharedYears = EVENTS.filter(yr => dustinRows[yr]?.rank && mattRows[yr]?.rank)
  const anyYears    = EVENTS.filter(yr => dustinRows[yr]?.rank || mattRows[yr]?.rank)
  const combYears   = EVENTS.filter(yr => combined[yr]?.combined_rank)
  const firstAny    = anyYears[0]
  const latestShared = sharedYears[sharedYears.length - 1]
  const dCurrent    = dustinRows[LATEST]?.rank ?? null
  const mCurrent    = mattRows[LATEST]?.rank   ?? null
  const cCurrent    = combined[LATEST]?.combined_rank ?? null
  // Events for which the film actually existed
  const eligibleEvents = EVENTS.filter(yr => !film?.release_year || film.release_year <= yr)

  // ── Current #1 ───────────────────────────────────────────────────────────────
  if (dCurrent === 1 && mCurrent === 1) {
    insights.push({ p: 10, text: `Both Dust and Hermz have this as their #1 film in ${LATEST} — the same film at the very top of two completely independent lists. That essentially never happens.` })
  } else if (dCurrent === 1) {
    insights.push({ p: 10, text: `Dust's #1 film in ${LATEST}. Out of 125 ranked films, this is the one he places above everything else.` })
  } else if (mCurrent === 1) {
    insights.push({ p: 10, text: `Hermz's #1 film in ${LATEST}. Out of 125 ranked films, this is the one he places above everything else.` })
  }
  if (cCurrent === 1) {
    insights.push({ p: 9, text: `The #1 film on the combined list in ${LATEST}. The aggregate of both personal rankings puts this at the very top of the shared canon.` })
  }

  // ── Former #1 ─────────────────────────────────────────────────────────────────
  const dustPriorTop = PRIOR.filter(yr => dustinRows[yr]?.rank === 1)
  const mattPriorTop = PRIOR.filter(yr => mattRows[yr]?.rank === 1)
  const combPriorTop = PRIOR.filter(yr => combined[yr]?.combined_rank === 1)
  if (dustPriorTop.length > 0 && dCurrent !== 1) {
    const yr = dustPriorTop[dustPriorTop.length - 1]
    const now = dCurrent ? ` It now sits at #${dCurrent} on his list.` : ` It has since dropped off his list entirely.`
    insights.push({ p: 9, text: `A former #1 on Dust's list. In ${yr}, this was the film he placed above all others.${now} Films that slip from the top rarely fully lose that gravity.` })
  }
  if (mattPriorTop.length > 0 && mCurrent !== 1) {
    const yr = mattPriorTop[mattPriorTop.length - 1]
    const now = mCurrent ? ` It now sits at #${mCurrent} on his list.` : ` It has since dropped off his list entirely.`
    insights.push({ p: 9, text: `A former #1 on Hermz's list. In ${yr}, this was the film he placed above all others.${now} Films that slip from the top rarely fully lose that gravity.` })
  }
  if (combPriorTop.length > 0 && cCurrent !== 1) {
    const yr = combPriorTop[combPriorTop.length - 1]
    const now = cCurrent ? ` It's now ranked #${cCurrent} on the combined list.` : ` It has since dropped off the combined list entirely.`
    insights.push({ p: 8, text: `Once the #1 film on the combined list — in ${yr}, both personal rankings converged enough to put this at the very top.${now}` })
  }

  // ── Top 5 on both lists (not already caught by #1) ───────────────────────────
  const dTop5 = dCurrent != null && dCurrent <= 5 && dCurrent > 1
  const mTop5 = mCurrent != null && mCurrent <= 5 && mCurrent > 1
  if (dTop5 && mTop5) {
    insights.push({ p: 8, text: `Elite placement on both lists in ${LATEST} — Dust's #${dCurrent} and Hermz's #${mCurrent}. The top five on any personal list is where a film moves from "great" to "defining."` })
  } else if (dTop5) {
    insights.push({ p: 5, text: `In Dust's top five in ${LATEST} at #${dCurrent} — a position reserved for films that have genuinely shaped how he thinks about cinema.` })
  } else if (mTop5) {
    insights.push({ p: 5, text: `In Hermz's top five in ${LATEST} at #${mCurrent} — a position reserved for films that have genuinely shaped how he thinks about cinema.` })
  }

  // ── All-events consistency ─────────────────────────────────────────────────────
  const dustAll = eligibleEvents.length >= 2 && eligibleEvents.every(yr => dustinRows[yr]?.rank)
  const mattAll = eligibleEvents.length >= 2 && eligibleEvents.every(yr => mattRows[yr]?.rank)
  if (dustAll || mattAll) {
    const evtList = eligibleEvents.length === 1 ? String(eligibleEvents[0])
      : `${eligibleEvents.slice(0, -1).join(', ')}, and ${eligibleEvents[eligibleEvents.length - 1]}`
    const span = eligibleEvents.length === 4 ? '25 years' : eligibleEvents.length === 3 ? 'three editions' : 'both editions'
    if (dustAll && mattAll) {
      insights.push({ p: 8, text: `On both Dust's and Hermz's lists in every eligible event — ${evtList}. Very few films survive ${span} of re-evaluation and make both personal lists every time.` })
    } else if (dustAll) {
      insights.push({ p: 6, text: `On Dust's list in every eligible event — ${evtList}. That's ${span} of consistent inclusion, which puts it in a very small group.` })
    } else {
      insights.push({ p: 6, text: `On Hermz's list in every eligible event — ${evtList}. That's ${span} of consistent inclusion, which puts it in a very small group.` })
    }
  }

  // ── Dropped off / returned ─────────────────────────────────────────────────────
  const dustPat = EVENTS.map(yr => dustinRows[yr]?.rank != null)
  const mattPat = EVENTS.map(yr => mattRows[yr]?.rank != null)

  const checkReturnOrDrop = (pat, rows, yrs, name) => {
    let dropYr = null, returnYr = null
    for (let i = 1; i < EVENTS.length; i++) {
      if (pat[i-1] && !pat[i] && dropYr === null) dropYr = EVENTS[i]
      if (!pat[i-1] && pat[i] && dropYr !== null && returnYr === null) returnYr = EVENTS[i]
    }
    if (dropYr && returnYr) {
      return { p: 7, text: `This film fell off ${name}'s list in ${dropYr} but returned in ${returnYr} at #${rows[returnYr].rank}. Films that come back after an absence usually mean something different — time changed the relationship.` }
    }
    const hadAndLost = pat.some((on, i) => i > 0 && pat[i-1] && !on)
    const everReturned = pat.some((on, i) => i > 1 && on && !pat[i-1] && pat.slice(0, i-1).some(Boolean))
    if (hadAndLost && !everReturned && yrs.length > 0) {
      const lastYr = yrs[yrs.length - 1]
      if (EVENTS.indexOf(lastYr) < EVENTS.length - 1) {
        return { p: 5, text: `Appeared on ${name}'s list as recently as ${lastYr} — ranked #${rows[lastYr].rank} — but has since dropped off entirely. Films that exit a personal canon after years of inclusion tend to reflect a genuine shift in what the ranker values.` }
      }
    }
    return null
  }
  const dDrop = checkReturnOrDrop(dustPat, dustinRows, dustYears, 'Dust')
  const mDrop = checkReturnOrDrop(mattPat, mattRows, mattYears, 'Hermz')
  if (dDrop) insights.push(dDrop)
  if (mDrop) insights.push(mDrop)

  // ── New peak in latest event ───────────────────────────────────────────────────
  if (dustYears.length > 1 && dCurrent != null && dustYears.includes(LATEST)) {
    const prevBest = Math.min(...dustYears.filter(yr => yr !== LATEST).map(yr => dustinRows[yr].rank))
    if (dCurrent < prevBest && prevBest - dCurrent >= 15) {
      insights.push({ p: 7, text: `Dust's highest-ever placement for this film — #${dCurrent} in ${LATEST}, up from a previous best of #${prevBest}. Reaching a new personal peak after multiple editions is a meaningful statement.` })
    }
  }
  if (mattYears.length > 1 && mCurrent != null && mattYears.includes(LATEST)) {
    const prevBest = Math.min(...mattYears.filter(yr => yr !== LATEST).map(yr => mattRows[yr].rank))
    if (mCurrent < prevBest && prevBest - mCurrent >= 15) {
      insights.push({ p: 7, text: `Hermz's highest-ever placement for this film — #${mCurrent} in ${LATEST}, up from a previous best of #${prevBest}. Reaching a new personal peak after multiple editions is a meaningful statement.` })
    }
  }

  // ── Fallen from peak ──────────────────────────────────────────────────────────
  if (dustYears.length > 1 && dCurrent != null && dustPriorTop.length === 0) {
    const peakRank = Math.min(...dustYears.map(yr => dustinRows[yr].rank))
    const peakYr   = dustYears.find(yr => dustinRows[yr].rank === peakRank)
    if (peakRank < dCurrent && dCurrent - peakRank >= 20) {
      insights.push({ p: 6, text: `Dust's peak for this film was #${peakRank} in ${peakYr} — it's now at #${dCurrent}, a ${dCurrent - peakRank}-spot fall from its high point. One of the larger personal slides in his rankings.` })
    }
  }
  if (mattYears.length > 1 && mCurrent != null && mattPriorTop.length === 0) {
    const peakRank = Math.min(...mattYears.map(yr => mattRows[yr].rank))
    const peakYr   = mattYears.find(yr => mattRows[yr].rank === peakRank)
    if (peakRank < mCurrent && mCurrent - peakRank >= 20) {
      insights.push({ p: 6, text: `Hermz's peak for this film was #${peakRank} in ${peakYr} — it's now at #${mCurrent}, a ${mCurrent - peakRank}-spot fall from its high point. One of the larger personal slides in his rankings.` })
    }
  }

  // ── Gap / Consensus / Divisiveness ───────────────────────────────────────────
  if (latestShared) {
    const dR = dustinRows[latestShared].rank
    const mR = mattRows[latestShared].rank
    const gap = Math.abs(dR - mR)
    const dustFavors = dR < mR
    const fav = dustFavors ? 'Dust' : 'Hermz'
    const oth = dustFavors ? 'Hermz' : 'Dust'
    const fR = dustFavors ? dR : mR
    const oR = dustFavors ? mR : dR
    if (gap === 0) {
      insights.push({ p: 8, text: `Exact agreement — both ranked this identically at #${dR} in ${latestShared}. That kind of precise consensus between two independent lists is almost unheard of.` })
    } else if (gap >= 40) {
      insights.push({ p: 9, text: `One of the most polarizing films in the canon. In ${latestShared}, ${fav} had it at #${fR} while ${oth} placed it at #${oR} — a ${gap}-spot divide. Films with gaps this wide carry strong arguments on both sides.` })
    } else if (gap >= 20) {
      insights.push({ p: 7, text: `A film that splits the room. In ${latestShared}, ${fav} ranks it #${fR} while ${oth} has it at #${oR} — ${gap} spots apart. That usually signals a fundamental difference in how they weigh what the film is doing.` })
    } else if (gap <= 5) {
      insights.push({ p: 6, text: `Unusually close to consensus: ${fav} at #${fR}, ${oth} at #${oR} in ${latestShared} — just ${gap} spot${gap !== 1 ? 's' : ''} apart. For two people with genuinely independent taste, that's a meaningful convergence.` })
    } else {
      insights.push({ p: 3, text: `In ${latestShared}, ${fav} ranked this #${fR} versus ${oth}'s #${oR} — a ${gap}-spot gap.` })
    }
  }

  // ── Gap trend (converging or diverging) ──────────────────────────────────────
  if (sharedYears.length >= 3) {
    const gaps = sharedYears.map(yr => Math.abs(dustinRows[yr].rank - mattRows[yr].rank))
    const gapChange = gaps[gaps.length-1] - gaps[0]
    if (gapChange >= 20) {
      insights.push({ p: 5, text: `The gap between them has widened substantially over time — from ${gaps[0]} spots apart in ${sharedYears[0]} to ${gaps[gaps.length-1]} in ${sharedYears[sharedYears.length-1]}. A divergence that large usually means the film hit them differently on re-evaluation.` })
    } else if (gapChange <= -20) {
      insights.push({ p: 5, text: `They've converged on this film over time — from ${gaps[0]} spots apart in ${sharedYears[0]} down to ${gaps[gaps.length-1]} in ${sharedYears[sharedYears.length-1]}. That slow drift toward agreement is worth noting.` })
    }
  }

  // ── Solo ranker ───────────────────────────────────────────────────────────────
  if (dustYears.length > 0 && mattYears.length === 0) {
    const latestD = dustYears[dustYears.length - 1]
    insights.push({ p: 7, text: `This is Dust's film. He's ranked it — most recently at #${dustinRows[latestD].rank} in ${latestD} — but Hermz has never included it. One-sided passion like this always raises a question: what does one see that the other doesn't?` })
  } else if (mattYears.length > 0 && dustYears.length === 0) {
    const latestM = mattYears[mattYears.length - 1]
    insights.push({ p: 7, text: `This is Hermz's film. He's ranked it — most recently at #${mattRows[latestM].rank} in ${latestM} — but Dust has never included it. One-sided passion like this always raises a question: what does one see that the other doesn't?` })
  }

  // ── Historical movement (broad, per person) ────────────────────────────────────
  if (sharedYears.length > 1) {
    const first = sharedYears[0]
    const last  = sharedYears[sharedYears.length - 1]
    const dDiff = (dustinRows[first]?.rank != null && dustinRows[last]?.rank != null)
      ? dustinRows[first].rank - dustinRows[last].rank : null
    const mDiff = (mattRows[first]?.rank != null && mattRows[last]?.rank != null)
      ? mattRows[first].rank - mattRows[last].rank : null
    if (dDiff !== null && Math.abs(dDiff) >= 20) {
      const dir = dDiff > 0 ? 'climbed' : 'dropped'
      insights.push({ p: 5, text: `Dust's ranking has moved ${Math.abs(dDiff)} spots overall — from #${dustinRows[first].rank} in ${first} to #${dustinRows[last].rank} in ${last}. ${dDiff > 0 ? 'Films that rise that much tend to benefit from accumulated appreciation.' : 'A shift that size usually signals a film that revealed itself differently over time.'}` })
    }
    if (mDiff !== null && Math.abs(mDiff) >= 20) {
      const dir = mDiff > 0 ? 'climbed' : 'dropped'
      insights.push({ p: 5, text: `Hermz's ranking has moved ${Math.abs(mDiff)} spots overall — from #${mattRows[first].rank} in ${first} to #${mattRows[last].rank} in ${last}. ${mDiff > 0 ? 'Few films sustain that kind of upward movement across multiple editions.' : "A shift that size usually signals a film that revealed itself differently over time."}` })
    }
  }

  // ── Late arrival (only among events the film was eligible for) ────────────────
  const firstAnyEligible = eligibleEvents.find(yr => anyYears.includes(yr))
  const eligibleMissed   = firstAnyEligible ? eligibleEvents.indexOf(firstAnyEligible) : 0
  if (firstAnyEligible && eligibleMissed > 0 && eligibleEvents.length >= 2) {
    const dR = dustinRows[firstAnyEligible]?.rank
    const mR = mattRows[firstAnyEligible]?.rank
    const who = dR && mR ? `both ranked it — Dust at #${dR}, Hermz at #${mR}` : dR ? `Dust placed it at #${dR}` : `Hermz placed it at #${mR}`
    insights.push({ p: 5, text: `Absent from the first ${eligibleMissed === 1 ? 'eligible edition' : `${eligibleMissed} eligible editions`} — it wasn't until ${firstAnyEligible} that ${who}. Late arrivals often reflect a film that needed time to fully register.` })
  }

  // ── Combined list ─────────────────────────────────────────────────────────────
  if (combYears.length > 0 && cCurrent !== 1) {
    const latestC = combYears[combYears.length - 1]
    const cRank   = combined[latestC].combined_rank
    const cScore  = combined[latestC].total_score
    const scoreStr = cScore ? ` with a total score of ${cScore}` : ''
    if (cRank <= 10) {
      insights.push({ p: 8, text: `Top 10 on the combined list — #${cRank} in ${latestC}${scoreStr}. That's where both individual lists overlap strongly enough to push a film into the true shared canon.` })
    } else if (cRank <= 25) {
      insights.push({ p: 6, text: `Combined top 25 — #${cRank} in ${latestC}${scoreStr}. Films in this range have genuine cross-list appeal without necessarily being anyone's absolute favorite.` })
    }
  } else if (anyYears.length > 0 && sharedYears.length === 0) {
    insights.push({ p: 5, text: `Because only one person has ranked it, this film hasn't qualified for the combined list. Combined placement requires both Dust and Hermz to include a film — solo enthusiasm doesn't count toward it.` })
  }

  // ── Perfect scores and score disagreements ────────────────────────────────────
  const latestSY = [...EVENTS].reverse().find(yr => dustinRows[yr] || mattRows[yr])
  if (latestSY) {
    const dRow = dustinRows[latestSY]
    const mRow = mattRows[latestSY]
    const bothPerfect = SCORE_CATS.filter(c => {
      const inYear = c.years === 'all' || c.years.includes(latestSY)
      return inYear && dRow?.[c.key] != null && dRow[c.key] >= c.max && mRow?.[c.key] != null && mRow[c.key] >= c.max
    })
    const dOnly = SCORE_CATS.filter(c => {
      const inYear = c.years === 'all' || c.years.includes(latestSY)
      return inYear && dRow?.[c.key] != null && dRow[c.key] >= c.max && !(mRow?.[c.key] >= c.max)
    })
    const mOnly = SCORE_CATS.filter(c => {
      const inYear = c.years === 'all' || c.years.includes(latestSY)
      return inYear && mRow?.[c.key] != null && mRow[c.key] >= c.max && !(dRow?.[c.key] >= c.max)
    })
    if (bothPerfect.length > 0) {
      insights.push({ p: 8, text: `Both gave a perfect score in ${bothPerfect.map(c => c.label).join(' and ')} in ${latestSY}. When two independent scorers max out the same category, it's the clearest possible signal about what the film gets absolutely right.` })
    } else {
      if (dOnly.length > 0) insights.push({ p: 5, text: `Dust gave a perfect score in ${dOnly.map(c => c.label).join(' and ')} in ${latestSY}. Perfect scores mark the categories where a film left no room for doubt.` })
      if (mOnly.length > 0) insights.push({ p: 5, text: `Hermz gave a perfect score in ${mOnly.map(c => c.label).join(' and ')} in ${latestSY}. Perfect scores are reserved for films that fully deliver — no hedging.` })
    }
    const biggest = SCORE_CATS.reduce((best, cat) => {
      const d = dRow?.[cat.key]; const m = mRow?.[cat.key]
      if (d == null || m == null) return best
      const g = Math.abs(d - m)
      return g > (best?.g ?? 0) ? { cat, g, d, m } : best
    }, null)
    if (biggest && biggest.g >= 4) {
      const { cat, g, d, m } = biggest
      const higherName = d > m ? 'Dust' : 'Hermz'
      insights.push({ p: 4, text: `The biggest scoring gap in ${latestSY} was in ${cat.label}: Dust gave ${d}, Hermz gave ${m} — a ${g}-point spread. ${higherName} was considerably more impressed there.` })
    }
  }

  return insights.sort((a, b) => b.p - a.p).slice(0, 6).map(x => x.text)
}

function FunFacts({ film, dustinRows, mattRows, combined, oscarNoms }) {
  const sharedYears = EVENTS.filter(yr => dustinRows[yr]?.rank && mattRows[yr]?.rank)
  const hasH2H      = sharedYears.length > 0
  const insights    = generateInsights(film, dustinRows, mattRows, combined, oscarNoms)
  if (!hasH2H && insights.length === 0) return null

  const latest     = sharedYears[sharedYears.length - 1]
  const dRank      = hasH2H ? dustinRows[latest].rank : null
  const mRank      = hasH2H ? mattRows[latest].rank   : null
  const gap        = hasH2H ? Math.abs(dRank - mRank) : null
  const dustFavors = dRank != null && mRank != null && dRank < mRank
  const faveColor  = dustFavors ? DC : HC
  const faveLabel  = gap === 0 ? 'TIED' : dustFavors ? 'DUST FAVORS' : 'HERMZ FAVORS'

  const gapData = sharedYears.map(yr => {
    const d = dustinRows[yr]?.rank
    const m = mattRows[yr]?.rank
    if (!d || !m) return null
    const g  = Math.abs(d - m)
    const df = d < m
    return { yr, g, df, color: g === 0 ? '#3A3650' : df ? DC : HC }
  }).filter(Boolean)
  const maxGap = Math.max(...gapData.map(x => x.g), 1)

  return (
    <div className="card space-y-6">
      <h2 className="font-display text-2xl text-white tracking-wide">FUN FACTS</h2>

      {/* Head to Head */}
      {hasH2H && (
        <div>
          <p className="kicker-dim mb-5">HEAD TO HEAD · {latest}</p>
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 text-center">
              <div className="font-display text-5xl sm:text-6xl leading-none" style={{ color: DC }}>#{dRank}</div>
              <div className="kicker-dim mt-2">DUST</div>
            </div>
            <div className="text-center px-5 border-x border-night-700 flex-shrink-0">
              <div className="font-display text-4xl text-white leading-none">{gap}</div>
              <div className="kicker-dim mt-1">APART</div>
              <div className="font-mono text-[11px] mt-2 tracking-kicker" style={{ color: gap === 0 ? '#9298A6' : faveColor }}>
                {faveLabel}
              </div>
            </div>
            <div className="flex-1 text-center">
              <div className="font-display text-5xl sm:text-6xl leading-none" style={{ color: HC }}>#{mRank}</div>
              <div className="kicker-dim mt-2">HERMZ</div>
            </div>
          </div>

          {/* Gap history */}
          {gapData.length > 1 && (
            <div className="border-t border-night-700 pt-5">
              <p className="kicker-dim mb-4">GAP HISTORY</p>
              <div className="flex gap-3 items-end" style={{ height: '88px' }}>
                {gapData.map(({ yr, g, df, color }) => (
                  <div key={yr} className="flex-1 flex flex-col items-center justify-end">
                    <div className="font-mono text-sm font-semibold mb-2"
                         style={{ color: g === 0 ? '#9298A6' : color }}>
                      {g === 0 ? '—' : g}
                    </div>
                    <div className="w-full rounded-sm"
                         style={{ height: `${Math.max((g / maxGap) * 48, g > 0 ? 4 : 2)}px`, background: color }} />
                    <div className="font-mono text-xs text-gray-500 mt-2">{yr}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-5 mt-3">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: DC }} />Dust favors
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: HC }} />Hermz favors
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Narrative insights */}
      {insights.length > 0 && (
        <>
          {hasH2H && <div className="border-t border-night-700" />}
          <div className="space-y-4">
            <p className="kicker-dim">RANKING INSIGHTS</p>
            {insights.map((text, i) => (
              <div key={i} className="pl-4 border-l-2 border-night-700 hover:border-cinema-500/50 transition-colors">
                <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── FilmPeers ────────────────────────────────────────────────────────────────
function FilmPeers({ film, directorFilms, yearPeers }) {
  const sortedDir  = [...directorFilms].sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
  const sortedYear = [...yearPeers].sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
  if (sortedDir.length === 0 && sortedYear.length === 0) return null
  return (
    <div className="space-y-5">
      {sortedDir.length > 0 && film.director && (
        <div className="card">
          <p className="kicker-dim mb-1">DIRECTOR</p>
          <h2 className="font-display text-2xl text-white tracking-wide mb-4">{film.director}</h2>
          <div className="flex flex-wrap gap-2">
            {sortedDir.map(f => <PeerTile key={f.id} f={f} />)}
          </div>
        </div>
      )}
      {sortedYear.length > 0 && film.release_year && (
        <div className="card">
          <p className="kicker-dim mb-1">ALSO FROM</p>
          <h2 className="font-display text-2xl text-white tracking-wide mb-4">{film.release_year}</h2>
          <div className="flex flex-wrap gap-2">
            {sortedYear.map(f => <PeerTile key={f.id} f={f} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── HeadToHeadCard ─────────────────────────────────────────────────────────
function HeadToHeadCard({ dustinRows, mattRows }) {
  const sharedYears = EVENTS.filter(yr => dustinRows[yr]?.rank && mattRows[yr]?.rank)
  if (sharedYears.length === 0) return null

  const latest    = sharedYears[sharedYears.length - 1]
  const dRank     = dustinRows[latest].rank
  const mRank     = mattRows[latest].rank
  const gap       = Math.abs(dRank - mRank)
  const dustFavors = dRank < mRank
  const faveColor = dustFavors ? DC : HC
  const faveLabel = dustFavors ? 'DUST FAVORS' : 'HERMZ FAVORS'

  return (
    <div className="card">
      <div className="flex items-baseline gap-3 mb-5">
        <h2 className="font-display text-2xl text-white tracking-wide">HEAD TO HEAD</h2>
        <span className="kicker-dim">{latest}</span>
      </div>
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 text-center">
          <div className="font-display text-5xl sm:text-6xl leading-none" style={{ color: DC }}>#{dRank}</div>
          <div className="kicker-dim mt-2">DUST</div>
        </div>
        <div className="text-center px-5 border-x border-night-700 flex-shrink-0">
          <div className="font-display text-4xl text-white leading-none">{gap}</div>
          <div className="kicker-dim mt-1">APART</div>
          <div className="font-mono text-[11px] mt-2 tracking-kicker" style={{ color: gap === 0 ? '#9298A6' : faveColor }}>
            {gap === 0 ? 'TIED' : faveLabel}
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className="font-display text-5xl sm:text-6xl leading-none" style={{ color: HC }}>#{mRank}</div>
          <div className="kicker-dim mt-2">HERMZ</div>
        </div>
      </div>

      {sharedYears.length > 1 && (
        <div className="border-t border-night-700 pt-4">
          <p className="kicker-dim mb-3">GAP HISTORY</p>
          <div className="flex gap-4">
            {sharedYears.map(yr => {
              const d = dustinRows[yr]?.rank
              const m = mattRows[yr]?.rank
              if (!d || !m) return null
              const g   = Math.abs(d - m)
              const df  = d < m
              return (
                <div key={yr} className="flex-1 text-center">
                  <div className="font-mono text-[11px] text-gray-500 mb-1">{yr}</div>
                  <div className="font-display text-2xl leading-none" style={{ color: g === 0 ? '#9298A6' : df ? DC : HC }}>{g}</div>
                  <div className="font-mono text-[11px] mt-1 tracking-wider" style={{ color: g === 0 ? '#9298A6' : df ? DC : HC }}>
                    {g === 0 ? '—' : df ? 'D' : 'H'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ScoreSection ────────────────────────────────────────────────────────────
const RADAR_SHORT = {
  score_lead_performance:  'Lead Perf.',
  score_supp_performance:  'Supporting',
  score_direction:         'Direction',
  score_screenplay:        'Screenplay',
  score_cinematography:    'Cinematog.',
  score_production_design: 'Prod. Design',
  score_influence:         'Influence',
  score_acclaim:           'Acclaim',
  score_personal_impact:   'Pers. Impact',
}

function ScoreSection({ dustinRows, mattRows, activeCats }) {
  const [view,      setView]      = useState('bars')   // bars is the default now
  const [chartYear, setChartYear] = useState(null)

  const eventsWithData = EVENTS.filter(yr => dustinRows[yr] || mattRows[yr])
  const effectiveYear  = chartYear || (eventsWithData.length > 0 ? eventsWithData[eventsWithData.length - 1] : null)
  const normalize      = (key, val) => val == null ? null : key === 'score_personal_impact' ? val / 2 : val

  const radarData = activeCats.map(cat => ({
    subject: RADAR_SHORT[cat.key] || cat.label,
    Dust:    normalize(cat.key, effectiveYear ? dustinRows[effectiveYear]?.[cat.key] : null),
    Hermz:   normalize(cat.key, effectiveYear ? mattRows[effectiveYear]?.[cat.key]  : null),
    fullMark: 10,
  }))

  const dRow = effectiveYear ? dustinRows[effectiveYear] : null
  const mRow = effectiveYear ? mattRows[effectiveYear]   : null

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-3 border-b border-night-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl text-white tracking-wide leading-none mb-1">SCORE HISTORY</h2>
          <p className="text-sm text-gray-500">All scores out of 10 except Personal Impact (out of 20).</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('bars')}  className={view === 'bars'  ? 'pill pill-active' : 'pill'}>Bars</button>
          <button onClick={() => setView('chart')} className={view === 'chart' ? 'pill pill-active' : 'pill'}>Radar</button>
          <button onClick={() => setView('table')} className={view === 'table' ? 'pill pill-active' : 'pill'}>Table</button>
        </div>
      </div>

      {/* shared year selector for bars + radar */}
      {(view === 'bars' || view === 'chart') && eventsWithData.length > 1 && (
        <div className="flex gap-2 px-6 pt-4">
          {eventsWithData.map(yr => (
            <button key={yr} onClick={() => setChartYear(yr)}
                    className={effectiveYear === yr ? 'pill pill-active' : 'pill'}>{yr}</button>
          ))}
        </div>
      )}

      {view === 'bars' && (
        <div className="px-6 pt-4 pb-6">
          <div className="flex items-center gap-5 mb-3">
            <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
              <span className="w-6 h-1 inline-block rounded" style={{ background: HC }} />Hermz
            </span>
            <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
              <span className="w-6 h-1 inline-block rounded" style={{ background: DC }} />Dust
            </span>
          </div>
          {activeCats.map(cat => {
            const m = mRow?.[cat.key], d = dRow?.[cat.key]
            return (
              <div key={cat.key}
                   className="grid items-center gap-3 py-2.5 border-b border-night-700/60 last:border-0"
                   style={{ gridTemplateColumns: '150px 1fr 34px 34px' }}>
                <span className="text-[13.5px] text-gray-200">{cat.label}</span>
                <div className="flex h-2.5 bg-night-700 rounded-sm overflow-hidden">
                  <div style={{ width: `${m != null ? (m / cat.max) * 50 : 0}%`, background: HC }} />
                  <div style={{ width: `${d != null ? (d / cat.max) * 50 : 0}%`, background: DC }} />
                </div>
                <span className="font-mono text-[14px] font-semibold text-center" style={{ color: HC }}>{m ?? '—'}</span>
                <span className="font-mono text-[14px] font-semibold text-center" style={{ color: DC }}>{d ?? '—'}</span>
              </div>
            )
          })}
          <div className="grid items-center gap-3 pt-4 mt-1 border-t-2 border-night-600"
               style={{ gridTemplateColumns: '150px 1fr 34px 34px' }}>
            <span className="font-display text-lg text-white tracking-wide">TOTAL · /100</span>
            <span />
            <span className="font-display text-xl text-center" style={{ color: HC }}>{mRow?.total_score ?? '—'}</span>
            <span className="font-display text-xl text-center" style={{ color: DC }}>{dRow?.total_score ?? '—'}</span>
          </div>
        </div>
      )}

      {view === 'chart' && (
        <div className="px-6 pt-3 pb-6">
          <div className="flex items-center gap-5 mb-1">
            <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
              <span className="w-6 h-0.5 inline-block rounded" style={{ background: DC }} />Dust
            </span>
            <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
              <span className="w-6 h-0.5 inline-block rounded" style={{ background: HC }} />Hermz
            </span>
            <span className="ml-auto font-mono text-[11px] text-gray-600">Pers. Impact ÷2 for display</span>
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
              <PolarGrid stroke="rgba(255,255,255,0.07)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#9298A6', fontSize: 11, fontFamily: 'monospace' }} />
              <PolarRadiusAxis domain={[0, 10]} tickCount={4} axisLine={false} tick={{ fill: '#9298A6', fontSize: 9 }} />
              <Radar name="Dust"  dataKey="Dust"  stroke={DC} fill={DC} fillOpacity={0.12} strokeWidth={2} dot={{ r: 3, fill: DC }} />
              <Radar name="Hermz" dataKey="Hermz" stroke={HC} fill={HC} fillOpacity={0.08} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: HC }} />
              <Tooltip contentStyle={{ background: '#15141E', border: '1px solid #2A2734', borderRadius: 8 }}
                labelStyle={{ color: '#9298A6', fontSize: 11, fontFamily: 'monospace' }}
                itemStyle={{ color: '#F4F0E8', fontSize: 13 }}
                formatter={(value, name) => [value != null ? value : '—', name]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header w-44">Category</th>
                {EVENTS.map(yr => dustinRows[yr] && (
                  <th key={`d-${yr}`} className="table-header text-center" style={{ color: DC }}>Dust {yr}</th>
                ))}
                {EVENTS.map(yr => mattRows[yr] && (
                  <th key={`m-${yr}`} className="table-header text-center" style={{ color: HC }}>Hermz {yr}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCats.map(cat => (
                <tr key={cat.key} className="table-row-hover">
                  <td className="table-cell">
                    <span className="text-sm font-medium text-gray-200">{cat.label}</span>
                    {cat.note && <span className="block text-xs text-gray-500 font-mono">{cat.note}</span>}
                  </td>
                  {EVENTS.map(yr => {
                    if (!dustinRows[yr]) return null
                    const inYear = cat.years === 'all' || cat.years.includes(yr)
                    return (
                      <td key={`d-${yr}`} className="table-cell text-center">
                        {inYear ? <ScoreCell value={dustinRows[yr]?.[cat.key]} max={cat.max} />
                                : <span className="text-xs text-gray-700">n/a</span>}
                      </td>
                    )
                  })}
                  {EVENTS.map(yr => {
                    if (!mattRows[yr]) return null
                    const inYear = cat.years === 'all' || cat.years.includes(yr)
                    return (
                      <td key={`m-${yr}`} className="table-cell text-center">
                        {inYear ? <ScoreCell value={mattRows[yr]?.[cat.key]} max={cat.max} />
                                : <span className="text-xs text-gray-700">n/a</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-night-900/40">
                <td className="table-cell font-display text-lg text-white tracking-wide">TOTAL</td>
                {EVENTS.map(yr => dustinRows[yr] && (
                  <td key={`d-total-${yr}`} className="table-cell text-center">
                    <span className="font-display text-xl text-white tracking-wide">{dustinRows[yr]?.total_score ?? '—'}</span>
                  </td>
                ))}
                {EVENTS.map(yr => mattRows[yr] && (
                  <td key={`m-total-${yr}`} className="table-cell text-center">
                    <span className="font-display text-xl text-white tracking-wide">{mattRows[yr]?.total_score ?? '—'}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
function RankBig({ who, rank }) {
  const c = who === 'matt' ? 'text-gold-500' : who === 'dustin' ? 'text-film-500' : 'text-emerald-400'
  const name = who === 'matt' ? 'HERMZ' : who === 'dustin' ? 'DUST' : 'COMBINED'
  return (
    <div className="text-center px-2">
      <div className={`font-mono text-[11px] tracking-cinema ${c} mb-1`}>{name}</div>
      <div className="font-display text-5xl text-white leading-none tracking-wide">
        {rank ? `#${rank}` : 'NR'}
      </div>
    </div>
  )
}
