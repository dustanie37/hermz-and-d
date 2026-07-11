import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCategory } from '../../lib/oscarCategories'
import OscarIcon from '../../components/OscarIcon'
import FilmStill from '../../components/FilmStill'

// ── Wikidata nominee fetch (mirrors oscar_noms_fetch.py CATEGORY_NORM + QID_OVERRIDE) ──

const WIKIDATA_URL = 'https://query.wikidata.org/sparql'

/* Category normalisation moved to src/lib/oscarCategories.js (2026-07-03) —
   shared with MoviesOscarBackfill.jsx. Edit it THERE, never inline. */

async function fetchWikidataNominees(ceremonyYear) {
  const sparql = `
SELECT ?entityLabel ?awardUri ?awardLabel WHERE {
  ?ceremony wdt:P31 wd:Q4688419 .
  ?ceremony wdt:P585 ?date .
  FILTER(YEAR(?date) = ${ceremonyYear})

  {
    ?entity p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    ?stmt pq:P805 ?ceremony .
  } UNION {
    ?entity p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    ?stmt pq:P805 ?ceremony .
  }

  ?award wdt:P31 wd:Q19020 .
  BIND(str(?award) AS ?awardUri)

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
    ?entity rdfs:label ?entityLabel .
  }
}
ORDER BY ?awardLabel ?entityLabel
`
  const url  = `${WIKIDATA_URL}?query=${encodeURIComponent(sparql)}&format=json`
  const resp = await fetch(url, {
    headers: {
      'Accept':     'application/sparql-results+json',
      'User-Agent': 'HermzAndDMoviesApp/2.0 (film ranking app; contact: bard37@gmail.com)',
    },
  })
  if (!resp.ok) throw new Error(`Wikidata ${resp.status}: ${resp.statusText}`)
  const data = await resp.json()
  const results = {}
  for (const b of (data?.results?.bindings || [])) {
    const entityLabel = b.entityLabel?.value || ''
    const awardLabel  = b.awardLabel?.value  || ''
    const awardUri    = b.awardUri?.value    || ''
    if (!entityLabel || entityLabel.startsWith('Q')) continue
    const canon = normalizeCategory(awardLabel, awardUri)
    if (!canon) continue
    if (!results[canon]) results[canon] = new Set()
    results[canon].add(entityLabel)
  }
  return Object.fromEntries(
    Object.entries(results).map(([cat, names]) => [cat, [...names].sort()])
  )
}

// ── step indicator ──────────────────────────────────────────────────────────
// Guesses are no longer entered here (Phase 13b) — each player fills their own
// private ballot at /oscars/ballot once nominees are saved.
const STEP_LABELS = ['Ceremony Setup', 'Nominees']

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const current = n === step
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${current ? 'opacity-100' : done ? 'opacity-80' : 'opacity-30'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                current ? 'bg-gold-500 border-gold-400 text-night-950' :
                done    ? 'bg-emerald-500 border-emerald-400 text-night-950' :
                          'bg-night-700 border-night-600 text-gray-500'
              }`}>
                {done ? '✓' : n}
              </div>
              <span className={`font-mono text-[11px] tracking-kicker uppercase hidden sm:block ${current ? 'text-white' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-night-600 mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

// ── main component ──────────────────────────────────────────────────────────
export default function OscarsNewYear() {
  const navigate = useNavigate()

  const [step,         setStep]         = useState(1)
  const [yearNum,      setYearNum]      = useState('')
  const [ceremonyName, setCeremonyName] = useState('')
  const [ceremonyDate, setCeremonyDate] = useState('')
  const [yearId,       setYearId]       = useState(null)
  const [categories,   setCategories]   = useState([])
  const [nominees,     setNominees]     = useState({})
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)

  const [wdFetching, setWdFetching] = useState(false)
  const [wdResult,   setWdResult]   = useState(null)
  const [wdMessage,  setWdMessage]  = useState('')

  async function handleCreateYear(e) {
    e.preventDefault()
    setError(null)
    const yr = parseInt(yearNum, 10)
    if (!yr || yr < 2000 || yr > 2100) { setError('Enter a valid year (2000–2100).'); return }
    if (!ceremonyName.trim()) { setError('Enter a ceremony name.'); return }

    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('oscar_years').select('id').eq('year', yr).maybeSingle()
      if (existing) { setError(`${yr} already exists. Edit it at /oscars/${yr}.`); setSaving(false); return }

      const { data: newYear, error: insErr } = await supabase
        .from('oscar_years')
        .insert({
          year: yr, ceremony_name: ceremonyName.trim(),
          ceremony_date: ceremonyDate || null,
          winner: 'pending', tiebreaker_used: false, status: 'upcoming',
        })
        .select().single()
      if (insErr) throw insErr
      setYearId(newYear.id)

      const { data: allCats, error: catErr } = await supabase
        .from('oscar_categories').select('*').order('display_order')
      if (catErr) throw catErr

      const activeCats = allCats.filter(c => {
        const from = c.active_from ?? 0
        const until = c.active_until ?? 9999
        return yr >= from && yr <= until
      })
      setCategories(activeCats)

      const initNoms = {}
      activeCats.forEach(c => {
        const slots = c.name === 'Best Picture' ? 10 : 5
        initNoms[c.id] = Array(slots).fill('')
      })
      setNominees(initNoms)
      setStep(2)
      setWdResult(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFetchFromWikidata() {
    setWdFetching(true); setWdResult(null); setWdMessage('')
    const yr = parseInt(yearNum, 10)
    try {
      const nomsByCategory = await fetchWikidataNominees(yr)
      const categoryNames = Object.keys(nomsByCategory)
      if (categoryNames.length === 0) {
        setWdResult('empty')
        setWdMessage(`No nominee data found on Wikidata for the ${yr} ceremony yet. Enter nominees manually below.`)
        setWdFetching(false)
        return
      }
      let filled = 0
      const newNominees = { ...nominees }
      for (const cat of categories) {
        const wdNoms = nomsByCategory[cat.name] || []
        if (wdNoms.length === 0) continue
        const maxSlots = cat.name === 'Best Picture' ? 10 : 8
        const padded = [...wdNoms]
        while (padded.length < (cat.name === 'Best Picture' ? 10 : 5)) padded.push('')
        newNominees[cat.id] = padded.slice(0, maxSlots)
        filled++
      }
      setNominees(newNominees)
      setWdResult('ok')
      setWdMessage(`Pre-filled ${filled} of ${categories.length} categories from Wikidata. Review below.`)
    } catch (err) {
      setWdResult('error')
      setWdMessage(`Wikidata fetch failed: ${err.message}. Enter nominees manually below.`)
    } finally {
      setWdFetching(false)
    }
  }

  function updateNominee(catId, idx, value) {
    setNominees(prev => ({ ...prev, [catId]: prev[catId].map((v, i) => i === idx ? value : v) }))
  }
  function addNomineeSlot(catId) {
    setNominees(prev => ({ ...prev, [catId]: [...prev[catId], ''] }))
  }
  function removeNomineeSlot(catId, idx) {
    setNominees(prev => ({ ...prev, [catId]: prev[catId].filter((_, i) => i !== idx) }))
  }

  async function handleSaveNominees(e) {
    e.preventDefault()
    setError(null); setSaving(true)
    try {
      const rows = []
      categories.forEach(cat => {
        (nominees[cat.id] || []).forEach((name, idx) => {
          if (name.trim()) rows.push({ year_id: yearId, category_id: cat.id, nominee_name: name.trim(), is_winner: false, display_order: idx })
        })
      })
      if (rows.length === 0) { setError('Enter at least one nominee before continuing.'); setSaving(false); return }
      const { error: insErr } = await supabase.from('oscar_nominees').insert(rows)
      if (insErr) throw insErr
      // Nominees are in — open the private ballots (Phase 13b)
      const { error: stErr } = await supabase
        .from('oscar_years').update({ status: 'ballots' }).eq('id', yearId)
      if (stErr) throw stErr
      navigate('/oscars/ballot')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Compact hero */}
      <FilmStill title="Hermz and D New Year Setup" hue={36} mood="cool"
                 className="w-full h-[180px] sm:h-[220px]">
        <div className="absolute inset-0 scrim-bottom" />
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/oscars" className="font-mono text-[11px] tracking-kicker text-gold-500
                                          hover:text-gold-400 transition-colors flex items-center gap-2">
              <OscarIcon size={12} /> OSCARS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white">NEW YEAR</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-white tracking-wide leading-none">
            ADD NEW CEREMONY
          </h1>
          <p className="font-serif italic text-gray-400 mt-2 text-base">
            Set up nominees for an upcoming Academy Awards — then fill your ballots privately.
          </p>
        </div>
      </FilmStill>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
        <StepIndicator step={step} />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleCreateYear} className="card max-w-lg">
            <h2 className="font-display text-xl text-white tracking-wide mb-5">CEREMONY DETAILS</h2>
            <div className="space-y-4">
              <Field label="Oscar Year" required>
                <input type="number" value={yearNum} onChange={e => setYearNum(e.target.value)}
                       placeholder="e.g. 2027" min="2000" max="2100" className="input w-full" required />
                <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-1">
                  CEREMONY HELD YEAR · USED TO FETCH NOMINEES FROM WIKIDATA
                </p>
              </Field>
              <Field label="Ceremony Name" required>
                <input type="text" value={ceremonyName} onChange={e => setCeremonyName(e.target.value)}
                       placeholder="e.g. The 99th Academy Awards - March 2, 2027"
                       className="input w-full" required />
              </Field>
              <Field label="Ceremony Date" optional>
                <input type="date" value={ceremonyDate} onChange={e => setCeremonyDate(e.target.value)} className="input w-full" />
              </Field>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Link to="/oscars" className="btn-ghost text-sm">Cancel</Link>
              <button type="submit" disabled={saving} className="btn-gold text-sm px-5">
                {saving ? 'Creating…' : 'Create Year →'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form onSubmit={handleSaveNominees}>
            <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-400 max-w-lg">
                Enter nominees for each category, or fetch them automatically from Wikidata.
                Saving opens both players' private ballots — you each pick on your own.
              </p>
              <button type="submit" disabled={saving} className="btn-gold text-sm px-5">
                {saving ? 'Saving…' : '🗳 Save Nominees & Open Ballots'}
              </button>
            </div>

            <div className="card mb-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-display text-lg text-white tracking-wide mb-1">AUTO-IMPORT FROM WIKIDATA</p>
                  <p className="text-xs text-gray-400">
                    Fetches all nominees for the {yearNum} ceremony and pre-fills the inputs below.
                  </p>
                </div>
                <button type="button" onClick={handleFetchFromWikidata} disabled={wdFetching}
                        className="btn-cinema text-sm flex items-center gap-2 shrink-0">
                  {wdFetching ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Fetching…
                    </>
                  ) : (<>🌐 Fetch from Wikidata</>)}
                </button>
              </div>

              {wdResult && (
                <div className={`mt-3 px-3 py-2.5 rounded-lg text-sm border ${
                  wdResult === 'ok'    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40' :
                  wdResult === 'empty' ? 'bg-cinema-500/10 text-cinema-400 border-cinema-500/40' :
                                         'bg-red-500/10 text-red-400 border-red-500/40'
                }`}>
                  {wdResult === 'ok' && <span className="font-semibold">✓ </span>}
                  {wdMessage}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {categories.map(cat => (
                <CategoryNomineesCard
                  key={cat.id} category={cat} nominees={nominees[cat.id] || []}
                  onUpdate={(idx, val) => updateNominee(cat.id, idx, val)}
                  onAdd={() => addNomineeSlot(cat.id)}
                  onRemove={idx => removeNomineeSlot(cat.id, idx)}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost text-sm">← Back</button>
              <button type="submit" disabled={saving} className="btn-gold text-sm px-5">
                {saving ? 'Saving…' : '🗳 Save Nominees & Open Ballots'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
function Field({ label, required, optional, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
        {optional && <span className="text-gray-500 font-normal ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  )
}

function CategoryNomineesCard({ category, nominees, onUpdate, onAdd, onRemove }) {
  const [open, setOpen] = useState(true)
  const filled = nominees.filter(n => n.trim()).length
  return (
    <div className="card p-0 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-night-700/40 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-kicker text-white uppercase">{category.name}</span>
          {filled > 0 && (
            <span className="font-mono text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
              {filled}
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-night-700">
          <div className="space-y-2">
            {nominees.map((nom, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-500 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                <input type="text" value={nom} onChange={e => onUpdate(idx, e.target.value)}
                       placeholder={`Nominee ${idx + 1}`} className="input text-sm py-1.5 flex-1" />
                {nominees.length > 1 && (
                  <button type="button" onClick={() => onRemove(idx)}
                          className="text-gray-500 hover:text-red-400 transition-colors text-sm flex-shrink-0">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {nominees.length < (category.name === 'Best Picture' ? 10 : 8) && (
            <button type="button" onClick={onAdd}
                    className="mt-2 text-xs text-gold-400 hover:text-gold-300 transition-colors">
              + Add nominee
            </button>
          )}
        </div>
      )}
    </div>
  )
}

