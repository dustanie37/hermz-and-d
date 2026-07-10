import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PODCAST_NAME, PODCAST_TAGLINE, STATUS_META, epTitle } from '../../lib/podcast'

function MicIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || STATUS_META.planned
  return (
    <span className="shrink-0 flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      <span className={`hidden sm:inline font-mono text-[9px] tracking-kicker uppercase ${meta.text}`}>
        {meta.label}
      </span>
    </span>
  )
}

function EpisodeCard({ ep, filmEpCount }) {
  const isIntro = ep.type === 'intro'
  const combinedRank = isIntro ? null : filmEpCount - ep.episode_num + 1
  return (
    <Link
      to={`/podcast/${ep.episode_num}`}
      className="group flex items-center gap-4 px-4 py-3.5 rounded-xl
                 bg-night-800/60 hover:bg-night-700/80
                 border border-white/[0.05] hover:border-cinema-500/30
                 transition-all duration-150"
    >
      {/* Episode number */}
      <div className="shrink-0 w-12 text-right">
        <span className="font-display text-2xl text-cinema-500 leading-none">
          {String(ep.episode_num).padStart(2, '0')}
        </span>
      </div>

      {/* Poster */}
      <div className="shrink-0 w-9 h-[52px] rounded overflow-hidden bg-night-700 border border-white/[0.06]">
        {ep.films?.poster_url ? (
          <img
            src={ep.films.poster_url}
            alt={ep.films.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <MicIcon size={12} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isIntro ? (
          <>
            <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-0.5 uppercase">
              Episode 0 · Introduction
            </p>
            <h3 className="font-display text-xl text-white leading-tight">
              {epTitle(ep).toUpperCase()}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              The origin story — Hermz &amp; D and The Canon
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-0.5 uppercase">
              Ep {String(ep.episode_num).padStart(2, '0')} · 2026 Combined #{combinedRank}
            </p>
            <h3 className="font-display text-xl text-white group-hover:text-cinema-400 transition-colors leading-tight truncate">
              {epTitle(ep).toUpperCase()}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {ep.films?.release_year}
              {ep.films?.director ? ` · ${ep.films.director}` : ''}
            </p>
          </>
        )}
      </div>

      {/* Status + chevron */}
      <StatusChip status={ep.status} />
      <svg
        className="shrink-0 text-night-600 group-hover:text-cinema-500 transition-colors"
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  )
}

// ── Progress dashboard ───────────────────────────────────────────────────────
function Dashboard({ episodes }) {
  const total     = episodes.length
  const recorded  = episodes.filter(e => e.status === 'recorded' || e.status === 'published').length
  const published = episodes.filter(e => e.status === 'published').length
  const nextUp    = episodes.find(e => e.status === 'planned' || e.status === 'prepped')
  const lastRec   = episodes
    .filter(e => e.record_date)
    .sort((a, b) => (b.record_date > a.record_date ? 1 : -1))[0]
  const pct = total > 0 ? Math.round((recorded / total) * 100) : 0

  return (
    <div className="card p-5 sm:p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">

        {/* Next up */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="shrink-0 w-11 h-16 rounded overflow-hidden bg-night-700 border border-white/[0.06]">
            {nextUp?.films?.poster_url ? (
              <img src={nextUp.films.poster_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600"><MicIcon size={14} /></div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-kicker text-gray-600 uppercase mb-0.5">Next up</p>
            {nextUp ? (
              <>
                <Link to={`/podcast/${nextUp.episode_num}`}
                      className="font-display text-lg text-white hover:text-cinema-400 transition-colors leading-tight block truncate">
                  EP {String(nextUp.episode_num).padStart(2, '0')} · {epTitle(nextUp).toUpperCase()}
                </Link>
                <p className={`font-mono text-[10px] tracking-kicker uppercase mt-0.5 ${STATUS_META[nextUp.status].text}`}>
                  {STATUS_META[nextUp.status].label}
                </p>
              </>
            ) : (
              <p className="font-display text-lg text-white leading-tight">ALL EPISODES RECORDED</p>
            )}
          </div>
        </div>

        {/* Counters */}
        <div className="flex items-center gap-6 sm:gap-8 shrink-0">
          <div>
            <p className="font-display text-3xl text-white leading-none">{recorded}<span className="text-gray-600 text-xl">/{total}</span></p>
            <p className="font-mono text-[9px] tracking-kicker text-gray-600 uppercase mt-1">Recorded</p>
          </div>
          <div>
            <p className="font-display text-3xl text-emerald-400 leading-none">{published}</p>
            <p className="font-mono text-[9px] tracking-kicker text-gray-600 uppercase mt-1">Published</p>
          </div>
          {lastRec && (
            <div className="hidden md:block">
              <p className="font-mono text-sm text-gray-300 leading-none mt-1.5">{lastRec.record_date}</p>
              <p className="font-mono text-[9px] tracking-kicker text-gray-600 uppercase mt-2">Last recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 h-px bg-night-700 relative overflow-visible">
        <div className="absolute inset-y-0 left-0 h-px bg-gold-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
             style={{ width: `${pct}%` }} />
      </div>
      <p className="font-mono text-[9px] tracking-kicker text-gray-700 uppercase mt-2 text-right">{pct}% of the canon covered</p>
    </div>
  )
}

export default function PodcastHome() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEpisodes() {
      const { data } = await supabase
        .from('podcast_episodes')
        .select('id, episode_num, type, status, record_date, title_override, films(id, title, poster_url, release_year, director)')
        .order('episode_num', { ascending: true })
      setEpisodes(data || [])
      setLoading(false)
    }
    loadEpisodes()
  }, [])

  const intro       = episodes.find(e => e.type === 'intro')
  const filmEps     = episodes.filter(e => e.type !== 'intro')
  const filmEpCount = filmEps.length

  return (
    <div className="min-h-screen bg-night-950">

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative h-[300px] sm:h-[340px] overflow-hidden flex items-end">

        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-night-900 via-night-950 to-night-950" />

        {/* Scan-line texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,224,217,0.8) 3px, rgba(0,224,217,0.8) 4px)',
          }}
        />

        {/* Ghost mic */}
        <div className="absolute top-8 right-10 sm:right-20 opacity-[0.06] text-cinema-500">
          <MicIcon size={160} />
        </div>

        {/* Teal glow bottom-left */}
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-cinema-600/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-10 w-full">
          <p className="font-mono text-[11px] tracking-kicker text-cinema-500 mb-3 uppercase">
            Hermz &amp; D · Podcast
          </p>
          <h1 className="font-display text-[70px] sm:text-[88px] text-white leading-none tracking-wide">
            {PODCAST_NAME.toUpperCase()}
          </h1>
          <p className="font-serif italic text-gray-400 text-lg mt-1.5">
            {PODCAST_TAGLINE}
          </p>
          {!loading && episodes.length > 0 && (
            <p className="font-mono text-[10px] tracking-kicker text-gray-700 mt-3 uppercase">
              {episodes.length} Episodes · Starting with 2026 #{filmEpCount} · Ending at #1
            </p>
          )}
        </div>
      </section>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <span className="font-mono text-xs text-gray-600">Loading episodes…</span>
          </div>
        ) : (
          <>
            <Dashboard episodes={episodes} />

            <div className="space-y-1.5">
              {/* Episode 0 — pinned intro */}
              {intro && (
                <div className="mb-8">
                  <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-3 uppercase">
                    Where It All Begins
                  </p>
                  <EpisodeCard ep={intro} filmEpCount={filmEpCount} />
                </div>
              )}

              {/* Film episodes — countdown order */}
              <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-3 uppercase">
                The Canon · 2026 Edition
              </p>
              {filmEps.map(ep => (
                <EpisodeCard key={ep.id} ep={ep} filmEpCount={filmEpCount} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
