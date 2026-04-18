import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

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
  if (film.nyt_2000s_rank != null)       pts += 0.25
  if (film.afi_comedies_rank != null)    pts += 0.25
  if (film.variety_comedies_rank != null) pts += 0.25

  const score = Math.min(10, Math.max(1, Math.round(2 + pts * 0.8)))
  return { score, factors }
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ value }) {
  if (value == null) return null
  return (
    <div className="w-16 h-1.5 rounded-full bg-stone-100 dark:bg-night-700 overflow-hidden">
      <div
        className="h-full rounded-full bg-gold-400 dark:bg-gold-500"
        style={{ width: `${value * 10}%` }}
      />
    </div>
  )
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
    setErr(null)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function cancel() { setEditing(false); setErr(null) }

  async function save() {
    const parsed = parseInt(val, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 10) {
      setErr('1–10'); return
    }
    setSaving(true)
    const { error } = await supabase
      .from('films').update({ acclaim_score: parsed }).eq('id', film.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false)
    onSaved(film.id, parsed)
  }

  async function applySuggestion() {
    if (!suggest) return
    setVal(String(suggest.score))
    setErr(null)
  }

  async function clear() {
    setSaving(true)
    const { error } = await supabase
      .from('films').update({ acclaim_score: null }).eq('id', film.id)
    setSaving(false)
    if (!error) { setEditing(false); onSaved(film.id, null) }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        {film.acclaim_score != null ? (
          <>
            <span className="text-xl font-bold text-gold-600 dark:text-gold-400 font-display w-8 text-right">
              {film.acclaim_score}
            </span>
            <ScoreBar value={film.acclaim_score} />
          </>
        ) : (
          <span className="text-sm text-gray-400 italic w-8 text-right">—</span>
        )}
        {suggest && (
          <span className="text-xs text-gray-400 hidden sm:inline">
            ≈{suggest.score}
          </span>
        )}
        <button
          onClick={startEdit}
          className="ml-1 text-xs text-gray-400 hover:text-gold-500 dark:hover:text-gold-400
                     transition-colors"
          title="Edit acclaim score"
        >
          ✏️
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number" min="1" max="10"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') cancel()
          }}
          placeholder="1–10"
          className="w-16 px-2 py-1 text-center text-base font-bold
                     rounded border border-stone-300 dark:border-night-500
                     bg-white dark:bg-night-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
        <button
          onClick={save} disabled={saving}
          className="btn-primary text-xs px-3 py-1 disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={cancel} className="btn-ghost text-xs px-2 py-1">✕</button>
        {suggest && (
          <button
            onClick={applySuggestion}
            className="text-xs text-gray-400 hover:text-gold-500 dark:hover:text-gold-400
                       transition-colors"
            title={`Apply algorithm suggestion: ${suggest.score}/10`}
          >
            Use ≈{suggest.score}
          </button>
        )}
        {film.acclaim_score != null && (
          <button
            onClick={clear}
            className="text-xs text-red-400 hover:text-red-500 transition-colors ml-auto"
          >
            Clear
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {suggest && suggest.factors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggest.factors.map((f, i) => (
            <span key={i} className="text-xs text-gray-400">{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PosterThumb ───────────────────────────────────────────────────────────────

function PosterThumb({ url, title }) {
  const [err, setErr] = useState(false)
  if (!url || err) {
    return (
      <div className="w-8 h-11 flex items-center justify-center
                      bg-stone-100 dark:bg-night-700 rounded text-base flex-shrink-0">
        🎬
      </div>
    )
  }
  return (
    <img
      src={url} alt={title} onError={() => setErr(true)}
      className="w-8 h-11 object-cover rounded flex-shrink-0"
    />
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

const EVENTS = [2001, 2007, 2016, 2026]

export default function MoviesAcclaim() {
  const { isAuthenticated } = useAuth()

  const [films,        setFilms]       = useState([])
  const [filmRanks,    setFilmRanks]   = useState({})  // { filmId: { 2001: {dustin,matt,combined}, … } }
  const [loading,      setLoading]     = useState(true)
  const [error,        setError]       = useState(null)

  // Filters & sort
  const [eventFilter,  setEventFilter]  = useState('all')     // 'all' | '2001' | '2007' | '2016' | '2026'
  const [scoreFilter,  setScoreFilter]  = useState('all')     // 'all' | 'unscored' | 'scored'
  const [sortBy,       setSortBy]       = useState('rank')    // 'rank' | 'title' | 'score' | 'suggest'
  const [search,       setSearch]       = useState('')

  // Stats
  const scoredCount   = films.filter(f => f.acclaim_score != null).length
  const unscoredCount = films.length - scoredCount

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: filmData, error: fe },
        { data: indData,  error: ie },
        { data: combData, error: ce },
        { data: evData,   error: ee },
      ] = await Promise.all([
        supabase.from('films').select('*').order('title'),
        supabase
          .from('individual_rankings')
          .select('film_id, rank, ranking_events(year), profiles(username)'),
        supabase
          .from('combined_rankings')
          .select('film_id, combined_rank, ranking_events(year)'),
        supabase.from('ranking_events').select('id,year').order('year'),
      ])
      if (fe) throw fe
      if (ie) throw ie
      if (ce) throw ce
      if (ee) throw ee

      // Build rank index: { filmId: { eventYear: { dustin, matt, combined } } }
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

      setFilms(filmData || [])
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

  // ── Derived / filtered list ──────────────────────────────────────────────

  const eventYear = eventFilter === 'all' ? null : parseInt(eventFilter, 10)

  let displayed = films.filter(f => {
    // Event filter
    if (eventYear) {
      const ranks = filmRanks[f.id]?.[eventYear]
      if (!ranks) return false
    }
    // Score filter
    if (scoreFilter === 'scored'   && f.acclaim_score == null) return false
    if (scoreFilter === 'unscored' && f.acclaim_score != null) return false
    // Search
    if (search) {
      const q = search.toLowerCase()
      if (!f.title.toLowerCase().includes(q) && !(f.director || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Sort
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
    // Default: rank (within selected event, or title)
    if (eventYear) {
      const ra = filmRanks[a.id]?.[eventYear]?.combined ?? filmRanks[a.id]?.[eventYear]?.dustin ?? 9999
      const rb = filmRanks[b.id]?.[eventYear]?.combined ?? filmRanks[b.id]?.[eventYear]?.dustin ?? 9999
      if (ra !== rb) return ra - rb
    }
    return a.title.localeCompare(b.title)
  })

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center">
      <span className="text-gray-400 animate-pulse text-sm">Loading films…</span>
    </div>
  )

  if (error) return (
    <div className="max-w-5xl mx-auto px-4 py-16 text-center">
      <p className="text-red-400 text-sm mb-4">{error}</p>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div>
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
            Acclaim Scores
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Agreed-upon score out of 10 per film — informed by Oscar history and external critics lists.
        </p>
      </div>

      {/* ── Stats strip ── */}
      <div className="flex flex-wrap gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold font-display text-gold-600 dark:text-gold-400">
            {scoredCount}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Scored</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-display text-gray-400">
            {unscoredCount}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Unscored</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-display text-gray-900 dark:text-white">
            {films.length}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Total Films</div>
        </div>
        {/* Progress bar */}
        <div className="flex-1 flex items-center">
          <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-night-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold-400 dark:bg-gold-500 transition-all"
              style={{ width: `${films.length ? (scoredCount / films.length) * 100 : 0}%` }}
            />
          </div>
          <span className="ml-3 text-xs text-gray-400 whitespace-nowrap">
            {films.length ? Math.round((scoredCount / films.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800
                        bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm
                        text-amber-700 dark:text-amber-400">
          Log in to edit acclaim scores.
        </div>
      )}

      {/* ── Controls ── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Search */}
          <div className="flex-1 min-w-48">
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Film title or director…"
              className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-night-500
                         bg-white dark:bg-night-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
          </div>

          {/* Event filter */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Event</label>
            <select
              value={eventFilter}
              onChange={e => setEventFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-night-500
                         bg-white dark:bg-night-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-400"
            >
              <option value="all">All Films</option>
              {EVENTS.map(y => (
                <option key={y} value={String(y)}>{y} List</option>
              ))}
            </select>
          </div>

          {/* Score filter */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Score</label>
            <select
              value={scoreFilter}
              onChange={e => setScoreFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-night-500
                         bg-white dark:bg-night-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-400"
            >
              <option value="all">All</option>
              <option value="unscored">Unscored only</option>
              <option value="scored">Scored only</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Sort</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-night-500
                         bg-white dark:bg-night-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-400"
            >
              <option value="rank">By rank{eventYear ? ` (${eventYear})` : ''}</option>
              <option value="title">By title</option>
              <option value="score">By acclaim score</option>
              <option value="suggest">By suggested score</option>
            </select>
          </div>
        </div>

        {/* Result count */}
        <p className="text-xs text-gray-400 mt-3">
          Showing {displayed.length} film{displayed.length !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </p>
      </div>

      {/* ── Film list ── */}
      <div className="card p-0 overflow-hidden">
        {displayed.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400 italic">
            No films match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {eventYear && (
                    <th className="table-header text-center w-12">Rank</th>
                  )}
                  <th className="table-header">Film</th>
                  <th className="table-header w-52">
                    Acclaim Score
                    {isAuthenticated && (
                      <span className="font-normal text-gray-400 ml-1 text-xs">(click ✏️ to edit)</span>
                    )}
                  </th>
                  <th className="table-header hidden md:table-cell">Oscar</th>
                  <th className="table-header hidden lg:table-cell text-right">Detail</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(film => {
                  const suggest   = suggestAcclaim(film)
                  const filmRank  = eventYear
                    ? (filmRanks[film.id]?.[eventYear]?.combined ?? filmRanks[film.id]?.[eventYear]?.dustin ?? null)
                    : null

                  return (
                    <tr key={film.id} className={`table-row-hover ${film.acclaim_score == null ? 'opacity-80' : ''}`}>
                      {/* Rank */}
                      {eventYear && (
                        <td className="table-cell text-center">
                          {filmRank
                            ? <span className="text-base font-bold text-gray-700 dark:text-gray-300">#{filmRank}</span>
                            : <span className="text-xs text-gray-400">NR</span>
                          }
                        </td>
                      )}

                      {/* Film info */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <PosterThumb url={film.poster_url} title={film.title} />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white text-sm leading-tight truncate">
                              {film.title}
                            </div>
                            <div className="text-xs text-gray-400">
                              {film.release_year}{film.director ? ` · ${film.director}` : ''}
                            </div>
                            {/* Suggestion factors (mobile) */}
                            {suggest && suggest.factors.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5 md:hidden">
                                {suggest.factors.slice(0, 3).map((f, i) => (
                                  <span key={i} className="text-xs text-gray-400">{f}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Acclaim editor */}
                      <td className="table-cell">
                        {isAuthenticated ? (
                          <InlineEditor film={film} onSaved={handleSaved} />
                        ) : film.acclaim_score != null ? (
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-gold-600 dark:text-gold-400 font-display">
                              {film.acclaim_score}
                            </span>
                            <ScoreBar value={film.acclaim_score} />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">—</span>
                        )}
                      </td>

                      {/* Oscar summary */}
                      <td className="table-cell hidden md:table-cell">
                        {(film.oscar_nominations || 0) > 0 ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {film.oscar_wins > 0 && (
                              <span className="text-gold-600 dark:text-gold-400 font-semibold mr-1">
                                🏆{film.oscar_wins}W
                              </span>
                            )}
                            {film.oscar_nominations}N
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Detail link */}
                      <td className="table-cell hidden lg:table-cell text-right">
                        <Link
                          to={`/movies/${film.id}`}
                          className="text-xs text-gray-400 hover:text-gold-500 dark:hover:text-gold-400
                                     transition-colors"
                        >
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

    </div>
  )
}
