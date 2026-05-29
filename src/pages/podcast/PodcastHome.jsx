import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

function EpisodeCard({ ep }) {
  const isIntro = ep.episodeNum === 0
  return (
    <Link
      to={`/podcast/${ep.episodeNum}`}
      className="group flex items-center gap-4 px-4 py-3.5 rounded-xl
                 bg-night-800/60 hover:bg-night-700/80
                 border border-white/[0.05] hover:border-cinema-500/30
                 transition-all duration-150"
    >
      {/* Episode number */}
      <div className="shrink-0 w-12 text-right">
        <span className="font-display text-2xl text-cinema-500 leading-none">
          {isIntro ? '00' : String(ep.episodeNum).padStart(2, '0')}
        </span>
      </div>

      {/* Poster */}
      <div className="shrink-0 w-9 h-[52px] rounded overflow-hidden bg-night-700 border border-white/[0.06]">
        {ep.film?.poster_url ? (
          <img
            src={ep.film.poster_url}
            alt={ep.film.title}
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
            <h3 className="font-display text-xl text-white leading-tight">WHO WE ARE</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              The origin story — Hermz & D and The Canon
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-0.5 uppercase">
              Ep {String(ep.episodeNum).padStart(2, '0')} · 2026 Combined #{ep.combinedRank}
            </p>
            <h3 className="font-display text-xl text-white group-hover:text-cinema-400 transition-colors leading-tight truncate">
              {ep.film?.title?.toUpperCase()}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {ep.film?.release_year}
              {ep.film?.director ? ` · ${ep.film.director}` : ''}
            </p>
          </>
        )}
      </div>

      {/* Chevron */}
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

export default function PodcastHome() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEpisodes() {
      const { data: event } = await supabase
        .from('ranking_events')
        .select('id')
        .eq('year', 2026)
        .single()

      if (!event) { setLoading(false); return }

      const { data: rankings } = await supabase
        .from('combined_rankings')
        .select('combined_rank, films(id, title, poster_url, release_year, director)')
        .eq('event_id', event.id)
        .order('combined_rank', { ascending: false })

      const mapped = (rankings || []).map((r, i) => ({
        episodeNum:   i + 1,           // ep 1 = last-ranked film
        combinedRank: r.combined_rank, // rank on the 2026 combined list
        film:         r.films,
      }))

      setEpisodes(mapped)
      setLoading(false)
    }
    loadEpisodes()
  }, [])

  const total = episodes.length

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
            CINEMATRIX
          </h1>
          <p className="font-serif italic text-gray-400 text-lg mt-1.5">
            A deep dive into The Canon, one film at a time.
          </p>
          {!loading && total > 0 && (
            <p className="font-mono text-[10px] tracking-kicker text-gray-700 mt-3 uppercase">
              {total + 1} Episodes · Starting with 2026 #{total} · Ending at #1
            </p>
          )}
        </div>
      </section>

      {/* ── Episode list ────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <span className="font-mono text-xs text-gray-600">Loading episodes…</span>
          </div>
        ) : (
          <div className="space-y-1.5">

            {/* Episode 0 — pinned intro */}
            <div className="mb-8">
              <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-3 uppercase">
                Where It All Begins
              </p>
              <EpisodeCard ep={{ episodeNum: 0, film: null }} />
            </div>

            {/* Film episodes — 2026 combined, lowest rank first */}
            <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-3 uppercase">
              The Canon · 2026 Edition
            </p>
            {episodes.map(ep => (
              <EpisodeCard key={ep.episodeNum} ep={ep} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
