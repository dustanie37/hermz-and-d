import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { searchFilmByTitle, searchFilmsByQuery } from '../../lib/omdb'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'
import { OSCAR_STATUS_META } from '../../lib/oscarSeason'

// ── helpers ──────────────────────────────────────────────────────────────────

function shortCeremony(name) {
  if (!name) return ''
  return name.replace(/^The\s+/i, '').split(' - ')[0]
}

function formatDate(name) {
  if (!name) return ''
  const parts = name.split(' - ')
  return parts[1] || ''
}

// Hash a year into a hue so each year card gets a unique cinematographic tint.
function yearHue(y) {
  return ((y * 17) + 11) % 360
}

// ── component ─────────────────────────────────────────────────────────────────

export default function OscarsHome() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [posterMap, setPosterMap] = useState({}) // year → poster_url

  useEffect(() => { fetchSummary() }, [])

  async function fetchSummary() {
    const { data, error } = await supabase
      .from('v_oscar_year_summary')
      .select('*')
      .order('year', { ascending: false })
    if (error) setError(error.message)
    else {
      setYears(data || [])
      fetchBestPicturePosters(data || [])
    }
    setLoading(false)
  }

  async function fetchBestPicturePosters(yearData) {
    try {
      // 1. Get Best Picture category ID
      const { data: bpCat } = await supabase
        .from('oscar_categories').select('id').eq('name', 'Best Picture').single()
      if (!bpCat) return

      // 2. Get all BP winners with their ceremony year
      const { data: winners } = await supabase
        .from('oscar_nominees')
        .select('nominee_name, oscar_years(year)')
        .eq('category_id', bpCat.id)
        .eq('is_winner', true)
      if (!winners?.length) return

      // 3. Check films table first (fast, free)
      const titles = [...new Set(winners.map(w => w.nominee_name))]
      const { data: dbFilms } = await supabase
        .from('films').select('title, poster_url').in('title', titles)

      const dbPoster = {}
      dbFilms?.forEach(f => { if (f.poster_url) dbPoster[f.title] = f.poster_url })

      // 4. For any winner not in our DB, fetch from OMDB in parallel (year-specific first)
      const missing = winners.filter(w => !dbPoster[w.nominee_name])
      const omdbResults = await Promise.allSettled(
        missing.map(w =>
          searchFilmByTitle(w.nominee_name, (w.oscar_years?.year ?? 2000) - 1)
        )
      )
      const omdbPoster = {}
      missing.forEach((w, i) => {
        const r = omdbResults[i]
        if (r.status === 'fulfilled' && r.value?.posterUrl) {
          omdbPoster[w.nominee_name] = r.value.posterUrl
        }
      })

      // 4b. Fuzzy search retry for any still missing — uses ?s= endpoint which tolerates
      //     title variations, punctuation differences, etc. (e.g. "Everything Everywhere All at Once")
      const stillMissing = missing.filter(w => !omdbPoster[w.nominee_name])
      if (stillMissing.length) {
        const retryResults = await Promise.allSettled(
          stillMissing.map(w => searchFilmsByQuery(w.nominee_name))
        )
        stillMissing.forEach((w, i) => {
          const r = retryResults[i]
          if (r.status === 'fulfilled' && r.value?.[0]?.posterUrl) {
            omdbPoster[w.nominee_name] = r.value[0].posterUrl
          }
        })
      }

      // 5. Build final year → poster map (DB preferred, OMDB fallback)
      const map = {}
      winners.forEach(w => {
        const yr = w.oscar_years?.year
        const poster = dbPoster[w.nominee_name] || omdbPoster[w.nominee_name]
        if (yr && poster) map[yr] = poster
      })
      setPosterMap(map)
    } catch (e) {
      console.warn('BP poster fetch failed:', e)
    }
  }

  async function handleDelete(year) {
    if (!window.confirm(`Delete the ${year} ceremony and all its data? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const { data: yrRow } = await supabase.from('oscar_years').select('id').eq('year', year).single()
      if (yrRow) {
        await supabase.from('oscar_guesses').delete().eq('year_id', yrRow.id)
        await supabase.from('oscar_nominees').delete().eq('year_id', yrRow.id)
        await supabase.from('oscar_years').delete().eq('id', yrRow.id)
      }
      await fetchSummary()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  async function handleMarkComplete(year) {
    await supabase.from('oscar_years').update({ status: 'complete' }).eq('year', year)
    await fetchSummary()
  }

  // Phase 13b — anything not complete (upcoming/ballots/locked/revealed) is "in season"
  const upcoming = years.filter(y => y.status !== 'complete')
  const complete = years.filter(y => y.status === 'complete')

  const mattWins    = complete.filter(y => y.winner === 'matt').length
  const dustinWins  = complete.filter(y => y.winner === 'dustin').length
  const tieYears    = complete.filter(y => y.tiebreaker_used).length
  const mattTotal   = complete.reduce((s, y) => s + (y.matt_correct   || 0), 0)
  const dustinTotal = complete.reduce((s, y) => s + (y.dustin_correct || 0), 0)
  const oldestYear = complete[complete.length - 1]?.year
  const newestYear = complete[0]?.year
  const mattLead = mattWins > dustinWins

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">
        LOADING CEREMONIES…
      </span>
    </div>
  )

  if (error) return (
    <div className="py-20 text-center text-red-400">Error: {error}</div>
  )

  return (
    <div>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <FilmStill
        title="Hermz and D Oscar Ledger"
        mood="warm"
        hue={42}
        className="w-full h-[300px] sm:h-[340px]"
      >
        {/* Oscar statuette — Mirko Fabian / Unsplash, screen blend */}
        <div className="absolute pointer-events-none hidden sm:block"
             style={{ right: 0, top: 0, width: '40%', height: '100%', overflow: 'hidden' }}>
          <img src="https://images.unsplash.com/photo-1741887864007-271499b10d53?fm=jpg&q=85&w=800&auto=format&fit=crop"
               alt=""
               style={{ position: 'absolute', right: '-5%', top: '50%', transform: 'translateY(-50%)',
                        width: '100%', height: '140%', objectFit: 'cover', objectPosition: 'center top',
                        mixBlendMode: 'screen', opacity: 0.55, filter: 'contrast(1.15) brightness(0.85)' }} />
        </div>
        <div className="absolute inset-0 scrim-bottom" />

        {/* Top action row */}
        <div className="absolute top-6 right-6 sm:right-10 flex items-center gap-2 z-10">
          <Link to="/oscars/stats" className="btn-ghost text-xs flex items-center gap-2">
            📊 All-Time Stats
          </Link>
          {isAuthenticated && (
            <Link to="/oscars/new" className="btn-cinema text-xs">＋ New Year</Link>
          )}
        </div>

        {/* Headline */}
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-8 z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="block w-7 h-px bg-gold-500" />
            <span className="kicker">
              The Ledger · {complete.length} ceremonies · {oldestYear}–{newestYear}
            </span>
          </div>
          <h1 className="font-display text-6xl sm:text-7xl lg:text-8xl text-white tracking-wide leading-none">
            ACADEMY AWARDS
          </h1>
        </div>

        {/* Floating all-time scoreboard */}
        <div className="hidden md:flex absolute bottom-24 right-10 z-10
                        bg-night-950/70 backdrop-blur-md border border-white/[0.12]
                        rounded-2xl px-6 py-4 gap-6 items-center shadow-still-lg">
          <SideScore who="matt"   wins={mattWins}   total={mattTotal}   leading={mattLead} />
          <span className="w-px h-14 bg-white/10" />
          <SideScore who="dustin" wins={dustinWins} total={dustinTotal} leading={!mattLead && dustinWins > 0} />
          {tieYears > 0 && (
            <>
              <span className="w-px h-14 bg-white/10" />
              <div className="text-center">
                <div className="kicker-cinema">TIEBREAKERS</div>
                <div className="font-display text-3xl text-white leading-none mt-1">{tieYears}</div>
              </div>
            </>
          )}
        </div>
      </FilmStill>

      {/* ── UPCOMING CEREMONY ──────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="kicker-cinema">● Upcoming Ceremony</span>
            <span className="flex-1 h-px bg-night-700" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map(y => (
              <UpcomingCard
                key={y.year}
                year={y}
                isAuthenticated={isAuthenticated}
                deleting={deleting}
                onDelete={() => handleDelete(y.year)}
                onMarkComplete={() => handleMarkComplete(y.year)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── YEAR WALL ──────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pt-6 pb-14">
        <div className="flex items-center justify-between mb-5">
          <span className="kicker">The Wall · {complete.length} Seasons</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
          {complete.map(y => <YearStillCard key={y.year} year={y} poster={posterMap[y.year]} />)}
        </div>
      </section>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────────

function SideScore({ who, wins, total, leading }) {
  const c = who === 'matt' ? 'text-gold-500' : 'text-film-500'
  const bg = who === 'matt' ? 'bg-gold-500' : 'bg-film-500'
  const name = who === 'matt' ? 'HERMZ' : 'DUST'
  return (
    <div className="flex items-center gap-3">
      <span className={`block w-1.5 h-12 rounded-sm ${bg} ${leading ? '' : 'opacity-40'}`} />
      <div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[9px] tracking-cinema ${c}`}>{name}</span>
          {leading && <span className={`font-mono text-[8px] tracking-cinema ${c}
                                        px-1.5 py-px rounded bg-current/15`}>● LEADING</span>}
        </div>
        <div className={`font-display text-4xl text-white leading-none mt-1 tracking-wide`}>
          {wins}<span className="text-gray-500 text-base ml-1.5 font-mono">WINS</span>
        </div>
        <div className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1">
          {total} correct all-time
        </div>
      </div>
    </div>
  )
}

function UpcomingCard({ year: y, isAuthenticated, deleting, onDelete, onMarkComplete }) {
  const meta = OSCAR_STATUS_META[y.status] || OSCAR_STATUS_META.upcoming
  return (
    <div className="card border-2 border-dashed border-gold-500/40 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-display text-3xl text-gold-400 tracking-wide leading-none">
            {y.year}
          </span>
          <p className="font-mono text-[10px] tracking-kicker text-gray-400 mt-2">
            {shortCeremony(y.ceremony_name).toUpperCase()}
          </p>
          {formatDate(y.ceremony_name) && (
            <p className="font-sans text-sm text-gray-400 mt-0.5">{formatDate(y.ceremony_name)}</p>
          )}
        </div>
        <span className={`font-mono text-[10px] tracking-kicker px-2 py-1 rounded-full border ${meta.chip}`}>
          {meta.label}
        </span>
      </div>

      {y.status === 'ballots' && isAuthenticated && (
        <Link to="/oscars/ballot" className="btn-gold text-xs text-center py-2">
          🗳 Fill My Ballot →
        </Link>
      )}
      {y.status === 'locked' && isAuthenticated && (
        <Link to="/oscars/reveal" className="btn-gold text-xs text-center py-2">
          🎭 The Reveal Ceremony →
        </Link>
      )}
      <Link to={`/oscars/${y.year}`} className="btn-ghost text-xs text-center py-2">
        {y.status === 'revealed' ? 'View Ceremony / Set Winners →' : 'View Nominees →'}
      </Link>

      {isAuthenticated && (
        <div className="flex gap-2 pt-2 border-t border-night-700/60">
          {y.status === 'revealed' && (
            <button
              onClick={onMarkComplete}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40
                         text-emerald-400 font-medium hover:bg-emerald-500/20 transition-colors"
            >
              ✓ Mark Complete
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className={`text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30
                       text-red-400 font-medium hover:bg-red-500/15 transition-colors disabled:opacity-50 ${
                         y.status === 'revealed' ? '' : 'flex-1'
                       }`}
          >
            🗑 Delete Year
          </button>
        </div>
      )}
    </div>
  )
}

function YearStillCard({ year: y, poster }) {
  const mattScore   = y.matt_correct   || 0
  const dustinScore = y.dustin_correct || 0
  const isTie       = y.tiebreaker_used
  const mattWon     = y.winner === 'matt'
  const dustinWon   = y.winner === 'dustin'

  return (
    <Link to={`/oscars/${y.year}`} className="block group">
      <FilmStill
        src={poster}
        title={`Hermz and D Oscar ${y.year}`}
        hue={yearHue(y.year)}
        mood={mattWon ? 'warm' : 'cool'}
        className="w-full aspect-[3/4] rounded-lg border border-white/10 shadow-still
                   group-hover:border-gold-500/60 group-hover:-translate-y-0.5 transition-all"
      >
        {/* Bottom-up scrim — taller gradient so overlay text pops without blocking poster */}
        <div className="absolute inset-0" style={{background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 35%, transparent 60%)'}} />

        {/* Top winner color bar — cyan for tiebreaker, gold/blue otherwise */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: isTie ? '#22D3EE' : mattWon ? '#E0A22F' : dustinWon ? '#5B6CFF' : 'transparent' }}
        />

        <div className="absolute inset-0 p-3 flex flex-col justify-between z-10">
          {/* Year + TB chip */}
          <div className="flex items-start justify-between">
            <span className="font-display text-3xl text-white tracking-wide leading-none drop-shadow-lg">
              {y.year}
            </span>
            {isTie && (
              <span className="font-mono text-[9px] tracking-cinema text-cyan-300
                               px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/60 font-bold">
                ◆ TB
              </span>
            )}
          </div>

          {/* Bottom: single compact row — scores inline with winner */}
          <div className="flex items-center justify-between gap-1">
            <div className={`font-mono text-[11px] tracking-wide font-semibold uppercase leading-none
              ${isTie ? 'text-cyan-300' : mattWon ? 'text-gold-400' : dustinWon ? 'text-film-400' : 'text-gray-400'}`}>
              ● {mattWon ? 'Hermz' : dustinWon ? 'Dust' : '–'}
            </div>
            <div className="flex items-center gap-1">
              <YearScoreChip score={mattScore}   who="matt"   winner={mattWon} />
              <span className="text-gray-600 text-[10px]">·</span>
              <YearScoreChip score={dustinScore} who="dustin" winner={dustinWon} />
            </div>
          </div>
        </div>
      </FilmStill>
    </Link>
  )
}

function YearScoreChip({ score, who, winner }) {
  const bg = winner
    ? (who === 'matt' ? 'bg-gold-500' : 'bg-film-500')
    : 'bg-black/50'
  const text = winner ? 'text-night-950 font-bold' : 'text-white/70'
  return (
    <div className={`px-2 py-0.5 rounded text-center ${bg} border ${winner ? 'border-current' : 'border-white/[0.08]'}`}>
      <span className={`font-display text-base leading-none tracking-wide ${text}`}>{score}</span>
    </div>
  )
}
