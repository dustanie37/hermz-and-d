import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import FilmStill from '../../components/FilmStill'
import { hydrateAcclaim } from '../../lib/acclaimLists'

// ── Algorithm ─────────────────────────────────────────────────────────────────

function suggestAcclaim(film) {
  if (!film) return null
  let pts = 0
  const factors = []

  if (film.sight_sound_2022_rank != null) {
    if (film.sight_sound_2022_rank <= 10)  { pts += 3.5; factors.push(`S&S #${film.sight_sound_2022_rank}`) }
    else if (film.sight_sound_2022_rank <= 100) { pts += 2.5; factors.push(`S&S #${film.sight_sound_2022_rank}`) }
    else { pts += 1.5; factors.push(`Sight & Sound`) }
  }
  if (film.afi_top100_rank != null) {
    if (film.afi_top100_rank <= 25) { pts += 2.5; factors.push(`AFI #${film.afi_top100_rank}`) }
    else { pts += 1.5; factors.push(`AFI Top 100`) }
  }
  if (film.won_best_picture) { pts += 2.5; factors.push('Best Pic') }
  const prestiWins = ['won_best_director','won_best_actor','won_best_actress','won_screenplay','won_cinematography']
    .filter(k => film[k])
  if (prestiWins.length > 0) {
    pts += Math.min(prestiWins.length * 0.5, 1.5)
    factors.push(`${prestiWins.length} Oscar win${prestiWins.length > 1 ? 's' : ''}`)
  }
  const noms = film.oscar_nominations || 0
  if (!film.won_best_picture && noms >= 10)     { pts += 1.5; factors.push(`${noms} noms`) }
  else if (!film.won_best_picture && noms >= 5) { pts += 0.75; factors.push(`${noms} noms`) }
  else if (!film.won_best_picture && noms >= 2) { pts += 0.25 }
  if (film.imdb_top250_rank != null) {
    if (film.imdb_top250_rank <= 25)  { pts += 1.5; factors.push(`IMDB #${film.imdb_top250_rank}`) }
    else if (film.imdb_top250_rank <= 100) { pts += 1.0; factors.push(`IMDB Top 100`) }
    else { pts += 0.5; factors.push(`IMDB Top 250`) }
  }
  if (film.national_film_registry) { pts += 0.5; factors.push('NFR') }
  if (film.nyt_2000s_rank != null)        pts += 0.25
  if (film.afi_comedies_rank != null)     pts += 0.25
  if (film.variety_comedies_rank != null) pts += 0.25

  const score = Math.min(10, Math.max(1, Math.round(2 + pts * 0.8)))
  return { score, factors }
}

// ── InlineEditor ──────────────────────────────────────────────────────────────

function InlineEditor({ film, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState(null)
  const inputRef              = useRef(null)
  const suggest               = suggestAcclaim(film)

  function startEdit() {
    setVal(film.acclaim_score != null ? String(film.acclaim_score) : '')
    setErr(null); setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }
  function cancel() { setEditing(false); setErr(null) }

  async function save() {
    const parsed = parseInt(val, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 10) { setErr('1–10'); return }
    setSaving(true)
    const { error } = await supabase.from('films').update({ acclaim_score: parsed }).eq('id', film.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false); onSaved(film.id, parsed)
  }
  function applySuggestion() { if (suggest) { setVal(String(suggest.score)); setErr(null) } }
  async function clear() {
    setSaving(true)
    const { error } = await supabase.from('films').update({ acclaim_score: null }).eq('id', film.id)
    setSaving(false)
    if (!error) { setEditing(false); onSaved(film.id, null) }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        {film.acclaim_score != null ? (
          <span className="font-display text-2xl text-gold-400 tracking-wide leading-none w-8 text-right">
            {film.acclaim_score}
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-kicker text-gray-600 w-8 text-right italic">—</span>
        )}
        {suggest && (
          <span className="font-mono text-[10px] tracking-kicker text-gray-500 hidden sm:inline">≈{suggest.score}</span>
        )}
        <button onClick={startEdit}
          className="ml-1 text-xs text-gray-500 hover:text-gold-400 transition-colors"
          title="Edit acclaim score">
          ✏️
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="number" min="1" max="10"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          placeholder="1–10"
          className="w-16 px-2 py-1 text-center font-display text-xl tracking-wide
                     rounded bg-night-800 border border-night-500 text-white
                     focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30"
        />
        <button onClick={save} disabled={saving} className="btn-gold text-xs px-3 py-1 disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={cancel} className="btn-ghost text-xs px-2 py-1">✕</button>
        {suggest && (
          <button onClick={applySuggestion}
            className="font-mono text-[10px] tracking-kicker text-cinema-400 hover:text-cinema-300 transition-colors uppercase"
            title={`Apply algorithm suggestion: ${suggest.score}/10`}>
            Use ≈{suggest.score}
          </button>
        )}
        {film.acclaim_score != null && (
          <button onClick={clear} className="text-xs text-red-400 hover:text-red-300 transition-colors ml-auto">
            Clear
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {suggest && suggest.factors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggest.factors.map((f, i) => (
            <span key={i} className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase">{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

const EVENTS = [2001, 2007, 2016, 2026]

export default function MoviesAcclaim() {
  const { isAuthenticated } = useAuth()

  const [films,     setFilms]     = useState([])
  const [filmRanks, setFilmRanks] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const [eventFilter, setEventFilter] = useState('all')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [sortBy,      setSortBy]      = useState('rank')
  const [search,      setSearch]      = useState('')

  const scoredCount   = films.filter(f => f.acclaim_score != null).length
  const unscoredCount = films.length - scoredCount

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true); setError(null)
    try {
      const [
        { data: filmData, error: fe },
        { data: indData,  error: ie },
        { data: combData, error: ce },
        { data: evData,   error: ee },
      ] = await Promise.all([
        supabase.from('films').select('*').order('title'),
        supabase.from('individual_rankings').select('film_id, rank, ranking_events(year), profiles(username)'),
        supabase.from('combined_rankings').select('film_id, combined_rank, ranking_events(year)'),
        supabase.from('ranking_events').select('id,year').eq('status', 'published').order('year'),
      ])
      if (fe) throw fe; if (ie) throw ie; if (ce) throw ce; if (ee) throw ee

      const ranks = {}
      ;(indData || []).forEach(r => {
        const yr = r.ranking_events?.year
        const un = r.profiles?.username
        if (!yr || !un) return
        if (!ranks[r.film_id]) ranks[r.film_id] = {}
        if (!ranks[r.film_id][yr]) ranks[r.film_id][yr] = {}
        ranks[r.film_id][yr][un] = r.rank
      })
      ;(combData || []).forEach(r => {
        const yr = r.ranking_events?.year
        if (!yr) return
        if (!ranks[r.film_id]) ranks[r.film_id] = {}
        if (!ranks[r.film_id][yr]) ranks[r.film_id][yr] = {}
        ranks[r.film_id][yr].combined = r.combined_rank
      })

      // acclaim/list membership (feeds the suggest algorithm) comes from
      // external_list_entries — single source, no denormalized-column drift
      setFilms(await hydrateAcclaim(filmData || []))
      setFilmRanks(ranks)
    } catch(e) {
      setError(e.message || 'Failed to load films')
    } finally {
      setLoading(false)
    }
  }

  function handleSaved(filmId, newScore) {
    setFilms(prev => prev.map(f => f.id === filmId ? { ...f, acclaim_score: newScore } : f))
  }

  const eventYear = eventFilter === 'all' ? null : parseInt(eventFilter, 10)

  let displayed = films.filter(f => {
    if (eventYear) {
      const ranks = filmRanks[f.id]?.[eventYear]
      if (!ranks) return false
    }
    if (scoreFilter === 'scored'   && f.acclaim_score == null) return false
    if (scoreFilter === 'unscored' && f.acclaim_score != null) return false
    if (search) {
      const q = search.toLowerCase()
      if (!f.title.toLowerCase().includes(q) && !(f.director || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  displayed = [...displayed].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title)
    if (sortBy === 'score') {
      if (a.acclaim_score == null && b.acclaim_score == null) return a.title.localeCompare(b.title)
      if (a.acclaim_score == null) return 1
      if (b.acclaim_score == null) return -1
      return b.acclaim_score - a.acclaim_score
    }
    if (sortBy === 'suggest') {
      const sa = suggestAcclaim(a)?.score ?? 0
      const sb = suggestAcclaim(b)?.score ?? 0
      return sb - sa
    }
    if (eventYear) {
      const ra = filmRanks[a.id]?.[eventYear]?.combined ?? filmRanks[a.id]?.[eventYear]?.dustin ?? 9999
      const rb = filmRanks[b.id]?.[eventYear]?.combined ?? filmRanks[b.id]?.[eventYear]?.dustin ?? 9999
      if (ra !== rb) return ra - rb
    }
    return a.title.localeCompare(b.title)
  })

  const pct = films.length ? Math.round((scoredCount / films.length) * 100) : 0

  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <FilmStill
        title="Hermz and D Acclaim Scores"
        hue={42}
        mood="warm"
        className="w-full h-[300px] sm:h-[340px]"
      >
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-[11px] tracking-kicker text-film-400 hover:text-film-300 transition-colors">
              ← FILMS
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Acclaim</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            ACCLAIM SCORES
          </h1>
          <p className="font-serif italic text-base text-gray-400 mt-3">
            Agreed score out of 10 per film — informed by Oscar history and external critics.
          </p>
        </div>
      </FilmStill>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-6">

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING FILMS…</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-red-400 text-sm">{error}</div>
        ) : (
          <>
            {/* Stats strip */}
            <div className="card flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className="font-display text-3xl text-gold-400 leading-none tracking-wide">{scoredCount}</div>
                <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">Scored</div>
              </div>
              <div className="text-center">
                <div className="font-display text-3xl text-gray-500 leading-none tracking-wide">{unscoredCount}</div>
                <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">Unscored</div>
              </div>
              <div className="text-center">
                <div className="font-display text-3xl text-white leading-none tracking-wide">{films.length}</div>
                <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">Total Films</div>
              </div>
              <div className="flex-1 min-w-48 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-night-700 overflow-hidden">
                  <div className="h-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="font-mono text-[10px] tracking-kicker text-gray-400 whitespace-nowrap">{pct}%</span>
              </div>
            </div>

            {!isAuthenticated && (
              <div className="rounded-xl border border-cinema-500/30 bg-cinema-500/10
                              px-4 py-3 text-sm text-cinema-300">
                Log in to edit acclaim scores.
              </div>
            )}

            {/* Controls */}
            <div className="card">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-48">
                  <label className="block font-mono text-[10px] tracking-kicker text-gray-400 uppercase mb-1.5">Search</label>
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Film title or director…"
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-kicker text-gray-400 uppercase mb-1.5">Event</label>
                  <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} className="select text-sm pr-8">
                    <option value="all" className="bg-night-900">All Films</option>
                    {EVENTS.map(y => <option key={y} value={String(y)} className="bg-night-900">{y} List</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-kicker text-gray-400 uppercase mb-1.5">Score</label>
                  <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)} className="select text-sm pr-8">
                    <option value="all" className="bg-night-900">All</option>
                    <option value="unscored" className="bg-night-900">Unscored only</option>
                    <option value="scored" className="bg-night-900">Scored only</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-kicker text-gray-400 uppercase mb-1.5">Sort</label>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select text-sm pr-8">
                    <option value="rank" className="bg-night-900">By rank{eventYear ? ` (${eventYear})` : ''}</option>
                    <option value="title" className="bg-night-900">By title</option>
                    <option value="score" className="bg-night-900">By acclaim score</option>
                    <option value="suggest" className="bg-night-900">By suggested score</option>
                  </select>
                </div>
              </div>
              <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-4 uppercase">
                Showing {displayed.length} film{displayed.length !== 1 ? 's' : ''}
                {search && ` · matching "${search}"`}
              </p>
            </div>

            {/* Film list */}
            <div className="card p-0 overflow-hidden">
              {displayed.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500 italic">
                  No films match the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {eventYear && <th className="table-header text-center w-12">Rank</th>}
                        <th className="table-header">Film</th>
                        <th className="table-header w-56">
                          Acclaim
                          {isAuthenticated && (
                            <span className="font-mono font-normal text-gray-600 ml-1 lowercase tracking-normal">· click ✏️ to edit</span>
                          )}
                        </th>
                        <th className="table-header hidden md:table-cell">Oscar</th>
                        <th className="table-header hidden lg:table-cell text-right">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map(film => {
                        const suggest = suggestAcclaim(film)
                        const filmRank = eventYear
                          ? (filmRanks[film.id]?.[eventYear]?.combined ?? filmRanks[film.id]?.[eventYear]?.dustin ?? null)
                          : null

                        return (
                          <tr key={film.id} className={`table-row-hover ${film.acclaim_score == null ? 'opacity-80' : ''}`}>
                            {eventYear && (
                              <td className="table-cell text-center">
                                {filmRank
                                  ? <span className="font-display text-xl text-white tracking-wide leading-none">#{filmRank}</span>
                                  : <span className="font-mono text-[10px] tracking-kicker text-gray-600">NR</span>
                                }
                              </td>
                            )}
                            <td className="table-cell">
                              <div className="flex items-center gap-3">
                                <FilmStill src={film.poster_url} title={film.title}
                                           className="w-10 h-14 rounded border border-white/10 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white leading-tight truncate">{film.title}</div>
                                  <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1 uppercase">
                                    {film.release_year}{film.director ? ` · ${film.director}` : ''}
                                  </div>
                                  {suggest && suggest.factors.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1 md:hidden">
                                      {suggest.factors.slice(0, 3).map((f, i) => (
                                        <span key={i} className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase">{f}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="table-cell">
                              {isAuthenticated ? (
                                <InlineEditor film={film} onSaved={handleSaved} />
                              ) : film.acclaim_score != null ? (
                                <span className="font-display text-2xl text-gold-400 tracking-wide leading-none">{film.acclaim_score}</span>
                              ) : (
                                <span className="font-mono text-[10px] tracking-kicker text-gray-600">—</span>
                              )}
                            </td>
                            <td className="table-cell hidden md:table-cell">
                              {(film.oscar_nominations || 0) > 0 ? (
                                <div className="font-mono text-[11px] tracking-kicker text-gray-400">
                                  {film.oscar_wins > 0 && (
                                    <span className="text-gold-400 mr-1">🏆{film.oscar_wins}W</span>
                                  )}
                                  {film.oscar_nominations}N
                                </div>
                              ) : (
                                <span className="font-mono text-[10px] tracking-kicker text-gray-600">—</span>
                              )}
                            </td>
                            <td className="table-cell hidden lg:table-cell text-right">
                              <Link to={`/movies/${film.id}`}
                                className="font-mono text-[10px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors uppercase">
                                View →
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}