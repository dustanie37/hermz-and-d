import { Link } from 'react-router-dom'
import { DC, HC } from '../../../lib/helpers'

// ── Edition years — live bindings, reassigned from ranking_events (published) ─
// setEditions() runs in MoviesStats loadMeta before any tab renders, so new
// editions appear automatically (12g). The literals are only a pre-load fallback.
export let EVENTS_ORDER = [2001, 2007, 2016, 2026]
export let EVENTS_LABEL = { 2001: "'01", 2007: "'07", 2016: "'16", 2026: "'26" }
export function setEditions(evData) {
  if (!evData?.length) return
  EVENTS_ORDER = evData.map(e => e.year)
  EVENTS_LABEL = Object.fromEntries(evData.map(e => [e.year, `'${String(e.year).slice(2)}`]))
}
export const latestEventYear = () => EVENTS_ORDER[EVENTS_ORDER.length - 1]

export const BUMP_COLORS = [
  HC, DC, '#10B981', '#F43F5E', '#A78BFA',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#14B8A6',
  '#F59E0B', '#3B82F6', '#A855F7', '#22C55E', '#EF4444',
  '#0EA5E9', '#D946EF', '#65A30D', '#DC2626', '#7C3AED',
  '#2563EB', '#DB2777', '#16A34A', '#CA8A04', '#0891B2',
]

export const SCORE_CATS = [
  { key: 'score_lead_performance',  label: 'Lead Perf.',    max: 10 },
  { key: 'score_supp_performance',  label: 'Supp. Perf.',   max: 10 },
  { key: 'score_direction',         label: 'Direction',     max: 10 },
  { key: 'score_cinematography',    label: 'Cinematography',max: 10 },
  { key: 'score_influence',         label: 'Influence',     max: 10 },
  { key: 'score_acclaim',           label: 'Acclaim',       max: 10 },
  { key: 'score_screenplay',        label: 'Screenplay',    max: 10, since: 2007 },
  { key: 'score_production_design', label: 'Prod. Design',  max: 10, since: 2007 },
  { key: 'score_plot',              label: 'Plot',          max: 10, until: 2001 },
  { key: 'score_dialogue',          label: 'Dialogue',      max: 10, until: 2001 },
  { key: 'score_personal_impact',   label: 'Personal Impact', max: 20, normalize: true },
]

// ── helpers ──────────────────────────────────────────────────────────────────
export function normalizeGenre(g) {
  if (g === 'Action' || g === 'Adventure') return 'Action/Adventure'
  return g
}
export function primaryGenre(film) {
  if (film.omdb_genres) return normalizeGenre(film.omdb_genres.split(',')[0].trim())
  return null
}
export function decade(year)   { return year ? Math.floor(year / 10) * 10 : null }
export function decadeLabel(d) { return d ? `${d}s` : 'Unknown' }
export function shortYear(y)   { return `'${String(y).slice(2)}` }

export const TOOLTIP = { background: '#15141E', border: '1px solid #2A2734', borderRadius: 8, fontSize: 12, color: '#F3F4F6' }
export const AXIS = '#9298A6'
export const GRID = '#2A2734'

// ── PANEL HEADER — display card title + optional mono kicker sub ────────────
export function PanelHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="font-display not-italic text-2xl text-white tracking-wide leading-none">{title}</h3>
      {subtitle && <div className="kicker-dim mt-2">{subtitle}</div>}
    </div>
  )
}

// ── EMPTY NOTE — shared empty/none state ─────────────────────────────────────
export function EmptyNote({ children, pad = 'py-4' }) {
  return <p className={`kicker-dim text-center ${pad}`}>{children}</p>
}

// ── H2H BAR — side-by-side stacked comparison ────────────────────────────────
export function H2HBar({ data }) {
  const maxTotal = Math.max(...data.map(d => (d.dustCount || 0) + (d.mattCount || 0)), 1)
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-200 font-medium">{item.label}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm tabular-nums" style={{ color: DC }}>{item.dustCount}</span>
              <span className="font-mono text-xs text-gray-600">·</span>
              <span className="font-mono text-sm tabular-nums" style={{ color: HC }}>{item.mattCount}</span>
            </div>
          </div>
          <div className="h-2 bg-night-700 rounded-full overflow-hidden flex">
            <div className="h-full rounded-l-full"
                 style={{ width: `${((item.dustCount || 0) / maxTotal) * 100}%`, background: DC }} />
            <div className="h-full rounded-r-full"
                 style={{ width: `${((item.mattCount || 0) / maxTotal) * 100}%`, background: HC }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ROSTER LIST — clean numbered rows, no fill bar ───────────────────────────
export function RosterList({ data, color }) {
  if (!data.length) return null
  return (
    <div className="divide-y divide-night-700/40">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-4 py-3 group">
          <span className="font-mono text-sm text-gray-500 w-6 text-right flex-shrink-0">{i + 1}</span>
          <span className="flex-1 text-base text-gray-100 leading-snug">{item.label}</span>
          <span className="font-display text-2xl tracking-wide leading-none flex-shrink-0" style={{ color }}>{item.count}</span>
        </div>
      ))}
    </div>
  )
}

// ── HORIZONTAL BAR CHART — shared base ───────────────────────────────────────
export function HBarChart({ data, color = DC, maxRows }) {
  const rows = maxRows ? data.slice(0, maxRows) : data
  const max  = Math.max(...rows.map(d => d.count), 1)
  return (
    <div className="space-y-2.5">
      {rows.map((item, i) => {
        const pct = (item.count / max) * 100
        return (
          <div key={i} className="flex items-center gap-3 group">
            <span className="font-mono text-xs text-gray-500 w-4 text-right flex-shrink-0">{i + 1}</span>
            <span className="text-sm text-gray-200 w-28 flex-shrink-0 truncate leading-snug">{item.label}</span>
            <div className="flex-1 h-5 bg-night-700/60 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                   style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color}88)`, boxShadow: `0 0 8px ${color}44` }} />
            </div>
            <span className="font-display text-xl leading-none flex-shrink-0 w-7 text-right tabular-nums" style={{ color }}>{item.count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── MOVEMENT CARD — riser/faller rows ────────────────────────────────────────
export function MovementCard({ items, type }) {
  const arrowColor = type === 'riser' ? 'text-emerald-400' : 'text-red-400'
  return (
    <div className="space-y-1.5">
      {items.map((m, i) => (
        <Link key={i} to={`/movies/${m.filmId}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-night-700/40 transition-colors group">
          <span className={`font-display text-2xl tracking-wide w-12 text-center flex-shrink-0 leading-none ${arrowColor}`}>
            {type === 'riser' ? '↑' : '↓'}{Math.abs(m.diff)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-white truncate group-hover:text-film-400 transition-colors">{m.title}</div>
            <div className="font-mono text-sm text-gray-400 mt-0.5 uppercase">
              {shortYear(m.from)} <span className="text-gray-200 font-semibold">#{m.fromRank}</span>
              <span className="text-gray-600 mx-1">→</span>
              {shortYear(m.to)} <span className="text-gray-200 font-semibold">#{m.toRank}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
