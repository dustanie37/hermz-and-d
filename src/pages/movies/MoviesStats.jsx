import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import FilmStill from '../../components/FilmStill'
import { DC, HC, CC, sortTitle } from '../../lib/helpers'
import { setEditions, latestEventYear, SCORE_CATS } from './stats/shared'
import ChartsTab from './stats/ChartsTab'
import AllEventsTab from './stats/AllEventsTab'
import RivalryTab from './stats/RivalryTab'
import ScoresTab from './stats/ScoresTab'
import CrossoverTab from './stats/CrossoverTab'

const TABS = [
  { value: 'charts',    label: 'Charts'      },
  { value: 'allevents', label: 'All Events'  },
  { value: 'rivalry',   label: 'Rivalry'     },
  { value: 'scores',    label: 'Scores'      },
  { value: 'crossover', label: 'Crossover'   },
]

function Loading({ label = 'LOADING…' }) {
  return (
    <div className="py-16 flex items-center justify-center">
      <span className="font-mono text-sm tracking-kicker text-gray-400 animate-pulse">{label}</span>
    </div>
  )
}

// ── MAIN COMPONENT — shell: hero, tab nav, data loading ──────────────────────
export default function MoviesStats() {
  const [searchParams, setSearchParams] = useSearchParams()

  // No explicit ?event= → follow the latest published edition (recomputed after
  // loadMeta reassigns EVENTS_ORDER, so a new edition becomes the default automatically)
  const eventYear = Number(searchParams.get('event')) || latestEventYear()
  const view      = searchParams.get('view') || 'combined'
  const rawTab    = searchParams.get('tab')  || 'charts'
  const tab       = TABS.some(t => t.value === rawTab) ? rawTab : 'charts'

  const [events,   setEvents]   = useState([])
  const [profiles, setProfiles] = useState({})

  // Charts tab
  const [chartsFilms,   setChartsFilms]   = useState([])
  const [chartsLoading, setChartsLoading] = useState(true)
  const [chartsError,   setChartsError]   = useState(null)

  // H2H / Taste Face-Off (all years, for Rivalry tab)
  const [allH2HFilms,   setAllH2HFilms]   = useState({})
  const [allH2HLoading, setAllH2HLoading] = useState(false)

  // All Events tab
  const [allTimeData,    setAllTimeData]    = useState(null)
  const [allTimeLoading, setAllTimeLoading] = useState(true)
  const [rank1Rows,      setRank1Rows]      = useState(null)
  const [rank1Data,      setRank1Data]      = useState(null)

  // Rivalry tab
  const [rivalryData,    setRivalryData]    = useState(null)
  const [rivalryLoading, setRivalryLoading] = useState(false)

  // Scores tab
  const [scoresData,    setScoresData]    = useState(null)
  const [scoresLoading, setScoresLoading] = useState(true)

  // Crossover tab
  const [crossoverData,    setCrossoverData]    = useState(null)
  const [crossoverLoading, setCrossoverLoading] = useState(false)

  // Load meta
  useEffect(() => {
    async function loadMeta() {
      const [{ data: evData }, { data: profData }] = await Promise.all([
        supabase.from('ranking_events').select('id,year,label').eq('status', 'published').order('year'),
        supabase.from('profiles').select('id,username'),
      ])
      // 12g: edition list is DB-driven — new published editions appear everywhere
      setEditions(evData)
      setEvents(evData || [])
      const profMap = {}
      profData?.forEach(p => { profMap[p.username] = p.id })
      setProfiles(profMap)
    }
    loadMeta()
  }, [])

  // Load all-time combined data (+ each player's #1 per edition, for The Podium)
  useEffect(() => {
    async function loadAllTime() {
      setAllTimeLoading(true)
      const [{ data, error }, { data: onesData }] = await Promise.all([
        supabase
          .from('combined_rankings')
          .select(`
            combined_rank, film_id, event_id,
            ranking_events (year),
            films (id, title, release_year, director, writer, omdb_genres, custom_genre_1,
                   actor_1, actor_2, actor_3, actor_4, actor_5,
                   actor_6, actor_7, actor_8, actor_9, actor_10, poster_url)
          `),
        supabase
          .from('individual_rankings')
          .select('film_id, user_id, ranking_events (year), films (id, title)')
          .eq('rank', 1),
      ])
      if (error) { setAllTimeLoading(false); return }
      const filmMap = {}, byFilm = {}, byEvent = {}
      data?.forEach(row => {
        const year = row.ranking_events?.year
        const filmId = row.film_id
        const rank   = row.combined_rank
        if (row.films) filmMap[filmId] = row.films
        if (!byFilm[filmId]) byFilm[filmId] = {}
        byFilm[filmId][year] = rank
        if (!byEvent[year]) byEvent[year] = []
        byEvent[year].push({ filmId, rank })
      })
      setAllTimeData({ filmMap, byFilm, byEvent })
      setAllTimeLoading(false)
      // Each player's #1 per edition — resolved into rank1Data once profiles load
      setRank1Rows(onesData || [])
    }
    loadAllTime()
  }, [])

  // Resolve rank-1 rows into {year: {dust, hermz}} once profiles are known
  useEffect(() => {
    const rows = rank1Rows
    if (!rows || Object.keys(profiles).length === 0 || rank1Data) return
    const dustinId = profiles['dustin'], mattId = profiles['matt']
    const out = {}
    rows.forEach(r => {
      const year = r.ranking_events?.year
      if (!year || !r.films) return
      if (!out[year]) out[year] = {}
      const entry = { filmId: r.films.id, title: r.films.title }
      if (r.user_id === dustinId) out[year].dust = entry
      else if (r.user_id === mattId) out[year].hermz = entry
    })
    setRank1Data(out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, rank1Rows])

  // Load rivalry data (lazy — only when tab is opened)
  useEffect(() => {
    if (tab !== 'rivalry' || Object.keys(profiles).length === 0 || rivalryData) return
    async function loadRivalry() {
      setRivalryLoading(true)
      const dustinId = profiles['dustin']
      const mattId   = profiles['matt']

      const { data } = await supabase
        .from('individual_rankings')
        .select(`
          film_id, user_id, rank, event_id,
          ranking_events (year),
          films (id, title, poster_url, release_year)
        `)
        .not('rank', 'is', null)

      if (!data) { setRivalryLoading(false); return }

      const filmMap  = {}
      const byFilmByYear = {}
      const dustinSet = new Set()
      const mattSet   = new Set()

      data.forEach(row => {
        const filmId = String(row.film_id)
        const year   = row.ranking_events?.year
        if (!year) return
        if (row.films) filmMap[filmId] = row.films

        if (row.user_id === dustinId) {
          dustinSet.add(filmId)
          if (!byFilmByYear[filmId]) byFilmByYear[filmId] = {}
          if (!byFilmByYear[filmId][year]) byFilmByYear[filmId][year] = {}
          byFilmByYear[filmId][year].dustRank = row.rank
        } else if (row.user_id === mattId) {
          mattSet.add(filmId)
          if (!byFilmByYear[filmId]) byFilmByYear[filmId] = {}
          if (!byFilmByYear[filmId][year]) byFilmByYear[filmId][year] = {}
          byFilmByYear[filmId][year].mattRank = row.rank
        }
      })

      // Build gap map — only where both ranked the film in the same event
      const gapsByFilm = {}
      Object.entries(byFilmByYear).forEach(([filmId, years]) => {
        const sharedYears = Object.entries(years).filter(([, r]) => r.dustRank && r.mattRank)
        if (sharedYears.length === 0) return
        gapsByFilm[filmId] = {}
        sharedYears.forEach(([year, ranks]) => {
          gapsByFilm[filmId][Number(year)] = {
            dustRank: ranks.dustRank,
            mattRank: ranks.mattRank,
            gap: ranks.mattRank - ranks.dustRank, // positive = Dust ranked higher
          }
        })
      })

      // Solo picks — ranked by one, never by the other across all events
      const dustOnly = [...dustinSet]
        .filter(id => !mattSet.has(id))
        .map(id => ({ filmId: Number(id), title: filmMap[id]?.title || '?', poster_url: filmMap[id]?.poster_url }))

      const mattOnly = [...mattSet]
        .filter(id => !dustinSet.has(id))
        .map(id => ({ filmId: Number(id), title: filmMap[id]?.title || '?', poster_url: filmMap[id]?.poster_url }))

      const bySortTitle = (a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title))
      dustOnly.sort(bySortTitle)
      mattOnly.sort(bySortTitle)

      setRivalryData({ gapsByFilm, filmMap, dustOnly, mattOnly })
      setRivalryLoading(false)
    }
    loadRivalry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profiles])

  // Load scores data
  useEffect(() => {
    if (Object.keys(profiles).length === 0) return
    async function loadScores() {
      setScoresLoading(true)
      const { data, error } = await supabase
        .from('individual_rankings')
        .select(`
          event_id, user_id,
          score_plot, score_dialogue, score_screenplay, score_production_design,
          score_lead_performance, score_supp_performance, score_direction,
          score_cinematography, score_influence, score_acclaim, score_personal_impact,
          ranking_events (year)
        `)
      if (error) { setScoresLoading(false); return }
      const dustinId = profiles['dustin'], mattId = profiles['matt']
      const raw = {}
      data?.forEach(row => {
        const year   = row.ranking_events?.year
        const userId = row.user_id
        if (!year) return
        if (!raw[year]) raw[year] = {}
        if (!raw[year][userId]) raw[year][userId] = {}
        SCORE_CATS.forEach(cat => {
          const val = row[cat.key]
          if (val != null) {
            if (!raw[year][userId][cat.key]) raw[year][userId][cat.key] = []
            raw[year][userId][cat.key].push(val)
          }
        })
      })
      const result = {}
      Object.entries(raw).forEach(([year, byUser]) => {
        result[Number(year)] = {}
        const avgs = (uid) => {
          if (!byUser[uid]) return {}
          const o = {}
          Object.entries(byUser[uid]).forEach(([k, vs]) => { o[k] = vs.reduce((s, v) => s + v, 0) / vs.length })
          return o
        }
        const counts10 = (uid) => {
          if (!byUser[uid]) return {}
          const o = {}
          SCORE_CATS.forEach(cat => {
            const vs = byUser[uid][cat.key]
            if (!vs) return
            const threshold = cat.key === 'score_personal_impact' ? 20 : 10
            const count = vs.filter(v => v >= threshold).length
            if (count > 0) o[cat.key] = count
          })
          return o
        }
        result[Number(year)].dustin     = avgs(dustinId)
        result[Number(year)].matt       = avgs(mattId)
        result[Number(year)].dustinTens = counts10(dustinId)
        result[Number(year)].mattTens   = counts10(mattId)
      })
      setScoresData(result)
      setScoresLoading(false)
    }
    loadScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles])

  // Load crossover data (lazy)
  useEffect(() => {
    if (tab !== 'crossover' || !allTimeData || crossoverData) return
    async function loadCrossover() {
      setCrossoverLoading(true)
      const byFilmRaw = allTimeData.byFilm
      const filmMapRaw = allTimeData.filmMap
      const totalFilmsOnLists = Object.keys(byFilmRaw).length
      const { data: noms } = await supabase.from('film_oscar_noms').select('film_id, category_name, is_winner').limit(10000)
      const oscarMap = {}
      ;(noms || []).forEach(n => {
        const idStr = String(n.film_id)
        const inLists = Object.prototype.hasOwnProperty.call(byFilmRaw, idStr)
                     || Object.prototype.hasOwnProperty.call(byFilmRaw, n.film_id)
        if (!inLists) return
        if (!oscarMap[idStr]) oscarMap[idStr] = { wins: 0, noms: 0, winCats: [], nomCats: [] }
        oscarMap[idStr].noms++
        if (n.is_winner) {
          oscarMap[idStr].wins++
          if (!oscarMap[idStr].winCats.includes(n.category_name)) oscarMap[idStr].winCats.push(n.category_name)
        } else {
          if (!oscarMap[idStr].nomCats.includes(n.category_name)) oscarMap[idStr].nomCats.push(n.category_name)
        }
      })
      const films = Object.entries(oscarMap).map(([filmId, stats]) => {
        const f = filmMapRaw[filmId] || filmMapRaw[Number(filmId)] || {}
        const ranks = byFilmRaw[filmId] || byFilmRaw[Number(filmId)] || {}
        const rankValues = Object.values(ranks).filter(Boolean)
        return {
          filmId, title: f.title, poster_url: f.poster_url, director: f.director,
          release_year: f.release_year, oscarWins: stats.wins, oscarNoms: stats.noms,
          winCategories: stats.winCats, nomCategories: stats.nomCats,
          combinedRanks: ranks, eventCount: rankValues.length,
          bestCombinedRank: rankValues.length ? Math.min(...rankValues) : null,
        }
      })
      films.sort((a, b) => b.oscarWins - a.oscarWins || (a.bestCombinedRank ?? 999) - (b.bestCombinedRank ?? 999))
      const totalWithNoms = films.length
      const totalWithWins = films.filter(f => f.oscarWins > 0).length
      setCrossoverData({ films, totalWithNoms, totalWithWins, totalFilmsOnLists })
      setCrossoverLoading(false)
    }
    loadCrossover()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, allTimeData])

  // Load H2H data for all years (used by Taste Face-Off on Rivalry tab)
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return
    const dustinId = profiles['dustin']
    const mattId   = profiles['matt']
    const filmFields = `id, title, release_year, omdb_genres, custom_genre_1, custom_genre_2`
    async function loadAllH2H() {
      setAllH2HLoading(true)
      try {
        const results = await Promise.all(
          events.map(async ev => {
            const [dustRes, mattRes] = await Promise.all([
              supabase.from('individual_rankings').select(`films (${filmFields})`).eq('event_id', ev.id).eq('user_id', dustinId),
              supabase.from('individual_rankings').select(`films (${filmFields})`).eq('event_id', ev.id).eq('user_id', mattId),
            ])
            return [ev.year, {
              dustin: (dustRes.data || []).map(r => r.films).filter(Boolean),
              matt:   (mattRes.data || []).map(r => r.films).filter(Boolean),
            }]
          })
        )
        const map = {}
        results.forEach(([yr, data]) => { map[yr] = data })
        setAllH2HFilms(map)
      } finally {
        setAllH2HLoading(false)
      }
    }
    loadAllH2H()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, events])

  // Load charts data (main view only)
  useEffect(() => {
    if (Object.keys(profiles).length === 0 || events.length === 0) return
    const currentEvent = events.find(e => e.year === eventYear)
    if (!currentEvent) return
    setChartsLoading(true); setChartsError(null)
    setChartsFilms([])

    const filmFields = `id, title, release_year, director, writer, omdb_genres, custom_genre_1, custom_genre_2,
                        actor_1, actor_2, actor_3, actor_4, actor_5,
                        actor_6, actor_7, actor_8, actor_9, actor_10`

    async function fetchChartsData() {
      try {
        let res
        if (view === 'combined') {
          res = await supabase.from('combined_rankings').select(`films (${filmFields})`).eq('event_id', currentEvent.id)
        } else {
          const userId = profiles[view]
          if (!userId) throw new Error(`Profile not found for ${view}`)
          res = await supabase.from('individual_rankings').select(`films (${filmFields})`)
            .eq('event_id', currentEvent.id).eq('user_id', userId)
        }
        if (res.error) throw res.error
        setChartsFilms((res.data || []).map(r => r.films).filter(Boolean))
      } catch (e) {
        setChartsError(e.message)
      } finally {
        setChartsLoading(false)
      }
    }
    fetchChartsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYear, view, profiles, events])

  function setTab(t)    { setSearchParams({ event: eventYear, view, tab: t }) }
  function setEvent(yr) { setSearchParams({ event: yr, view, tab }) }
  function setView(v)   { setSearchParams({ event: eventYear, view: v, tab }) }

  const chartColor = view === 'matt' ? HC : view === 'dustin' ? DC : CC

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <FilmStill
        title={`Hermz and D Stats ${eventYear}`}
        hue={view === 'matt' ? 36 : view === 'dustin' ? 234 : 200}
        mood="cool"
        className="w-full h-[300px] sm:h-[340px] print:hidden"
      >
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-sm tracking-kicker text-film-400 hover:text-film-300 transition-colors">← FILMS</Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-sm tracking-kicker text-white uppercase">Stats &amp; Charts</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">STATS &amp; CHARTS</h1>
        </div>
        <div className="absolute top-6 right-6 sm:right-10 z-10">
          <Link to={`/movies/list?event=${eventYear}&view=${view}`} className="btn-ghost text-xs">📋 View Rankings</Link>
        </div>
      </FilmStill>

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 print:py-4">

        {/* Tab nav */}
        <div className="flex flex-wrap gap-1.5 mb-8 print:hidden">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
                    className={tab === t.value ? 'pill-active' : 'pill'}>{t.label}</button>
          ))}
        </div>

        {/* ── CHARTS TAB ───────────────────────────────────────────────────── */}
        {tab === 'charts' && (
          <ChartsTab
            eventYear={eventYear} view={view} setEvent={setEvent} setView={setView}
            films={chartsFilms} loading={chartsLoading} error={chartsError}
            chartColor={chartColor}
          />
        )}

        {/* ── ALL EVENTS TAB ───────────────────────────────────────────────── */}
        {tab === 'allevents' && (
          allTimeLoading ? <Loading label="LOADING ALL-TIME DATA…" />
          : !allTimeData ? <div className="py-8 text-center text-red-400 text-sm">Failed to load all-time data.</div>
          : <AllEventsTab allTimeData={allTimeData} rank1Data={rank1Data} scoresData={scoresData} />
        )}

        {/* ── RIVALRY TAB ──────────────────────────────────────────────────── */}
        {tab === 'rivalry' && (
          rivalryLoading ? <Loading label="LOADING RIVALRY DATA…" />
          : !rivalryData ? <div className="py-8 text-center text-red-400 text-sm">Failed to load rivalry data.</div>
          : <RivalryTab rivalryData={rivalryData} allH2HFilms={allH2HFilms} allH2HLoading={allH2HLoading} />
        )}

        {/* ── SCORES TAB ───────────────────────────────────────────────────── */}
        {tab === 'scores' && (
          scoresLoading ? <Loading label="LOADING SCORE DATA…" />
          : !scoresData ? <div className="py-8 text-center text-red-400 text-sm">Failed to load score data.</div>
          : <ScoresTab scoresData={scoresData} profiles={profiles} events={events} />
        )}

        {/* ── CROSSOVER TAB ────────────────────────────────────────────────── */}
        {tab === 'crossover' && (
          (crossoverLoading || allTimeLoading) ? <Loading label="LOADING CROSSOVER DATA…" />
          : !crossoverData ? <div className="py-8 text-center text-red-400 text-sm">Failed to load crossover data.</div>
          : <CrossoverTab data={crossoverData} allTimeData={allTimeData} profiles={profiles} events={events} />
        )}

      </div>
    </div>
  )
}
