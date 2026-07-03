// MoviesDataHealth.jsx — Admin: reconcile Oscar totals vs category rows
//
// Compares films.oscar_nominations / films.oscar_wins (spreadsheet-sourced totals)
// against the per-category rows in film_oscar_noms. Rows with category_name
// 'Special Achievement Award' are excluded from counts (convention: totals are
// competitive categories only — see supabase/oscar_noms_manual_completion.sql).
//
// This check is what caught the phantom-nomination bug; run it after any backfill,
// Wikidata import, or Fix Info edit.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const SA = 'Special Achievement Award'

function StatCard({ label, value, accent = 'text-white' }) {
  return (
    <div className="card px-5 py-4">
      <p className={`font-display text-4xl leading-none ${accent}`}>{value}</p>
      <p className="font-mono text-[10px] tracking-kicker text-gray-500 uppercase mt-2">{label}</p>
    </div>
  )
}

function Delta({ sheet, db }) {
  if (db === sheet) return <span className="text-gray-500">{db}</span>
  const over = db > sheet
  return (
    <span className={over ? 'text-red-400 font-semibold' : 'text-amber-400 font-semibold'}>
      {db} <span className="font-mono text-[10px]">({over ? '+' : ''}{db - sheet})</span>
    </span>
  )
}

export default function MoviesDataHealth() {
  const [films, setFilms] = useState(null)
  const [noms, setNoms] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const [f, n] = await Promise.all([
        supabase.from('films').select('id, title, release_year, oscar_nominations, oscar_wins'),
        supabase.from('film_oscar_noms').select('film_id, category_name, is_winner'),
      ])
      if (f.error || n.error) { setError((f.error || n.error).message); return }
      setFilms(f.data)
      setNoms(n.data)
    }
    load()
  }, [])

  const report = useMemo(() => {
    if (!films || !noms) return null
    const counts = new Map() // film_id → { rows, wins }
    for (const r of noms) {
      if (r.category_name === SA) continue
      const c = counts.get(r.film_id) || { rows: 0, wins: 0 }
      c.rows += 1
      if (r.is_winner) c.wins += 1
      counts.set(r.film_id, c)
    }
    const withNoms = films.filter(f => (f.oscar_nominations || 0) > 0)
    const mismatched = []
    const zeroRows = []
    let matched = 0
    for (const f of withNoms) {
      const c = counts.get(f.id) || { rows: 0, wins: 0 }
      const sn = f.oscar_nominations || 0
      const sw = f.oscar_wins || 0
      if (c.rows === sn && c.wins === sw) { matched += 1; continue }
      const entry = { ...f, dbRows: c.rows, dbWins: c.wins }
      if (c.rows === 0) zeroRows.push(entry)
      else mismatched.push(entry)
    }
    // Films the sheet says have no noms but that have category rows anyway
    const unexpected = films
      .filter(f => !(f.oscar_nominations > 0) && counts.get(f.id)?.rows > 0)
      .map(f => ({ ...f, dbRows: counts.get(f.id).rows, dbWins: counts.get(f.id).wins }))
    const sortT = a => a.title.replace(/^(A|An|The)\s+/i, '')
    mismatched.sort((a, b) => sortT(a).localeCompare(sortT(b)))
    zeroRows.sort((a, b) => sortT(a).localeCompare(sortT(b)))
    unexpected.sort((a, b) => sortT(a).localeCompare(sortT(b)))
    return { total: withNoms.length, matched, mismatched, zeroRows, unexpected }
  }, [films, noms])

  const healthy = report && report.mismatched.length === 0 && report.zeroRows.length === 0

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Link to="/settings" className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors">
            ← SETTINGS
          </Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Data Health</span>
        </div>
        <h1 className="font-display text-5xl text-white tracking-wide leading-none">OSCAR DATA HEALTH</h1>
        <p className="font-serif italic text-base text-gray-400 mt-3">
          Spreadsheet totals vs. category rows — Special Achievement Awards excluded from counts.
        </p>
      </div>

      {error && (
        <div className="card border-red-500/40 text-red-300 text-sm">{error}</div>
      )}

      {!report && !error && (
        <p className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase">Running reconciliation…</p>
      )}

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            <StatCard label="Films with noms" value={report.total} />
            <StatCard label="Matched" value={report.matched} accent="text-emerald-400" />
            <StatCard label="Mismatched" value={report.mismatched.length} accent={report.mismatched.length ? 'text-red-400' : 'text-emerald-400'} />
            <StatCard label="No category rows" value={report.zeroRows.length} accent={report.zeroRows.length ? 'text-amber-400' : 'text-emerald-400'} />
          </div>

          {healthy && (
            <div className="card border-emerald-500/40 mb-10">
              <p className="font-display text-2xl text-emerald-400 tracking-wide leading-none">ALL CLEAR</p>
              <p className="text-sm text-gray-400 mt-2">
                Every film's category rows match its recorded nomination and win totals.
              </p>
            </div>
          )}

          {[
            { key: 'mismatched', title: 'Mismatched Counts', rows: report.mismatched,
              note: 'Category rows exist but disagree with the recorded totals. Red = too many rows, amber = too few. Fix via the film page (Fix Info panel) or re-check the recorded totals.' },
            { key: 'zeroRows', title: 'No Category Breakdown', rows: report.zeroRows,
              note: 'The film has recorded nominations but no category rows at all. Run the Oscar Noms Backfill or add categories via Fix Info.' },
            { key: 'unexpected', title: 'Rows Without Recorded Totals', rows: report.unexpected,
              note: 'Category rows exist but films.oscar_nominations is 0 or empty — the spreadsheet total may be missing. Informational.' },
          ].map(section => section.rows.length > 0 && (
            <div key={section.key} className="mb-10">
              <div className="flex items-center gap-3 mb-2">
                <span className="kicker">{section.title}</span>
                <span className="font-mono text-[10px] text-gray-600">{section.rows.length}</span>
                <span className="flex-1 h-px bg-night-700" />
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">{section.note}</p>
              <div className="card p-0 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-night-700 font-mono text-[10px] tracking-kicker text-gray-500 uppercase">
                      <th className="text-left px-4 py-3">Film</th>
                      <th className="text-right px-4 py-3">Noms (recorded)</th>
                      <th className="text-right px-4 py-3">Noms (rows)</th>
                      <th className="text-right px-4 py-3">Wins (recorded)</th>
                      <th className="text-right px-4 py-3">Wins (rows)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map(f => (
                      <tr key={f.id} className="border-b border-night-700/50 last:border-0 hover:bg-night-700/20">
                        <td className="px-4 py-2.5">
                          <Link to={`/movies/${f.id}`} className="text-gray-200 hover:text-gold-400 transition-colors">
                            {f.title}
                          </Link>
                          <span className="text-gray-600 ml-2 font-mono text-[10px]">{f.release_year}</span>
                        </td>
                        <td className="text-right px-4 py-2.5 text-gray-400">{f.oscar_nominations || 0}</td>
                        <td className="text-right px-4 py-2.5"><Delta sheet={f.oscar_nominations || 0} db={f.dbRows} /></td>
                        <td className="text-right px-4 py-2.5 text-gray-400">{f.oscar_wins || 0}</td>
                        <td className="text-right px-4 py-2.5"><Delta sheet={f.oscar_wins || 0} db={f.dbWins} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
