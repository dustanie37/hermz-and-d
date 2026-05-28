import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Tool card ─────────────────────────────────────────────────────────────────

function ToolCard({ to, title, description, tag, accent = 'gold' }) {
  const dot = accent === 'film' ? 'bg-film-500' : 'bg-gold-500'
  return (
    <Link to={to}
      className="group flex items-start gap-4 p-5 rounded-xl
                 bg-night-800 border border-night-600/60
                 hover:border-gold-500/60 hover:-translate-y-0.5 transition-all">
      <span className={`mt-2 w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="font-display text-lg text-white tracking-wide leading-none
                          group-hover:text-gold-400 transition-colors">
            {title}
          </h3>
          {tag && (
            <span className="font-mono text-[9px] tracking-cinema text-gold-500
                             px-1.5 py-px rounded bg-gold-500/10 border border-gold-500/30
                             uppercase">
              {tag}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
      <span className="font-mono text-[11px] tracking-kicker text-gray-600 flex-shrink-0 mt-2
                       group-hover:text-gold-400 transition-colors">→</span>
    </Link>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="kicker">{title}</span>
        <span className="flex-1 h-px bg-night-700" />
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { displayName, isDustin } = useAuth()
  const dotColor = isDustin ? 'bg-film-500' : 'bg-gold-500'
  const nameColor = isDustin ? 'text-film-400' : 'text-gold-400'

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Link to="/" className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors">
            ← HOME
          </Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Settings</span>
        </div>
        <h1 className="font-display text-5xl text-white tracking-wide leading-none">
          SETTINGS
        </h1>
        <p className="font-serif italic text-base text-gray-400 mt-3 flex items-center gap-2">
          Signed in as
          <span className={`inline-flex items-center gap-1.5 ${nameColor} font-sans not-italic font-medium`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            {displayName}
          </span>
        </p>
      </div>

      {/* Admin tools — Dustin only */}
      {isDustin && (
        <Section title="Admin Tools">
          <ToolCard
            to="/movies/backfill"
            title="TMDb Actor Backfill"
            description="Fetch up to 10 cast members per film from The Movie Database and save to Supabase. Run once after adding the actor_6–10 columns."
            tag="One-time"
            accent="gold"
          />
          <ToolCard
            to="/movies/oscar-backfill"
            title="Oscar Noms Backfill"
            description="Query Wikidata for each film missing Oscar nomination data and save category-level results to Supabase. Fixes the ~120 films with win/nom counts but no category breakdown."
            accent="film"
          />
        </Section>
      )}

      {/* Pending SQL — Dustin only */}
      {isDustin && (
        <Section title="Pending Supabase Steps">
          <div className="card">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cinema-500 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-display text-lg text-white tracking-wide leading-none mb-2">
                  add_actor_columns.sql
                </h3>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                  Adds <code className="font-mono text-[12px] bg-night-700 text-cinema-400 px-1.5 py-0.5 rounded">actor_6</code> through{' '}
                  <code className="font-mono text-[12px] bg-night-700 text-cinema-400 px-1.5 py-0.5 rounded">actor_10</code> columns to the{' '}
                  <code className="font-mono text-[12px] bg-night-700 text-cinema-400 px-1.5 py-0.5 rounded">films</code> table.
                  Run this in Supabase SQL Editor before using the Actor Backfill tool.
                </p>
                <a
                  href="https://supabase.com/dashboard/project/fpbjpefcrxdgwhautswl/sql"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-cinema text-xs"
                >
                  Open Supabase SQL Editor →
                </a>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Account */}
      <Section title="Account">
        <div className="card flex items-center justify-between">
          <div>
            <p className="font-display text-2xl text-white tracking-wide leading-none">
              {displayName}
            </p>
            <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-2 uppercase">
              {isDustin ? '● Owner' : '● Player'}
            </p>
          </div>
          <span className={`w-2 h-12 rounded-sm ${dotColor}`} />
        </div>
      </Section>

    </div>
  )
}
