import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Tool card ─────────────────────────────────────────────────────────────────

function ToolCard({ to, icon, title, description, tag }) {
  return (
    <Link to={to} className="card-hover p-5 flex items-start gap-4">
      <div className="text-2xl shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {tag && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold-100 text-gold-700
                             dark:bg-gold-900/30 dark:text-gold-400 font-medium">
              {tag}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { displayName, isDustin } = useAuth()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 mb-1">
          Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Signed in as <span className="font-medium text-gray-700 dark:text-gray-300">{displayName}</span>
        </p>
      </div>

      {/* Admin tools — Dustin only */}
      {isDustin && (
        <Section title="Admin Tools">
          <ToolCard
            to="/movies/backfill"
            icon="🎭"
            title="TMDb Actor Backfill"
            description="Fetch up to 10 cast members per film from The Movie Database and save to Supabase. Run once after adding the actor_6–10 columns."
            tag="One-time"
          />
        </Section>
      )}

      {/* Pending SQL — Dustin only */}
      {isDustin && (
        <Section title="Pending Supabase Steps">
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">🗄️</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  add_actor_columns.sql
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Adds <code className="bg-stone-100 dark:bg-night-700 px-1 rounded">actor_6</code> through{' '}
                  <code className="bg-stone-100 dark:bg-night-700 px-1 rounded">actor_10</code> columns to the{' '}
                  <code className="bg-stone-100 dark:bg-night-700 px-1 rounded">films</code> table.
                  Run this in Supabase SQL Editor before using the Actor Backfill tool.
                </p>
                <a
                  href="https://supabase.com/dashboard/project/fpbjpefcrxdgwhautswl/sql"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-film-600 dark:text-film-400 hover:underline font-medium"
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
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isDustin ? 'Owner' : 'Player'}
              </p>
            </div>
          </div>
        </div>
      </Section>

    </div>
  )
}
