import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import OscarIcon from '../../components/OscarIcon'

// ── helpers ───────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Ceremony Setup', 'Nominees', 'Guesses']

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done    = n < step
        const current = n === step
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${current ? 'opacity-100' : done ? 'opacity-70' : 'opacity-30'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0
                ${current ? 'bg-gold-600 border-gold-400 text-white dark:bg-gold-700 dark:border-gold-500'
                : done    ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-stone-200 border-stone-300 text-gray-500 dark:bg-night-700 dark:border-night-600 dark:text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${current ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-8 h-px bg-stone-300 dark:bg-night-600 mx-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function OscarsNewYear() {
  const navigate = useNavigate()

  const [step,          setStep]          = useState(1)
  const [yearNum,       setYearNum]       = useState('')
  const [ceremonyName,  setCeremonyName]  = useState('')
  const [ceremonyDate,  setCeremonyDate]  = useState('')
  const [yearId,        setYearId]        = useState(null)
  const [categories,    setCategories]    = useState([]) // active cats for chosen year
  const [nominees,      setNominees]      = useState({}) // { catId: ['name1', ...] }
  const [guesses,       setGuesses]       = useState({}) // { catId: { matt: '', dustin: '' } }
  const [profiles,      setProfiles]      = useState({}) // { matt: uuid, dustin: uuid }
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState(null)

  // Fetch profiles once
  useEffect(() => {
    supabase.from('profiles').select('id, username').then(({ data }) => {
      const map = {}
      data?.forEach(p => { map[p.username] = p.id })
      setProfiles(map)
    })
  }, [])

  // ── Step 1: Create year ───────────────────────────────────────────────────

  async function handleCreateYear(e) {
    e.preventDefault()
    setError(null)
    const yr = parseInt(yearNum, 10)
    if (!yr || yr < 2000 || yr > 2100) { setError('Enter a valid year (2000–2100).'); return }
    if (!ceremonyName.trim()) { setError('Enter a ceremony name.'); return }

    setSaving(true)
    try {
      // Check for duplicate
      const { data: existing } = await supabase
        .from('oscar_years').select('id').eq('year', yr).maybeSingle()
      if (existing) {
        setError(`${yr} already exists. Edit it at /oscars/${yr}.`)
        setSaving(false)
        return
      }

      // Insert oscar_years row
      const { data: newYear, error: insErr } = await supabase
        .from('oscar_years')
        .insert({
          year: yr,
          ceremony_name: ceremonyName.trim(),
          ceremony_date: ceremonyDate || null,
          winner: 'pending',
          tiebreaker_used: false,
        })
        .select().single()
      if (insErr) throw insErr
      setYearId(newYear.id)

      // Fetch all categories, filter for this year
      const { data: allCats, error: catErr } = await supabase
        .from('oscar_categories').select('*').order('display_order')
      if (catErr) throw catErr

      const activeCats = allCats.filter(c => {
        const from  = c.active_from  ?? 0
        const until = c.active_until ?? 9999
        return yr >= from && yr <= until
      })
      setCategories(activeCats)

      // Init nominees: 8 slots for Best Picture, 5 for everything else
      const initNoms = {}
      const initGuesses = {}
      activeCats.forEach(c => {
        const slots = c.name === 'Best Picture' ? 10 : 5
        initNoms[c.id]    = Array(slots).fill('')
        initGuesses[c.id] = { matt: '', dustin: '' }
      })
      setNominees(initNoms)
      setGuesses(initGuesses)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2: Save nominees ─────────────────────────────────────────────────

  function updateNominee(catId, idx, value) {
    setNominees(prev => ({
      ...prev,
      [catId]: prev[catId].map((v, i) => i === idx ? value : v),
    }))
  }

  function addNomineeSlot(catId) {
    setNominees(prev => ({ ...prev, [catId]: [...prev[catId], ''] }))
  }

  function removeNomineeSlot(catId, idx) {
    setNominees(prev => ({
      ...prev,
      [catId]: prev[catId].filter((_, i) => i !== idx),
    }))
  }

  async function handleSaveNominees(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const rows = []
      categories.forEach(cat => {
        const catNoms = nominees[cat.id] || []
        catNoms.forEach((name, idx) => {
          if (name.trim()) {
            rows.push({
              year_id:      yearId,
              category_id:  cat.id,
              nominee_name: name.trim(),
              is_winner:    false,
              display_order: idx,
            })
          }
        })
      })

      if (rows.length === 0) {
        setError('Enter at least one nominee before continuing.')
        setSaving(false)
        return
      }

      const { error: insErr } = await supabase.from('oscar_nominees').insert(rows)
      if (insErr) throw insErr

      // Pre-populate guess dropdowns with first nominee per category
      const updatedGuesses = {}
      categories.forEach(cat => {
        const filled = (nominees[cat.id] || []).filter(n => n.trim())
        updatedGuesses[cat.id] = {
          matt:   filled[0] || '',
          dustin: filled[0] || '',
        }
      })
      setGuesses(updatedGuesses)
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Step 3: Save guesses ──────────────────────────────────────────────────

  function updateGuess(catId, player, value) {
    setGuesses(prev => ({
      ...prev,
      [catId]: { ...prev[catId], [player]: value },
    }))
  }

  async function handleSaveGuesses(e) {
    e.preventDefault()
    setError(null)
    if (!profiles.matt || !profiles.dustin) {
      setError('Could not load player profiles. Refresh and try again.')
      return
    }
    setSaving(true)
    try {
      const rows = []
      categories.forEach(cat => {
        const g = guesses[cat.id] || {}
        if (g.matt) {
          rows.push({
            year_id:     yearId,
            category_id: cat.id,
            user_id:     profiles.matt,
            guess:       g.matt,
            is_correct:  null,
            locked:      false,
          })
        }
        if (g.dustin) {
          rows.push({
            year_id:     yearId,
            category_id: cat.id,
            user_id:     profiles.dustin,
            guess:       g.dustin,
            is_correct:  null,
            locked:      false,
          })
        }
      })

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('oscar_guesses').insert(rows)
        if (insErr) throw insErr
      }

      navigate(`/oscars/${yearNum}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to="/oscars" className="text-gray-400 hover:text-gold-600 dark:hover:text-gold-400 transition-colors flex items-center gap-1">
          <OscarIcon size={14} /> Oscars
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-800 font-medium dark:text-white">New Year</span>
      </div>

      <h1 className="page-title flex items-center gap-3 mb-2">
        <OscarIcon size={28} className="text-gold-600 dark:text-gold-400" />
        Add New Year
      </h1>
      <p className="text-gray-500 text-sm mb-8 dark:text-gray-400">
        Set up a new Oscar ceremony — nominees, guesses, and post-ceremony results.
      </p>

      <StepIndicator step={step} />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-red-300 bg-red-50 text-red-700
                        dark:border-red-700/40 dark:bg-red-900/10 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Step 1: Ceremony Setup ── */}
      {step === 1 && (
        <form onSubmit={handleCreateYear} className="card max-w-lg">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-5">Ceremony Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Oscar Year <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={yearNum}
                onChange={e => setYearNum(e.target.value)}
                placeholder="e.g. 2027"
                min="2000" max="2100"
                className="input w-full"
                required
              />
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">The calendar year the films were released (not the ceremony date)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Ceremony Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={ceremonyName}
                onChange={e => setCeremonyName(e.target.value)}
                placeholder="e.g. The 99th Academy Awards - March 2, 2027"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Ceremony Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={ceremonyDate}
                onChange={e => setCeremonyDate(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Link to="/oscars" className="btn-ghost text-sm">Cancel</Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-sm px-5"
            >
              {saving ? 'Creating…' : 'Create Year →'}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 2: Nominees ── */}
      {step === 2 && (
        <form onSubmit={handleSaveNominees}>
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter nominees for each category. Leave blank slots empty — they'll be skipped.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-sm px-5"
            >
              {saving ? 'Saving…' : 'Save Nominees →'}
            </button>
          </div>

          <div className="space-y-3">
            {categories.map(cat => (
              <CategoryNomineesCard
                key={cat.id}
                category={cat}
                nominees={nominees[cat.id] || []}
                onUpdate={(idx, val) => updateNominee(cat.id, idx, val)}
                onAdd={() => addNomineeSlot(cat.id)}
                onRemove={idx => removeNomineeSlot(cat.id, idx)}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="btn-ghost text-sm">← Back</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm px-5">
              {saving ? 'Saving…' : 'Save Nominees →'}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 3: Guesses ── */}
      {step === 3 && (
        <form onSubmit={handleSaveGuesses}>
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Record each player's prediction. Select "No guess" to skip a category.
            </p>
            <button type="submit" disabled={saving} className="btn-primary text-sm px-5">
              {saving ? 'Saving…' : '🏆 Finish & View Year'}
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">Category</th>
                  <th className="table-header text-gold-600/80 dark:text-gold-500/80 w-52">Hermz</th>
                  <th className="table-header text-film-600/80 dark:text-film-400/80 w-52">Dust</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, idx) => {
                  const catNoms = (nominees[cat.id] || []).filter(n => n.trim())
                  const g = guesses[cat.id] || { matt: '', dustin: '' }
                  const stripe = idx % 2 === 0 ? 'bg-white dark:bg-night-800' : 'bg-stone-50/70 dark:bg-night-800/50'
                  return (
                    <tr key={cat.id} className={`${stripe} table-row-hover`}>
                      <td className="table-cell py-3 px-5 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {cat.name}
                      </td>
                      <td className="table-cell py-3 px-5 w-52">
                        <GuessSelect
                          value={g.matt}
                          nominees={catNoms}
                          onChange={v => updateGuess(cat.id, 'matt', v)}
                          color="gold"
                        />
                      </td>
                      <td className="table-cell py-3 px-5 w-52">
                        <GuessSelect
                          value={g.dustin}
                          nominees={catNoms}
                          onChange={v => updateGuess(cat.id, 'dustin', v)}
                          color="film"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="btn-ghost text-sm">← Back</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm px-5">
              {saving ? 'Saving…' : '🏆 Finish & View Year'}
            </button>
          </div>
        </form>
      )}

    </div>
  )
}

// ── CategoryNomineesCard ───────────────────────────────────────────────────────

function CategoryNomineesCard({ category, nominees, onUpdate, onAdd, onRemove }) {
  const [open, setOpen] = useState(true)
  const filled = nominees.filter(n => n.trim()).length

  return (
    <div className="card p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-night-700/50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{category.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">{filled} entered</span>
          <span className="text-gray-400 dark:text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-stone-100 dark:border-night-700">
          <div className="space-y-2">
            {nominees.map((nom, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  value={nom}
                  onChange={e => onUpdate(idx, e.target.value)}
                  placeholder={`Nominee ${idx + 1}`}
                  className="input text-sm py-1.5 flex-1"
                />
                {nominees.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-500 transition-colors text-sm flex-shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {nominees.length < (category.name === 'Best Picture' ? 10 : 8) && (
            <button
              type="button"
              onClick={onAdd}
              className="mt-2 text-xs text-gold-600 dark:text-gold-400 hover:text-gold-700 dark:hover:text-gold-300 transition-colors"
            >
              + Add nominee
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── GuessSelect ───────────────────────────────────────────────────────────────

function GuessSelect({ value, nominees, onChange, color }) {
  const colorClass = color === 'gold'
    ? 'border-gold-300 dark:border-gold-700/40'
    : 'border-film-300 dark:border-film-700/40'

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`select text-xs py-1.5 w-full border ${colorClass}`}
    >
      <option value="">— No guess —</option>
      {nominees.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  )
}
