import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DC, HC, CC } from '../../lib/helpers'
import { hydrateAcclaim } from '../../lib/acclaimLists'

// ── constants ────────────────────────────────────────────────────────────────
const EVENTS   = [2001, 2007, 2016, 2026]

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
  const LATEST      = EVENTS[EVENTS.length - 1]
  const PRIOR       = EVENTS.slice(0, -1)
  const dustYears   = EVENTS.filter(yr => dustinRows[yr]?.rank)
  const mattYears   = EVENTS.filter(yr => mattRows[yr]?.rank)
  const sharedYears = EVENTS.filter(yr => dustinRows[yr]?.rank && mattRows[yr]?.rank)
  const anyYears    = EVENTS.filter(yr => dustinRows[yr]?.rank || mattRows[yr]?.rank)
  const combYears   = EVENTS.filter(yr => combined[yr]?.combined_rank)
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
  if (value == null) return <span className="text-gray-600 text-sm font-mono">—</span>
  const color = value >= (max * 0.8) ? 'text-emerald-400' : value >= (max * 0.4) ? 'text-yellow-400' : 'text-red-400'
  return <span className={`font-mono font-semibold text-sm ${color}`}>{value}</span>
}

function SectionHeader({ label, sub }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <h2 className="font-display text-2xl text-white tracking-wide">{label}</h2>
      {sub && <span className="font-mono text-[10px] tracking-kicker text-gray-600 uppercase">{sub}</span>}
    </div>
  )
}

// ── Episode 0 (intro) ────────────────────────────────────────────────────────
function IntroEpisode({ total }) {
  return (
    <div className="min-h-screen bg-night-950">
      <section className="relative h-[300px] sm:h-[340px] overflow-hidden flex items-end">
        <div className="absolute inset-0 bg-gradient-to-br from-night-900 via-night-950 to-night-950"/>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,224,217,0.8) 3px,rgba(0,224,217,0.8) 4px)',
        }}/>
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-10 w-full">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/podcast" className="font-mono text-[10px] tracking-kicker text-gray-600 hover:text-cinema-500 transition-colors uppercase">
              ← Cinematrix
            </Link>
          </div>
          <p className="font-mono text-[11px] tracking-kicker text-cinema-500 mb-2 uppercase">Episode 00</p>
          <h1 className="font-display text-5xl sm:text-6xl text-white leading-none">WHO WE ARE</h1>
          <p className="font-serif italic text-gray-400 text-lg mt-2">
            The origin story — Hermz & D and The Canon they built.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 space-y-10">

        {/* About this episode */}
        <div className="card p-6">
          <SectionHeader label="ABOUT THIS EPISODE" />
          <p className="text-gray-300 leading-relaxed">
            Before we dig into any film, the very first episode of Cinematrix is about us — who Hermz and D
            are, how we've been friends since childhood, and how this obsessive, lovingly over-engineered
            ranking system came to be.
          </p>
          <p className="text-gray-400 leading-relaxed mt-3">
            We'll cover: when we started watching films together, how the first ranking event in 2001 happened,
            what the scoring system looks like and why we built it the way we did, and what The Canon means
            to us after 25+ years of watching and arguing about movies.
          </p>
        </div>

        {/* Show Notes scaffold */}
        <ShowNotesScaffold episode={0} film={null} nextEpisodeNum={1} />

        {/* Next episode */}
        {total > 0 && (
          <div className="flex justify-end">
            <Link to="/podcast/1"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-night-800 border border-white/[0.06]
                         hover:border-cinema-500/30 text-sm text-gray-400 hover:text-cinema-400 transition-all">
              Episode 01 →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Show Notes Scaffold ──────────────────────────────────────────────────────
function ShowNotesScaffold({ episode, film, dustinRows = {}, mattRows = {}, combined = {}, oscarNoms = [], prevEpisodeNum, nextEpisodeNum }) {
  const isIntro = episode === 0
  const LATEST  = EVENTS[EVENTS.length - 1]
  const dRank   = film ? dustinRows[LATEST]?.rank : null
  const mRank   = film ? mattRows[LATEST]?.rank : null
  const cRank   = film ? combined[LATEST]?.combined_rank : null
  const dScore  = film ? dustinRows[LATEST]?.total_score : null
  const mScore  = film ? mattRows[LATEST]?.total_score : null

  const listAppearances = film ? EXTERNAL_LISTS.filter(l =>
    l.ranked ? film[l.key] != null : film[l.key] === true
  ) : []

  const wins  = oscarNoms.filter(n => n.is_winner)
  const noms  = oscarNoms.filter(n => !n.is_winner)

  return (
    <div className="card p-6 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-5">
        <SectionHeader
          label="SHOW NOTES"
          sub="Template scaffold — expand with your own content"
        />
        <span className="font-mono text-[10px] tracking-kicker text-gray-700 uppercase">Draft</span>
      </div>

      <div className="space-y-5 text-sm">

        {/* Episode header */}
        <div className="border-b border-white/[0.06] pb-5">
          <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-1">HEADER</p>
          <p className="font-semibold text-white">
            {isIntro
              ? 'Episode 00: Who We Are — The Origin of Hermz & D and The Canon'
              : `Episode ${String(episode).padStart(2, '0')}: ${film?.title} (${film?.release_year})`
            }
          </p>
          {!isIntro && film && (
            <p className="text-gray-500 mt-1">Directed by {film.director}{film.writer ? ` · Written by ${film.writer}` : ''}</p>
          )}
        </div>

        {/* Synopsis / Overview */}
        <div className="border-b border-white/[0.06] pb-5">
          <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-2">SYNOPSIS / OVERVIEW</p>
          {isIntro ? (
            <p className="text-gray-500 italic">
              [Write a 1–2 sentence description of the episode here.]
            </p>
          ) : (
            <p className="text-gray-500 italic">
              [Add a 1–2 sentence synopsis of {film?.title} here — what it's about, why it matters.]
            </p>
          )}
        </div>

        {/* Key stats (auto-populated for film episodes) */}
        {!isIntro && film && (
          <div className="border-b border-white/[0.06] pb-5">
            <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-3">KEY STATS</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cRank != null && (
                <div className="bg-night-900 rounded-lg px-3 py-2.5 border border-white/[0.04]">
                  <p className="font-mono text-[9px] tracking-kicker text-gray-600 mb-1">2026 COMBINED</p>
                  <p className="font-display text-xl" style={{ color: CC }}>#{cRank}</p>
                </div>
              )}
              {dRank != null && (
                <div className="bg-night-900 rounded-lg px-3 py-2.5 border border-white/[0.04]">
                  <p className="font-mono text-[9px] tracking-kicker text-gray-600 mb-1">DUST 2026</p>
                  <p className="font-display text-xl" style={{ color: DC }}>#{dRank}</p>
                </div>
              )}
              {mRank != null && (
                <div className="bg-night-900 rounded-lg px-3 py-2.5 border border-white/[0.04]">
                  <p className="font-mono text-[9px] tracking-kicker text-gray-600 mb-1">HERMZ 2026</p>
                  <p className="font-display text-xl" style={{ color: HC }}>#{mRank}</p>
                </div>
              )}
              {film.oscar_wins > 0 && (
                <div className="bg-night-900 rounded-lg px-3 py-2.5 border border-white/[0.04]">
                  <p className="font-mono text-[9px] tracking-kicker text-gray-600 mb-1">OSCAR WINS</p>
                  <p className="font-display text-xl text-gold-500">🏆 {film.oscar_wins}</p>
                </div>
              )}
              {film.acclaim_score != null && (
                <div className="bg-night-900 rounded-lg px-3 py-2.5 border border-white/[0.04]">
                  <p className="font-mono text-[9px] tracking-kicker text-gray-600 mb-1">ACCLAIM SCORE</p>
                  <p className="font-display text-xl text-white">{film.acclaim_score}/10</p>
                </div>
              )}
              {listAppearances.length > 0 && (
                <div className="bg-night-900 rounded-lg px-3 py-2.5 border border-white/[0.04]">
                  <p className="font-mono text-[9px] tracking-kicker text-gray-600 mb-1">ON LISTS</p>
                  <p className="font-display text-xl text-white">{listAppearances.length}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Talking points placeholder */}
        <div className="border-b border-white/[0.06] pb-5">
          <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-2">TALKING POINTS</p>
          <div className="space-y-2 text-gray-500">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-night-600">◻</span>
              <span className="italic">[First discussion point — e.g. initial reactions, first viewing memory]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-night-600">◻</span>
              <span className="italic">[Ranking discussion — why it landed where it did, any surprises]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-night-600">◻</span>
              <span className="italic">[Scoring breakdown — category highlights, where scores diverged]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-night-600">◻</span>
              <span className="italic">[Historical context — how this film fits into its era / genre]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-night-600">◻</span>
              <span className="italic">[Final takes — what this film means to each of us]</span>
            </div>
          </div>
        </div>

        {/* Timestamps placeholder */}
        <div className="border-b border-white/[0.06] pb-5">
          <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-2">TIMESTAMPS</p>
          <div className="space-y-1.5 text-gray-600 font-mono text-xs">
            <p>0:00 — Intro</p>
            <p className="italic text-gray-700">[00:00] — [Section title]</p>
            <p className="italic text-gray-700">[00:00] — [Section title]</p>
            <p className="italic text-gray-700">[00:00] — [Section title]</p>
            <p className="italic text-gray-700">[00:00] — Outro / next episode</p>
          </div>
        </div>

        {/* Links & references */}
        <div className="border-b border-white/[0.06] pb-5">
          <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-2">LINKS &amp; REFERENCES</p>
          {film ? (
            <div className="space-y-1 font-mono text-xs text-gray-500">
              <p>Film page: https://hermz-and-d.vercel.app/movies/{film.id}</p>
              <p>Rankings: https://hermz-and-d.vercel.app/movies/list</p>
              {film.omdb_id && <p>IMDB: https://imdb.com/title/{film.omdb_id}</p>}
              <p className="italic text-gray-700">[Add any other links mentioned in the episode]</p>
            </div>
          ) : (
            <p className="text-gray-600 italic font-mono text-xs">https://hermz-and-d.vercel.app</p>
          )}
        </div>

        {/* Next episode */}
        <div>
          <p className="font-mono text-[10px] tracking-kicker text-gray-600 mb-2">NEXT EPISODE</p>
          {nextEpisodeNum != null ? (
            <p className="text-gray-500 italic">
              Episode {String(nextEpisodeNum).padStart(2, '0')} — [Next film title and teaser line TBD]
            </p>
          ) : (
            <p className="text-gray-500 italic">That's a wrap on The Canon.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PodcastEpisode() {
  const { episodeNum: episodeNumStr } = useParams()
  const navigate = useNavigate()
  const episodeNum = parseInt(episodeNumStr, 10)

  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [film,       setFilm]       = useState(null)
  const [allEps,     setAllEps]     = useState([])   // [{episodeNum, combinedRank, filmId}]
  const [events,     setEvents]     = useState([])
  const [dustinRows, setDustinRows] = useState({})
  const [mattRows,   setMattRows]   = useState({})
  const [combined,   setCombined]   = useState({})
  const [oscarNoms,  setOscarNoms]  = useState([])

  const isIntro = episodeNum === 0

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)

      // 1. Get 2026 event
      const { data: event, error: evErr } = await supabase
        .from('ranking_events')
        .select('id')
        .eq('year', 2026)
        .single()
      if (evErr || !event) { setError('Could not load 2026 ranking event'); setLoading(false); return }

      // 2. Get all 2026 combined rankings (worst first = highest episode numbers first)
      const { data: allCombined } = await supabase
        .from('combined_rankings')
        .select('combined_rank, film_id, films(id, title)')
        .eq('event_id', event.id)
        .order('combined_rank', { ascending: false })

      const eps = (allCombined || []).map((r, i) => ({
        episodeNum:   i + 1,
        combinedRank: r.combined_rank,
        filmId:       r.film_id,
        title:        r.films?.title,
      }))
      setAllEps(eps)

      if (isIntro) { setLoading(false); return }

      // 3. Find film for this episode
      const epData = eps[episodeNum - 1]
      if (!epData) { setError('Episode not found'); setLoading(false); return }

      const filmId = epData.filmId

      // 4. Parallel fetch: film data, ranking events, individual rankings, combined rankings, Oscar noms
      const [
        { data: filmData,  error: fErr },
        { data: evData,    error: eErr },
        { data: indData,   error: iErr },
        { data: combData,  error: cErr },
        { data: nomData },
      ] = await Promise.all([
        supabase.from('films').select('*').eq('id', filmId).single(),
        supabase.from('ranking_events').select('id, year, label').order('year'),
        supabase.from('individual_rankings').select('*, profiles(username), ranking_events(year)').eq('film_id', filmId),
        supabase.from('combined_rankings').select('*, ranking_events(year)').eq('film_id', filmId),
        supabase.from('film_oscar_noms').select('*').eq('film_id', filmId).order('is_winner', { ascending: false }).order('category_name'),
      ])

      if (fErr || eErr || iErr || cErr) {
        setError('Failed to load film data'); setLoading(false); return
      }

      setFilm(await hydrateAcclaim(filmData))
      setEvents(evData || [])
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

      setLoading(false)
    }
    load()
  }, [episodeNumStr])

  const insights = useMemo(
    () => film ? generateInsights(film, dustinRows, mattRows, combined, oscarNoms) : [],
    [film, dustinRows, mattRows, combined, oscarNoms]
  )

  const prevEp = episodeNum > 0 ? episodeNum - 1 : null
  const nextEp = episodeNum < allEps.length ? episodeNum + 1 : null

  const prevTitle = prevEp === 0 ? 'WHO WE ARE' : allEps[prevEp - 1]?.title
  const nextTitle = nextEp ? allEps[nextEp - 1]?.title : null

  // ── Episode 0 — intro ─────────────────────────────────────────────────────
  if (!loading && isIntro) return <IntroEpisode total={allEps.length} />

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-night-950 flex items-center justify-center">
      <span className="font-mono text-xs text-gray-600">Loading episode…</span>
    </div>
  )

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !film) return (
    <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-sm">{error || 'Episode not found'}</p>
      <Link to="/podcast" className="btn-ghost text-sm">← Back to Cinematrix</Link>
    </div>
  )

  const LATEST      = EVENTS[EVENTS.length - 1]
  const editionsOn  = EVENTS.filter(yr => dustinRows[yr]?.rank || mattRows[yr]?.rank || combined[yr]?.combined_rank)
  const listApps    = EXTERNAL_LISTS.filter(l => l.ranked ? film[l.key] != null : film[l.key] === true)
  const oscarWins   = oscarNoms.filter(n => n.is_winner)
  const oscarNominations = oscarNoms.filter(n => !n.is_winner)
  const actors      = [1,2,3,4,5].map(i => film[`actor_${i}`]).filter(Boolean)
  const genre       = film.omdb_genres?.split(',')[0]?.trim()

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
            <Link to="/podcast" className="font-mono text-[10px] tracking-kicker text-gray-600 hover:text-cinema-500 transition-colors uppercase">
              ← Cinematrix
            </Link>
            <div className="flex items-center gap-3">
              {prevEp != null && (
                <Link to={`/podcast/${prevEp}`}
                  className="font-mono text-[10px] tracking-kicker text-gray-600 hover:text-gray-400 transition-colors">
                  ← Ep {String(prevEp).padStart(2,'0')}
                </Link>
              )}
              {nextEp != null && (
                <Link to={`/podcast/${nextEp}`}
                  className="font-mono text-[10px] tracking-kicker text-gray-600 hover:text-gray-400 transition-colors">
                  Ep {String(nextEp).padStart(2,'0')} →
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
              <p className="font-mono text-[11px] tracking-kicker text-cinema-500 mb-1.5 uppercase">
                Episode {String(episodeNum).padStart(2,'0')} · Cinematrix
              </p>
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

        {/* ── In The Canon ── */}
        <div className="card p-6">
          <SectionHeader label="IN THE CANON" sub="Ranking history across all editions" />
          {editionsOn.length === 0 ? (
            <p className="text-gray-600 text-sm italic">No ranking data found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left font-mono text-[10px] tracking-kicker text-gray-600 pb-3 uppercase">Edition</th>
                    <th className="text-center font-mono text-[10px] tracking-kicker pb-3 uppercase" style={{ color: DC }}>Dust</th>
                    <th className="text-center font-mono text-[10px] tracking-kicker pb-3 uppercase" style={{ color: HC }}>Hermz</th>
                    <th className="text-center font-mono text-[10px] tracking-kicker pb-3 uppercase" style={{ color: CC }}>Combined</th>
                    <th className="text-right font-mono text-[10px] tracking-kicker text-gray-600 pb-3 uppercase">D Score</th>
                    <th className="text-right font-mono text-[10px] tracking-kicker text-gray-600 pb-3 uppercase">H Score</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map(yr => {
                    const d = dustinRows[yr]; const m = mattRows[yr]; const c = combined[yr]
                    if (!d && !m && !c) return null
                    return (
                      <tr key={yr} className="border-b border-white/[0.04] last:border-0">
                        <td className="py-3 font-mono text-xs text-gray-400">{yr} Edition</td>
                        <td className="py-3 text-center">
                          {d?.rank ? <span className="font-mono font-semibold text-sm" style={{ color: DC }}>#{d.rank}</span>
                                   : <span className="text-gray-700 text-xs">NR</span>}
                        </td>
                        <td className="py-3 text-center">
                          {m?.rank ? <span className="font-mono font-semibold text-sm" style={{ color: HC }}>#{m.rank}</span>
                                   : <span className="text-gray-700 text-xs">NR</span>}
                        </td>
                        <td className="py-3 text-center">
                          {c?.combined_rank ? <span className="font-mono font-semibold text-sm" style={{ color: CC }}>#{c.combined_rank}</span>
                                            : <span className="text-gray-700 text-xs">—</span>}
                        </td>
                        <td className="py-3 text-right">
                          <ScorePill value={d?.total_score} max={90} />
                        </td>
                        <td className="py-3 text-right">
                          <ScorePill value={m?.total_score} max={90} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Talking Points (Insights) ── */}
        {insights.length > 0 && (
          <div className="card p-6">
            <SectionHeader label="TALKING POINTS" sub="Generated from ranking data" />
            <div className="space-y-3">
              {insights.map((text, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="shrink-0 mt-1 w-5 h-5 rounded-full bg-cinema-500/10 border border-cinema-500/30 flex items-center justify-center">
                    <span className="font-mono text-[9px] text-cinema-500">{i + 1}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
            <Link
              to={`/movies/${film.id}`}
              className="mt-5 inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-cinema-400 transition-colors font-mono tracking-kicker uppercase"
            >
              Full film page →
            </Link>
          </div>
        )}

        {/* ── Oscar Story ── */}
        {oscarNoms.length > 0 && (
          <div className="card p-6">
            <SectionHeader
              label="OSCAR STORY"
              sub={`${film.oscar_wins > 0 ? `${film.oscar_wins} win${film.oscar_wins > 1 ? 's' : ''}` : ''} ${film.oscar_nominations > 0 ? `${film.oscar_nominations} nomination${film.oscar_nominations > 1 ? 's' : ''}` : ''}`.trim() || 'Academy Award history'}
            />
            <div className="flex flex-wrap gap-2">
              {oscarWins.map((nom, i) => {
                const label = nom.nominee_name ? `${nom.category_name} — ${nom.nominee_name}` : nom.category_name
                return (
                  <span key={i} className="badge-gold flex items-center gap-1 text-sm">🏆 {label}</span>
                )
              })}
              {oscarNominations.map((nom, i) => {
                const label = nom.nominee_name ? `${nom.category_name} — ${nom.nominee_name}` : nom.category_name
                return (
                  <span key={i} className="text-sm text-gray-400 px-2.5 py-0.5 rounded-full border border-night-600 bg-night-800">
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        {oscarNoms.length === 0 && (film.oscar_nominations > 0 || film.oscar_wins > 0) && (
          <div className="card p-6">
            <SectionHeader label="OSCAR STORY" />
            <p className="text-gray-500 text-sm">
              {film.oscar_wins > 0 ? `${film.oscar_wins} win${film.oscar_wins > 1 ? 's' : ''}` : ''}
              {film.oscar_nominations > 0 ? `, ${film.oscar_nominations} nomination${film.oscar_nominations > 1 ? 's' : ''}` : ''}
              {' '}— detailed category breakdown available via the film page.
            </p>
          </div>
        )}

        {/* ── On The Lists ── */}
        {listApps.length > 0 && (
          <div className="card p-6">
            <SectionHeader label="ON THE LISTS" sub="External critical lists" />
            <div className="flex flex-wrap gap-2">
              {listApps.map(l => (
                <span key={l.key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-night-800 border border-white/[0.06] text-xs text-gray-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cinema-500 shrink-0"/>
                  {l.label}
                  {l.ranked && film[l.key] != null ? (
                    <span className="font-mono text-[10px] text-gray-600">#{film[l.key]}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Score Breakdown ── */}
        {(dustinRows[LATEST] || mattRows[LATEST]) && (
          <div className="card p-6">
            <SectionHeader label="SCORE BREAKDOWN" sub={`${LATEST} Edition`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left font-mono text-[10px] tracking-kicker text-gray-600 pb-3 uppercase">Category</th>
                    <th className="text-center font-mono text-[10px] tracking-kicker pb-3 uppercase" style={{ color: DC }}>Dust</th>
                    <th className="text-center font-mono text-[10px] tracking-kicker pb-3 uppercase" style={{ color: HC }}>Hermz</th>
                    <th className="text-right font-mono text-[10px] tracking-kicker text-gray-600 pb-3 uppercase">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORE_CATS.filter(cat => {
                    const inYear = cat.years === 'all' || cat.years.includes(LATEST)
                    const d = dustinRows[LATEST]?.[cat.key]; const m = mattRows[LATEST]?.[cat.key]
                    return inYear && (d != null || m != null)
                  }).map(cat => {
                    const d = dustinRows[LATEST]?.[cat.key]
                    const m = mattRows[LATEST]?.[cat.key]
                    return (
                      <tr key={cat.key} className="border-b border-white/[0.04] last:border-0">
                        <td className="py-2.5 text-gray-400 text-xs">{cat.label}</td>
                        <td className="py-2.5 text-center"><ScorePill value={d} max={cat.max} /></td>
                        <td className="py-2.5 text-center"><ScorePill value={m} max={cat.max} /></td>
                        <td className="py-2.5 text-right font-mono text-xs text-gray-700">{cat.max}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Show Notes ── */}
        <ShowNotesScaffold
          episode={episodeNum}
          film={film}
          dustinRows={dustinRows}
          mattRows={mattRows}
          combined={combined}
          oscarNoms={oscarNoms}
          prevEpisodeNum={prevEp}
          nextEpisodeNum={nextEp}
        />

        {/* ── Prev / Next navigation ── */}
        <div className="flex items-center justify-between pt-2">
          {prevEp != null ? (
            <Link to={`/podcast/${prevEp}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-night-800 border border-white/[0.06]
                         hover:border-cinema-500/30 text-xs text-gray-400 hover:text-cinema-400 transition-all font-mono">
              ← Ep {String(prevEp).padStart(2,'0')}
              {prevTitle ? <span className="hidden sm:inline text-gray-600 truncate max-w-[120px]">· {prevTitle}</span> : null}
            </Link>
          ) : <div />}
          {nextEp != null ? (
            <Link to={`/podcast/${nextEp}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-night-800 border border-white/[0.06]
                         hover:border-cinema-500/30 text-xs text-gray-400 hover:text-cinema-400 transition-all font-mono">
              {nextTitle ? <span className="hidden sm:inline text-gray-600 truncate max-w-[120px]">{nextTitle} ·</span> : null}
              Ep {String(nextEp).padStart(2,'0')} →
            </Link>
          ) : (
            <div className="text-xs text-gray-700 font-mono italic">End of The Canon</div>
          )}
        </div>
      </div>
    </div>
  )
}
