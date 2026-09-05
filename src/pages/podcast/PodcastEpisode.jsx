import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DC, HC, CC } from '../../lib/helpers'
import { hydrateAcclaim } from '../../lib/acclaimLists'
import { PODCAST_NAME, STATUS_META, fmtTime, youtubeId, epTitle } from '../../lib/podcast'
import Workbench from './Workbench'
import RunOfShow from './RunOfShow'

// ── constants ────────────────────────────────────────────────────────────────
const EVENTS   = [2001, 2007, 2016, 2026]
const LATEST   = EVENTS[EVENTS.length - 1]

const SCORE_CATS = [
  { key: 'score_lead_performance',  label: 'Lead Performance',       max: 10, years: 'all'              },
  { key: 'score_supp_performance',  label: 'Supporting Performance', max: 10, years: 'all'              },
  { key: 'score_direction',         label: 'Direction',              max: 10, years: 'all'              },
  { key: 'score_screenplay',        label: 'Screenplay',             max: 10, years: [2007,2016,2026]   },
  { key: 'score_cinematography',    label: 'Cinematography',         max: 10, years: 'all'              },
  { key: 'score_production_design', label: 'Production Design',      max: 10, years: [2007,2016,2026]   },
  { key: 'score_influence',         label: 'Influence',              max: 10, years: 'all'              },
  { key: 'score_acclaim',           label: 'Acclaim',                max: 10, years: 'all'              },
  { key: 'score_personal_impact',   label: 'Personal Impact',        max: 20, years: 'all'              },
  { key: 'score_plot',              label: 'Plot',                   max: 10, years: [2001]             },
  { key: 'score_dialogue',          label: 'Dialogue',               max: 10, years: [2001]             },
]

const EXTERNAL_LISTS = [
  { key: 'afi_top100_rank',        label: 'AFI Top 100',            ranked: true  },
  { key: 'afi_comedies_rank',      label: 'AFI Top 100 Comedies',   ranked: true  },
  { key: 'imdb_top250_rank',       label: 'IMDB Top 250',           ranked: true  },
  { key: 'nyt_2000s_rank',         label: 'NYT Best of 2000s',      ranked: true  },
  { key: 'sight_sound_2022_rank',  label: "Sight & Sound '22",      ranked: true  },
  { key: 'variety_comedies_rank',  label: 'Variety Comedies',       ranked: true  },
  { key: 'national_film_registry', label: 'National Film Registry', ranked: false },
]

// ── insight generator (mirrors MovieDetail) ──────────────────────────────────
function generateInsights(film, dustinRows, mattRows, combined, oscarNoms) {
  const insights    = []
  const PRIOR       = EVENTS.slice(0, -1)
  const dustYears   = EVENTS.filter(yr => dustinRows[yr]?.rank)
  const mattYears   = EVENTS.filter(yr => mattRows[yr]?.rank)
  const sharedYears = EVENTS.filter(yr => dustinRows[yr]?.rank && mattRows[yr]?.rank)
  const anyYears    = EVENTS.filter(yr => dustinRows[yr]?.rank || mattRows[yr]?.rank)
  const latestShared = sharedYears[sharedYears.length - 1]
  const dCurrent    = dustinRows[LATEST]?.rank ?? null
  const mCurrent    = mattRows[LATEST]?.rank   ?? null
  const cCurrent    = combined[LATEST]?.combined_rank ?? null
  const eligibleEvents = EVENTS.filter(yr => !film?.release_year || film.release_year <= yr)

  if (dCurrent === 1 && mCurrent === 1) {
    insights.push({ p:10, text:`Both Dust and Hermz have this as their #1 film in ${LATEST} — the same film at the very top of two completely independent lists. That essentially never happens.` })
  } else if (dCurrent === 1) {
    insights.push({ p:10, text:`Dust's #1 film in ${LATEST}. Out of 125 ranked films, this is the one he places above everything else.` })
  } else if (mCurrent === 1) {
    insights.push({ p:10, text:`Hermz's #1 film in ${LATEST}. Out of 125 ranked films, this is the one he places above everything else.` })
  }
  if (cCurrent === 1) {
    insights.push({ p:9, text:`The #1 film on the combined list in ${LATEST}. The aggregate of both personal rankings puts this at the very top of the shared canon.` })
  }

  const dustPriorTop = PRIOR.filter(yr => dustinRows[yr]?.rank === 1)
  const mattPriorTop = PRIOR.filter(yr => mattRows[yr]?.rank === 1)
  const combPriorTop = PRIOR.filter(yr => combined[yr]?.combined_rank === 1)
  if (dustPriorTop.length > 0 && dCurrent !== 1) {
    const yr  = dustPriorTop[dustPriorTop.length - 1]
    const now = dCurrent ? ` It now sits at #${dCurrent} on his list.` : ` It has since dropped off his list entirely.`
    insights.push({ p:9, text:`A former #1 on Dust's list. In ${yr}, this was the film he placed above all others.${now}` })
  }
  if (mattPriorTop.length > 0 && mCurrent !== 1) {
    const yr  = mattPriorTop[mattPriorTop.length - 1]
    const now = mCurrent ? ` It now sits at #${mCurrent} on his list.` : ` It has since dropped off his list entirely.`
    insights.push({ p:9, text:`A former #1 on Hermz's list. In ${yr}, this was the film he placed above all others.${now}` })
  }
  if (combPriorTop.length > 0 && cCurrent !== 1) {
    const yr  = combPriorTop[combPriorTop.length - 1]
    const now = cCurrent ? ` It's now ranked #${cCurrent} on the combined list.` : ` It has since dropped off the combined list entirely.`
    insights.push({ p:8, text:`Once the #1 film on the combined list — in ${yr}, both personal rankings converged enough to put this at the very top.${now}` })
  }

  const dTop5 = dCurrent != null && dCurrent <= 5 && dCurrent > 1
  const mTop5 = mCurrent != null && mCurrent <= 5 && mCurrent > 1
  if (dTop5 && mTop5) {
    insights.push({ p:8, text:`Elite placement on both lists in ${LATEST} — Dust's #${dCurrent} and Hermz's #${mCurrent}. The top five on any personal list is where a film moves from "great" to "defining."` })
  } else if (dTop5) {
    insights.push({ p:5, text:`In Dust's top five in ${LATEST} at #${dCurrent}.` })
  } else if (mTop5) {
    insights.push({ p:5, text:`In Hermz's top five in ${LATEST} at #${mCurrent}.` })
  }

  const dustAll = eligibleEvents.length >= 2 && eligibleEvents.every(yr => dustinRows[yr]?.rank)
  const mattAll = eligibleEvents.length >= 2 && eligibleEvents.every(yr => mattRows[yr]?.rank)
  if (dustAll || mattAll) {
    const span = eligibleEvents.length === 4 ? '25 years' : eligibleEvents.length === 3 ? 'three editions' : 'both editions'
    if (dustAll && mattAll) {
      insights.push({ p:8, text:`On both Dust's and Hermz's lists in every eligible edition. Very few films survive ${span} of re-evaluation and make both personal lists every time.` })
    } else if (dustAll) {
      insights.push({ p:6, text:`On Dust's list in every eligible edition — ${span} of consistent inclusion, which puts it in a very small group.` })
    } else {
      insights.push({ p:6, text:`On Hermz's list in every eligible edition — ${span} of consistent inclusion, which puts it in a very small group.` })
    }
  }

  const dustPat = EVENTS.map(yr => dustinRows[yr]?.rank != null)
  const mattPat = EVENTS.map(yr => mattRows[yr]?.rank != null)
  const checkDrop = (pat, rows, yrs, name) => {
    let dropYr = null, returnYr = null
    for (let i = 1; i < EVENTS.length; i++) {
      if (pat[i-1] && !pat[i] && dropYr === null) dropYr = EVENTS[i]
      if (!pat[i-1] && pat[i] && dropYr !== null && returnYr === null) returnYr = EVENTS[i]
    }
    if (dropYr && returnYr) return { p:7, text:`This film fell off ${name}'s list in ${dropYr} but returned in ${returnYr} at #${rows[returnYr].rank}.` }
    const hadAndLost = pat.some((on, i) => i > 0 && pat[i-1] && !on)
    const everReturned = pat.some((on, i) => i > 1 && on && !pat[i-1] && pat.slice(0,i-1).some(Boolean))
    if (hadAndLost && !everReturned && yrs.length > 0) {
      const lastYr = yrs[yrs.length - 1]
      if (EVENTS.indexOf(lastYr) < EVENTS.length - 1)
        return { p:5, text:`Last appeared on ${name}'s list in ${lastYr} at #${rows[lastYr].rank} — has since dropped off entirely.` }
    }
    return null
  }
  const dDrop = checkDrop(dustPat, dustinRows, dustYears, 'Dust')
  const mDrop = checkDrop(mattPat, mattRows, mattYears, 'Hermz')
  if (dDrop) insights.push(dDrop)
  if (mDrop) insights.push(mDrop)

  if (latestShared) {
    const dR = dustinRows[latestShared].rank
    const mR = mattRows[latestShared].rank
    const gap = Math.abs(dR - mR)
    const fav = dR < mR ? 'Dust' : 'Hermz'
    const oth = dR < mR ? 'Hermz' : 'Dust'
    const fR  = dR < mR ? dR : mR
    const oR  = dR < mR ? mR : dR
    if (gap === 0) {
      insights.push({ p:8, text:`Exact agreement — both ranked this identically at #${dR} in ${latestShared}. That kind of precise consensus between two independent lists is almost unheard of.` })
    } else if (gap >= 40) {
      insights.push({ p:9, text:`One of the most polarizing films in the canon. In ${latestShared}, ${fav} had it at #${fR} while ${oth} placed it at #${oR} — a ${gap}-spot divide.` })
    } else if (gap >= 20) {
      insights.push({ p:7, text:`A film that splits the room. In ${latestShared}, ${fav} ranks it #${fR} while ${oth} has it at #${oR} — ${gap} spots apart.` })
    } else if (gap <= 5) {
      insights.push({ p:6, text:`Unusually close to consensus: ${fav} at #${fR}, ${oth} at #${oR} in ${latestShared} — just ${gap} spot${gap !== 1 ? 's' : ''} apart.` })
    }
  }

  if (dustYears.length > 0 && mattYears.length === 0) {
    const latestD = dustYears[dustYears.length - 1]
    insights.push({ p:7, text:`This is Dust's film. He's ranked it — most recently at #${dustinRows[latestD].rank} in ${latestD} — but Hermz has never included it.` })
  } else if (mattYears.length > 0 && dustYears.length === 0) {
    const latestM = mattYears[mattYears.length - 1]
    insights.push({ p:7, text:`This is Hermz's film. He's ranked it — most recently at #${mattRows[latestM].rank} in ${latestM} — but Dust has never included it.` })
  }

  if (sharedYears.length > 1) {
    const first = sharedYears[0]; const last = sharedYears[sharedYears.length - 1]
    const dDiff = (dustinRows[first]?.rank != null && dustinRows[last]?.rank != null)
      ? dustinRows[first].rank - dustinRows[last].rank : null
    const mDiff = (mattRows[first]?.rank != null && mattRows[last]?.rank != null)
      ? mattRows[first].rank - mattRows[last].rank : null
    if (dDiff !== null && Math.abs(dDiff) >= 20)
      insights.push({ p:5, text:`Dust's ranking has moved ${Math.abs(dDiff)} spots overall — from #${dustinRows[first].rank} in ${first} to #${dustinRows[last].rank} in ${last}.` })
    if (mDiff !== null && Math.abs(mDiff) >= 20)
      insights.push({ p:5, text:`Hermz's ranking has moved ${Math.abs(mDiff)} spots overall — from #${mattRows[first].rank} in ${first} to #${mattRows[last].rank} in ${last}.` })
  }

  const firstAnyEligible = eligibleEvents.find(yr => anyYears.includes(yr))
  const eligibleMissed   = firstAnyEligible ? eligibleEvents.indexOf(firstAnyEligible) : 0
  if (firstAnyEligible && eligibleMissed > 0 && eligibleEvents.length >= 2) {
    const dR = dustinRows[firstAnyEligible]?.rank
    const mR = mattRows[firstAnyEligible]?.rank
    const who = dR && mR ? `both ranked it — Dust at #${dR}, Hermz at #${mR}`
      : dR ? `Dust placed it at #${dR}` : `Hermz placed it at #${mR}`
    insights.push({ p:5, text:`Absent from the first ${eligibleMissed === 1 ? 'eligible edition' : `${eligibleMissed} eligible editions`} — first appeared in ${firstAnyEligible} where ${who}.` })
  }

  const latestSY = [...EVENTS].reverse().find(yr => dustinRows[yr] || mattRows[yr])
  if (latestSY) {
    const dRow = dustinRows[latestSY]; const mRow = mattRows[latestSY]
    const bothPerfect = SCORE_CATS.filter(c => {
      const inYear = c.years === 'all' || c.years.includes(latestSY)
      return inYear && dRow?.[c.key] != null && dRow[c.key] >= c.max && mRow?.[c.key] != null && mRow[c.key] >= c.max
    })
    if (bothPerfect.length > 0)
      insights.push({ p:8, text:`Both gave a perfect score in ${bothPerfect.map(c => c.label).join(' and ')} in ${latestSY}. That level of consensus on a specific category is rare.` })
  }

  return insights.sort((a, b) => b.p - a.p).slice(0, 6).map(x => x.text)
}

// ── helpers ──────────────────────────────────────────────────────────────────
function ScorePill({ value, max = 10 }) {
  if (value == null) return <span className="text-gray-500 text-base font-mono">—</span>
  const color = value >= (max * 0.8) ? 'text-emerald-400' : value >= (max * 0.4) ? 'text-yellow-400' : 'text-red-400'
  return <span className={`font-mono font-semibold text-base ${color}`}>{value}</span>
}

// ── Category score trajectory ────────────────────────────────────────────────
// Scores are plotted as the numerals themselves: vertical position = score
// (normalised to the category max), connected by a thin line in the player's
// colour. Dust sits left of each edition tick, Hermz right, so they never collide.
const CARD_BG   = '#15141E'   // night-800 — knockout halo behind numerals
const GRID      = '#2A2734'   // night-600 — edition guides
const HOLLOW    = '#3a3a55'   // scored edition, no value for this category
const MONO      = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const catInYear = (cat, yr) => cat.years === 'all' || cat.years.includes(yr)

function TrajectoryRow({ cat, editions, dustinRows, mattRows, colW }) {
  const H = 58, PAD_T = 15, PAD_B = 13
  const plotH = H - PAD_T - PAD_B
  const W     = colW * editions.length
  const xOf   = i => colW * i + colW / 2

  const series = [
    { rows: dustinRows, color: DC, dx: -13 },
    { rows: mattRows,   color: HC, dx:  13 },
  ].map(s => {
    const pts = editions.map((yr, i) => {
      if (!catInYear(cat, yr)) return { i, v: null, na: true }
      const v = s.rows[yr]?.[cat.key]
      return { i, v: v ?? null, na: false }
    })
    const segs = []; let run = []
    pts.forEach(p => {
      if (p.v != null) run.push(p)
      else { if (run.length > 1) segs.push(run); run = [] }
    })
    if (run.length > 1) segs.push(run)
    return { ...s, pts, segs }
  })

  // These are all top-100 films — raw scores live in a narrow 7–10 band, so a
  // 0-to-max axis would flatten every line. Fit the axis to the observed range
  // instead, with a floor on the span so a single point of drift can't be
  // dramatised into a cliff. Exact values are printed, so only shape is relative.
  const vals    = series.flatMap(s => s.pts.filter(p => p.v != null).map(p => p.v))
  const minSpan = Math.max(3, cat.max * 0.35)
  let lo = Math.min(...vals), hi = Math.max(...vals)
  const gap = minSpan - (hi - lo)
  if (gap > 0) { lo -= gap / 2; hi += gap / 2 }
  if (lo < 0)       { hi -= lo;             lo = 0 }
  if (hi > cat.max) { lo -= hi - cat.max;   hi = cat.max }
  if (lo < 0) lo = 0
  const yOf = v => PAD_T + plotH * (1 - (v - lo) / (hi - lo || 1))

  return (
    <svg width={W} height={H} className="block shrink-0" aria-hidden="true">
      {editions.map((yr, i) => (
        <line key={yr} x1={xOf(i)} x2={xOf(i)} y1={5} y2={H - 5}
              stroke={GRID} strokeWidth="1" opacity="0.55" />
      ))}
      {series.map((s, si) => s.segs.map((seg, gi) => (
        <polyline key={`l${si}-${gi}`} fill="none" stroke={s.color} strokeWidth="1.5" opacity="0.5"
                  points={seg.map(p => `${xOf(p.i) + s.dx},${yOf(p.v)}`).join(' ')} />
      )))}
      {series.map((s, si) => s.pts.map(p => {
        if (p.na) return null
        if (p.v == null) return (
          <circle key={`c${si}-${p.i}`} cx={xOf(p.i) + s.dx} cy={PAD_T + plotH / 2} r="2.5"
                  fill="none" stroke={HOLLOW} strokeWidth="1" />
        )
        return (
          <text key={`t${si}-${p.i}`} x={xOf(p.i) + s.dx} y={yOf(p.v)}
                textAnchor="middle" dominantBaseline="central"
                fontSize="12" fontWeight="600" fill={s.color}
                stroke={CARD_BG} strokeWidth="4" paintOrder="stroke"
                style={{ fontFamily: MONO }}>
            {p.v}
          </text>
        )
      }))}
    </svg>
  )
}

// Largest first→last swing across every category and both players.
function biggestMove(cats, editions, dustinRows, mattRows) {
  let best = null
  for (const cat of cats) {
    for (const s of [{ name: 'Dust', rows: dustinRows, color: DC },
                     { name: 'Hermz', rows: mattRows,  color: HC }]) {
      const pts = editions
        .filter(yr => catInYear(cat, yr) && s.rows[yr]?.[cat.key] != null)
        .map(yr => ({ yr, v: s.rows[yr][cat.key] }))
      if (pts.length < 2) continue
      const a = pts[0], b = pts[pts.length - 1]
      const d = b.v - a.v
      if (!best || Math.abs(d) > Math.abs(best.d)) best = { cat, ...s, d, from: a }
    }
  }
  return best && best.d !== 0 ? best : null
}

// ── Scorecard readout ────────────────────────────────────────────────────────
// The sentences you'd otherwise type into a run-of-show doc, computed from the
// rows: each list's rank path across editions, the standout streaks, and where
// the two totals actually diverge in the latest shared edition.
function buildReadout(dustinRows, mattRows, combined) {
  const lines = []
  const path = (get) => EVENTS.filter(yr => get(yr) != null).map(yr => ({ yr, r: get(yr) }))
  const arrows = (pts) => pts.map(p => `#${p.r}`).join(' → ')

  const series = [
    { name: 'Combined', color: CC, pts: path(yr => combined[yr]?.combined_rank ?? null) },
    { name: 'Dust',     color: DC, pts: path(yr => dustinRows[yr]?.rank ?? null) },
    { name: 'Hermz',    color: HC, pts: path(yr => mattRows[yr]?.rank ?? null) },
  ]
  for (const s of series) {
    if (!s.pts.length) continue
    const flags = []
    const last = s.pts[s.pts.length - 1]
    if (s.pts.length > 1) {
      const best = Math.min(...s.pts.map(p => p.r))
      if (last.r === best && s.pts.slice(0, -1).some(p => p.r > best)) flags.push('all-time high right now')
      let big = null
      for (let i = 1; i < s.pts.length; i++) {
        const d = s.pts[i - 1].r - s.pts[i].r
        if (!big || Math.abs(d) > Math.abs(big.d)) big = { d, yr: s.pts[i].yr }
      }
      if (big && Math.abs(big.d) >= 5) flags.push(`${big.d > 0 ? 'up' : 'down'} ${Math.abs(big.d)} in ${big.yr}`)
      if (s.pts.every(p => p.r <= 10)) flags.push('top 10 every edition')
    }
    lines.push({ name: s.name, color: s.color, text: `${arrows(s.pts)}${flags.length ? ` — ${flags.join(', ')}` : ''}` })
  }

  // Perfect Personal Impact streaks
  for (const s of [{ name: 'Dust', color: DC, rows: dustinRows }, { name: 'Hermz', color: HC, rows: mattRows }]) {
    const yrs = EVENTS.filter(yr => s.rows[yr]?.score_personal_impact != null)
    if (yrs.length > 1 && yrs.every(yr => s.rows[yr].score_personal_impact === 20))
      lines.push({ name: s.name, color: s.color, text: `Personal Impact 20/20 in all ${yrs.length} editions.` })
  }

  // Where the gap lives — latest edition both scored
  const shared = EVENTS.filter(yr => dustinRows[yr]?.total_score != null && mattRows[yr]?.total_score != null)
  const yr = shared[shared.length - 1]
  if (yr) {
    const d = dustinRows[yr], m = mattRows[yr]
    const gap = d.total_score - m.total_score
    const cats = SCORE_CATS.filter(c => catInYear(c, yr) && d[c.key] != null && m[c.key] != null)
    const diffs = cats.map(c => ({ c, dv: d[c.key], mv: m[c.key], diff: d[c.key] - m[c.key] }))
    const agree = diffs.filter(x => x.diff === 0).length
    const top = [...diffs].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0]
    let text
    if (gap === 0) text = `Identical totals in ${yr} (${d.total_score}) — agree exactly on ${agree} of ${cats.length} categories.`
    else {
      const lead = gap > 0 ? 'Dust' : 'Hermz'
      text = `${lead} is ${Math.abs(gap)} higher in ${yr} (${d.total_score} vs ${m.total_score}).`
      if (top && top.diff !== 0) {
        const share = Math.abs(gap) > 0 ? Math.round(Math.abs(top.diff) / Math.abs(gap) * 100) : null
        text += ` ${top.c.label} (${top.dv} vs ${top.mv}) is the biggest split${share != null && share <= 100 ? ` — ${share}% of the gap` : ''}.`
      }
      text += ` Exact agreement on ${agree} of ${cats.length} categories.`
    }
    lines.push({ name: 'Gap', color: '#9ca3af', text })
  }
  return lines
}

// Inner panel — stats nested inside a run-of-show segment card
function Panel({ label, sub, children }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-night-900/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <h3 className="font-display not-italic text-xl text-white tracking-wide">{label}</h3>
        {sub && <span className="kicker-dim">{sub}</span>}
      </div>
      {children}
    </div>
  )
}

function SectionHeader({ label, sub }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
      <h2 className="font-display text-2xl text-white tracking-wide whitespace-nowrap">{label}</h2>
      {sub && <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase">{sub}</span>}
    </div>
  )
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || STATUS_META.planned
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      <span className={`font-mono text-xs tracking-kicker uppercase ${meta.text}`}>{meta.label}</span>
    </span>
  )
}

// ── Media card (embed + chapters + platform links) ───────────────────────────
function MediaCard({ ep, timestamps }) {
  const [start, setStart] = useState(0)
  const [playKey, setPlayKey] = useState(0)
  const vid = youtubeId(ep.youtube_url)
  if (!vid) return null

  const seek = (s) => { setStart(s); setPlayKey(k => k + 1) }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="aspect-video bg-night-900">
        <iframe
          key={playKey}
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${vid}?start=${start}${playKey > 0 ? '&autoplay=1' : ''}`}
          title={`${PODCAST_NAME} — episode video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="p-5 sm:p-6">
        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <StatusChip status={ep.status} />
          {ep.publish_date && (
            <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase">Published {ep.publish_date}</span>
          )}
          {ep.runtime_minutes != null && (
            <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase">{ep.runtime_minutes} min</span>
          )}
          <span className="flex-1" />
          <span className="flex items-center gap-2">
            {ep.youtube_url && (
              <a href={ep.youtube_url} target="_blank" rel="noreferrer"
                 className="font-mono text-xs tracking-kicker uppercase px-2.5 py-1 rounded-full border border-white/[0.08] text-gray-400 hover:text-red-400 hover:border-red-400/40 transition-colors">
                YouTube ↗
              </a>
            )}
            {ep.spotify_url && (
              <a href={ep.spotify_url} target="_blank" rel="noreferrer"
                 className="font-mono text-xs tracking-kicker uppercase px-2.5 py-1 rounded-full border border-white/[0.08] text-gray-400 hover:text-emerald-400 hover:border-emerald-400/40 transition-colors">
                Spotify ↗
              </a>
            )}
            {ep.apple_url && (
              <a href={ep.apple_url} target="_blank" rel="noreferrer"
                 className="font-mono text-xs tracking-kicker uppercase px-2.5 py-1 rounded-full border border-white/[0.08] text-gray-400 hover:text-cinema-400 hover:border-cinema-400/40 transition-colors">
                Apple ↗
              </a>
            )}
          </span>
        </div>

        {/* Chapters */}
        {timestamps.length > 0 && (
          <div>
            <p className="font-mono text-xs tracking-kicker text-gray-400 uppercase mb-2">Chapters</p>
            <div className="flex flex-wrap gap-1.5">
              {timestamps.map(t => (
                <button key={t.id} onClick={() => seek(t.seconds)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-night-900/70 border border-white/[0.05]
                                   hover:border-cinema-500/40 text-sm text-gray-300 hover:text-cinema-300 transition-all">
                  <span className="font-mono text-xs text-cinema-500">{fmtTime(t.seconds)}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PodcastEpisode() {
  const { episodeNum: episodeNumStr } = useParams()
  const episodeNum = parseInt(episodeNumStr, 10)

  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [ep,         setEp]         = useState(null)   // podcast_episodes row
  const [timestamps, setTimestamps] = useState([])
  const [allEps,     setAllEps]     = useState([])
  const [film,       setFilm]       = useState(null)
  const [dustinRows, setDustinRows] = useState({})
  const [mattRows,   setMattRows]   = useState({})
  const [combined,   setCombined]   = useState({})
  const [oscarNoms,  setOscarNoms]  = useState([])
  const [features,   setFeatures]   = useState([])   // podcast_features library
  const [params,     setParams]     = useSearchParams()
  const mode = params.get('view') === 'record' ? 'record' : 'edit'
  // The site header (nav + sub-nav) is 57px on phones and 94px on desktop —
  // measure it so the sticky mode toggle tucks exactly beneath it.
  const [headerH, setHeaderH] = useState(64)
  useEffect(() => {
    const measure = () => setHeaderH(document.querySelector('header')?.offsetHeight ?? 64)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const setMode = (m) => setParams(m === 'record' ? { view: 'record' } : {}, { replace: true })

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      setFilm(null); setDustinRows({}); setMattRows({}); setCombined({}); setOscarNoms([])

      // 1. Episode row + full episode list (for nav)
      const [
        { data: epRow, error: epErr },
        { data: eps },
        { data: feats },
      ] = await Promise.all([
        supabase.from('podcast_episodes').select('*').eq('episode_num', episodeNum).single(),
        supabase.from('podcast_episodes')
          .select('episode_num, type, status, title_override, films(title)')
          .order('episode_num', { ascending: true }),
        supabase.from('podcast_features').select('*').order('sort_order').order('id'),
      ])
      if (epErr || !epRow) { setError('Episode not found'); setLoading(false); return }
      setEp(epRow)
      setAllEps(eps || [])
      setFeatures(feats || [])

      // 2. Timestamps
      const { data: ts } = await supabase
        .from('podcast_timestamps').select('*')
        .eq('episode_id', epRow.id).order('seconds', { ascending: true })
      setTimestamps(ts || [])

      // 3. Film data (film episodes only)
      if (epRow.type !== 'intro' && epRow.film_id) {
        const [
          { data: filmData,  error: fErr },
          { data: indData,   error: iErr },
          { data: combData,  error: cErr },
          { data: nomData },
        ] = await Promise.all([
          supabase.from('films').select('*').eq('id', epRow.film_id).single(),
          supabase.from('individual_rankings').select('*, profiles(username), ranking_events(year)').eq('film_id', epRow.film_id),
          supabase.from('combined_rankings').select('*, ranking_events(year)').eq('film_id', epRow.film_id),
          supabase.from('film_oscar_noms').select('*').eq('film_id', epRow.film_id).order('is_winner', { ascending: false }).order('category_name'),
        ])
        if (fErr || iErr || cErr) { setError('Failed to load film data'); setLoading(false); return }

        setFilm(await hydrateAcclaim(filmData))
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
      }

      setLoading(false)
    }
    load()
  }, [episodeNumStr]) // eslint-disable-line react-hooks/exhaustive-deps

  const insights = useMemo(
    () => film ? generateInsights(film, dustinRows, mattRows, combined, oscarNoms) : [],
    [film, dustinRows, mattRows, combined, oscarNoms]
  )

  const readout = useMemo(
    () => film ? buildReadout(dustinRows, mattRows, combined) : [],
    [film, dustinRows, mattRows, combined]
  )

  const idx    = allEps.findIndex(e => e.episode_num === episodeNum)
  const prevEp = idx > 0 ? allEps[idx - 1] : null
  const nextEp = idx >= 0 && idx < allEps.length - 1 ? allEps[idx + 1] : null

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-night-950 flex items-center justify-center">
      <span className="font-mono text-sm text-gray-500">Loading episode…</span>
    </div>
  )

  if (error || !ep) return (
    <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-sm">{error || 'Episode not found'}</p>
      <Link to="/podcast" className="btn-ghost text-sm">← Back to {PODCAST_NAME}</Link>
    </div>
  )

  const isIntro = ep.type === 'intro'
  const editionsOn  = film ? EVENTS.filter(yr => dustinRows[yr]?.rank || mattRows[yr]?.rank || combined[yr]?.combined_rank) : []
  const listApps    = film ? EXTERNAL_LISTS.filter(l => l.ranked ? film[l.key] != null : film[l.key] === true) : []
  // Editions where this film was actually scored, and the categories in play
  const scoredEds = EVENTS.filter(yr => SCORE_CATS.some(c =>
    catInYear(c, yr) && (dustinRows[yr]?.[c.key] != null || mattRows[yr]?.[c.key] != null)))
  const scoreCats = SCORE_CATS.filter(c => scoredEds.some(yr =>
    catInYear(c, yr) && (dustinRows[yr]?.[c.key] != null || mattRows[yr]?.[c.key] != null)))
  const topMove   = scoredEds.length > 1 ? biggestMove(scoreCats, scoredEds, dustinRows, mattRows) : null
  const oscarWins        = oscarNoms.filter(n => n.is_winner)
  const oscarNominations = oscarNoms.filter(n => !n.is_winner)
  const genre = film?.omdb_genres?.split(',')[0]?.trim()

  const navLinks = (
    <div className="flex items-center justify-between pt-2">
      {prevEp ? (
        <Link to={`/podcast/${prevEp.episode_num}`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-night-800 border border-white/[0.06]
                     hover:border-cinema-500/30 text-sm text-gray-300 hover:text-cinema-400 transition-all font-mono">
          ← Ep {String(prevEp.episode_num).padStart(2,'0')}
          <span className="hidden sm:inline text-gray-600 truncate max-w-[120px]">· {epTitle(prevEp)}</span>
        </Link>
      ) : <div />}
      {nextEp ? (
        <Link to={`/podcast/${nextEp.episode_num}`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-night-800 border border-white/[0.06]
                     hover:border-cinema-500/30 text-sm text-gray-300 hover:text-cinema-400 transition-all font-mono">
          <span className="hidden sm:inline text-gray-600 truncate max-w-[120px]">{epTitle(nextEp)} ·</span>
          Ep {String(nextEp.episode_num).padStart(2,'0')} →
        </Link>
      ) : (
        <div className="text-sm text-gray-500 font-mono">End of The Canon</div>
      )}
    </div>
  )

  // ── Episode 0 — intro ─────────────────────────────────────────────────────
  if (isIntro) return (
    <div className="min-h-screen bg-night-950">
      <section className="relative h-[300px] sm:h-[340px] overflow-hidden flex items-end">
        <div className="absolute inset-0 bg-gradient-to-br from-night-900 via-night-950 to-night-950"/>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,224,217,0.8) 3px,rgba(0,224,217,0.8) 4px)',
        }}/>
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-10 w-full">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/podcast" className="font-mono text-xs tracking-kicker text-gray-400 hover:text-cinema-500 transition-colors uppercase">
              ← {PODCAST_NAME}
            </Link>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <p className="font-mono text-xs tracking-kicker text-cinema-500 uppercase">Episode 00</p>
            <StatusChip status={ep.status} />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white leading-none">{epTitle(ep).toUpperCase()}</h1>
          <p className="font-sans text-gray-400 text-lg mt-2">
            The origin story — Hermz &amp; D and The Canon they built.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 space-y-8">

        <MediaCard ep={ep} timestamps={timestamps} />

        {/* About this episode */}
        <div className="card p-6">
          <SectionHeader label="ABOUT THIS EPISODE" />
          <p className="text-gray-300 leading-relaxed">
            Before we dig into any film, the very first episode of {PODCAST_NAME} is about us — who Hermz and D
            are, how we've been friends since childhood, and how this obsessive, lovingly over-engineered
            ranking system came to be.
          </p>
          <p className="text-gray-400 leading-relaxed mt-3">
            We'll cover: when we started watching films together, how the first ranking event in 2001 happened,
            what the scoring system looks like and why we built it the way we did, and what The Canon means
            to us after 25+ years of watching and arguing about movies.
          </p>
        </div>

        <Workbench ep={ep} setEp={setEp} timestamps={timestamps} setTimestamps={setTimestamps} />

        {navLinks}
      </div>
    </div>
  )

  // ── Film episode ──────────────────────────────────────────────────────────
  if (!film) return (
    <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-sm">Film data missing for this episode</p>
      <Link to="/podcast" className="btn-ghost text-sm">← Back to {PODCAST_NAME}</Link>
    </div>
  )

  // ── Stats panels — woven into the run of show ─────────────────────────────
  const readoutEl = readout.length > 0 && (
    <Panel label="SCORECARD READOUT" sub="Rank paths & where the totals split">
      <div className="space-y-2">
        {readout.map((l, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="shrink-0 w-[68px] font-mono text-xs tracking-kicker uppercase pt-1" style={{ color: l.color }}>{l.name}</span>
            <p className={`flex-1 leading-relaxed text-gray-200 ${mode === 'record' ? 'text-lg' : 'text-base'}`}>{l.text}</p>
          </div>
        ))}
      </div>
    </Panel>
  )

  const canonEl = (
    <Panel label="IN THE CANON" sub="Ranking history across all editions">
      {editionsOn.length === 0 ? (
        <p className="text-gray-500 text-sm">No ranking data found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left font-mono text-xs tracking-kicker text-gray-400 pb-3 uppercase">Edition</th>
                <th className="text-center font-mono text-xs tracking-kicker pb-3 uppercase" style={{ color: DC }}>Dust</th>
                <th className="text-center font-mono text-xs tracking-kicker pb-3 uppercase" style={{ color: HC }}>Hermz</th>
                <th className="text-center font-mono text-xs tracking-kicker pb-3 uppercase" style={{ color: CC }}>Combined</th>
                <th className="text-right font-mono text-xs tracking-kicker text-gray-400 pb-3 uppercase">D Score</th>
                <th className="text-right font-mono text-xs tracking-kicker text-gray-400 pb-3 uppercase">H Score</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map(yr => {
                const d = dustinRows[yr]; const m = mattRows[yr]; const c = combined[yr]
                if (!d && !m && !c) return null
                return (
                  <tr key={yr} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-3 font-mono text-sm text-gray-300">{yr} Edition</td>
                    <td className="py-3 text-center">
                      {d?.rank ? <span className="font-mono font-semibold text-base" style={{ color: DC }}>#{d.rank}</span>
                               : <span className="text-gray-500 text-sm">NR</span>}
                    </td>
                    <td className="py-3 text-center">
                      {m?.rank ? <span className="font-mono font-semibold text-base" style={{ color: HC }}>#{m.rank}</span>
                               : <span className="text-gray-500 text-sm">NR</span>}
                    </td>
                    <td className="py-3 text-center">
                      {c?.combined_rank ? <span className="font-mono font-semibold text-base" style={{ color: CC }}>#{c.combined_rank}</span>
                                        : <span className="text-gray-500 text-sm">—</span>}
                    </td>
                    <td className="py-3 text-right"><ScorePill value={d?.total_score} max={90} /></td>
                    <td className="py-3 text-right"><ScorePill value={m?.total_score} max={90} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )

  const oscarEl = oscarNoms.length > 0 ? (
    <Panel
      label="OSCAR STORY"
      sub={`${film.oscar_wins > 0 ? `${film.oscar_wins} win${film.oscar_wins > 1 ? 's' : ''}` : ''} ${film.oscar_nominations > 0 ? `${film.oscar_nominations} nomination${film.oscar_nominations > 1 ? 's' : ''}` : ''}`.trim() || 'Academy Award history'}
    >
      <div className="flex flex-wrap gap-2">
        {oscarWins.map((nom, i) => {
          const label = nom.nominee_name ? `${nom.category_name} — ${nom.nominee_name}` : nom.category_name
          return <span key={i} className="badge-gold flex items-center gap-1 text-sm">🏆 {label}</span>
        })}
        {oscarNominations.map((nom, i) => {
          const label = nom.nominee_name ? `${nom.category_name} — ${nom.nominee_name}` : nom.category_name
          return (
            <span key={i} className="text-sm text-gray-400 px-2.5 py-0.5 rounded-full border border-night-600 bg-night-800">{label}</span>
          )
        })}
      </div>
    </Panel>
  ) : (film.oscar_nominations > 0 || film.oscar_wins > 0) ? (
    <Panel label="OSCAR STORY">
      <p className="text-gray-500 text-sm">
        {film.oscar_wins > 0 ? `${film.oscar_wins} win${film.oscar_wins > 1 ? 's' : ''}` : ''}
        {film.oscar_nominations > 0 ? `, ${film.oscar_nominations} nomination${film.oscar_nominations > 1 ? 's' : ''}` : ''}
        {' '}— detailed category breakdown available via the film page.
      </p>
    </Panel>
  ) : null

  const listsEl = listApps.length > 0 && (
    <Panel label="ON THE LISTS" sub="External critical lists">
      <div className="flex flex-wrap gap-2">
        {listApps.map(l => (
          <span key={l.key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-night-800 border border-white/[0.06] text-sm text-gray-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cinema-500 shrink-0"/>
            {l.label}
            {l.ranked && film[l.key] != null ? <span className="font-mono text-xs text-gray-500">#{film[l.key]}</span> : null}
          </span>
        ))}
      </div>
    </Panel>
  )

  const driftEl = scoreCats.length > 0 && (
    <Panel
      label="SCORE BREAKDOWN"
      sub={scoredEds.length > 1
        ? (topMove
            ? `Biggest move — ${topMove.name} on ${topMove.cat.label}, ${topMove.d > 0 ? '▴' : '▾'}${Math.abs(topMove.d)} since ${topMove.from.yr}`
            : 'Every score held steady across editions')
        : `${scoredEds[0]} Edition`}
    >
      {scoredEds.length > 1 ? (
        <div className="overflow-x-auto -mx-4 px-4 sm:-mx-5 sm:px-5">
          <div className="min-w-[430px]">
            <div className="flex items-end border-b border-white/[0.06] pb-2">
              <div className="w-[126px] sm:w-[150px] shrink-0 flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-kicker uppercase" style={{ color: DC }}>Dust</span>
                <span className="font-mono text-[10px] tracking-kicker uppercase" style={{ color: HC }}>Hermz</span>
              </div>
              <div className="flex shrink-0">
                {scoredEds.map(yr => (
                  <span key={yr} className="w-[76px] text-center font-mono text-xs tracking-kicker text-gray-400">{yr}</span>
                ))}
              </div>
            </div>
            {scoreCats.map(cat => (
              <div key={cat.key} className="flex items-center border-b border-white/[0.04] last:border-0">
                <div className="w-[126px] sm:w-[150px] shrink-0 pr-3">
                  <p className="text-gray-300 text-sm leading-tight">{cat.label}</p>
                  <p className="font-mono text-[10px] text-gray-600">out of {cat.max}</p>
                </div>
                <TrajectoryRow cat={cat} editions={scoredEds} dustinRows={dustinRows} mattRows={mattRows} colW={76} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left font-mono text-xs tracking-kicker text-gray-400 pb-3 uppercase">Category</th>
                <th className="text-center font-mono text-xs tracking-kicker pb-3 uppercase" style={{ color: DC }}>Dust</th>
                <th className="text-center font-mono text-xs tracking-kicker pb-3 uppercase" style={{ color: HC }}>Hermz</th>
                <th className="text-right font-mono text-xs tracking-kicker text-gray-400 pb-3 uppercase">Max</th>
              </tr>
            </thead>
            <tbody>
              {scoreCats.map(cat => {
                const yr = scoredEds[0]
                return (
                  <tr key={cat.key} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2.5 text-gray-300 text-sm">{cat.label}</td>
                    <td className="py-2.5 text-center"><ScorePill value={dustinRows[yr]?.[cat.key]} max={cat.max} /></td>
                    <td className="py-2.5 text-center"><ScorePill value={mattRows[yr]?.[cat.key]} max={cat.max} /></td>
                    <td className="py-2.5 text-right font-mono text-sm text-gray-500">{cat.max}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )

  return (
    <div className="min-h-screen bg-night-950">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative h-[300px] sm:h-[340px] overflow-hidden flex items-end">

        {/* Poster blurred backdrop */}
        {film.poster_url && (
          <div className="absolute inset-0">
            <img src={film.poster_url} alt="" aria-hidden className="w-full h-full object-cover opacity-15 blur-sm scale-105" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/80 to-night-950/50" />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-8 w-full">

          {/* Back + prev/next */}
          <div className="flex items-center justify-between mb-5">
            <Link to="/podcast" className="font-mono text-xs tracking-kicker text-gray-400 hover:text-cinema-500 transition-colors uppercase">
              ← {PODCAST_NAME}
            </Link>
            <div className="flex items-center gap-3">
              {prevEp && (
                <Link to={`/podcast/${prevEp.episode_num}`}
                  className="font-mono text-xs tracking-kicker text-gray-400 hover:text-gray-400 transition-colors">
                  ← Ep {String(prevEp.episode_num).padStart(2,'0')}
                </Link>
              )}
              {nextEp && (
                <Link to={`/podcast/${nextEp.episode_num}`}
                  className="font-mono text-xs tracking-kicker text-gray-400 hover:text-gray-400 transition-colors">
                  Ep {String(nextEp.episode_num).padStart(2,'0')} →
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-end gap-5">
            {/* Poster thumbnail */}
            {film.poster_url && (
              <img
                src={film.poster_url}
                alt={film.title}
                className="hidden sm:block w-[90px] h-[133px] object-cover rounded shadow-still shrink-0"
              />
            )}
            <div>
              <div className="flex items-center gap-4 mb-1.5">
                <p className="font-mono text-xs tracking-kicker text-cinema-500 uppercase">
                  Episode {String(ep.episode_num).padStart(2,'0')} · {PODCAST_NAME}
                </p>
                <StatusChip status={ep.status} />
              </div>
              <h1 className="font-display text-4xl sm:text-5xl text-white leading-tight">
                {film.title.toUpperCase()}
              </h1>
              <p className="text-gray-400 text-base mt-1">
                {film.release_year}
                {film.director ? ` · ${film.director}` : ''}
                {genre ? ` · ${genre}` : ''}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 space-y-8">

        {mode === 'edit' && <MediaCard ep={ep} timestamps={timestamps} />}

        {/* Edit / Recording toggle — sticky so it's reachable mid-scroll */}
        <div className="sticky z-20 -mx-5 sm:-mx-8 px-5 sm:px-8 py-2 bg-night-950/85 backdrop-blur-md border-b border-white/[0.06]"
             style={{ top: headerH }}>
          <div className="flex items-center gap-3">
            <span className="kicker-dim hidden sm:inline">Run of show</span>
            <span className="flex-1" />
            <div className="flex rounded-full border border-white/[0.1] overflow-hidden">
              {[['edit', 'Edit'], ['record', 'Recording']].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)}
                        className={`px-4 py-2 font-mono text-xs tracking-kicker uppercase transition-colors min-h-[44px]
                          ${mode === m ? 'bg-gold-500 text-night-950 font-semibold' : 'text-gray-400 hover:text-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <RunOfShow
          ep={ep} setEp={setEp} film={film} mode={mode}
          insights={insights} features={features} setFeatures={setFeatures}
          combinedRank={combined[LATEST]?.combined_rank ?? null}
          stats={{ readout: readoutEl, canon: canonEl, drift: driftEl, oscar: oscarEl, lists: listsEl }}
        />

        {mode === 'edit' && (
          <Workbench ep={ep} setEp={setEp} timestamps={timestamps} setTimestamps={setTimestamps} />
        )}

        {navLinks}
      </div>
    </div>
  )
}
