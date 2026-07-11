// src/pages/oscars/OscarsCategories.jsx
// Phase 13c — category admin (Dustin only): add new categories (e.g. Stunt
// Design, debuting at the 2028 ceremony), retire old ones, adjust ordering.
// A category is "active" for a ceremony year when active_from ≤ year ≤ active_until.

import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { groupOf, GROUP_META } from '../../lib/oscarSeason'

export default function OscarsCategories() {
  const { isDustin, loading: authLoading } = useAuth()
  const [cats,    setCats]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [newCat,  setNewCat]  = useState({ name: '', active_from: '', display_order: '' })
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('oscar_categories').select('*').order('display_order')
    if (err) setError(err.message)
    else setCats(data || [])
    setLoading(false)
  }

  async function saveField(id, field, raw) {
    const value = raw === '' ? null : (field === 'name' ? raw.trim() : parseInt(raw, 10))
    if (field === 'name' && !value) return
    const { error: err } = await supabase.from('oscar_categories').update({ [field]: value }).eq('id', id)
    if (err) { alert(`Save failed: ${err.message}`); return }
    setCats(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  async function addCategory(e) {
    e.preventDefault()
    if (!newCat.name.trim()) return
    setSaving(true)
    try {
      const maxOrder = Math.max(0, ...cats.map(c => c.display_order || 0))
      const { error: err } = await supabase.from('oscar_categories').insert({
        name: newCat.name.trim(),
        display_order: newCat.display_order ? parseInt(newCat.display_order, 10) : maxOrder + 1,
        active_from: newCat.active_from ? parseInt(newCat.active_from, 10) : null,
        active_until: null,
      })
      if (err) throw err
      setNewCat({ name: '', active_from: '', display_order: '' })
      await load()
    } catch (err) {
      alert(`Add failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) return null
  if (!isDustin) return <Navigate to="/settings" replace />
  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">LOADING CATEGORIES…</span>
    </div>
  )
  if (error) return <div className="py-20 text-center text-red-400">Error: {error}</div>

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Link to="/settings" className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gold-400 transition-colors">
            ← SETTINGS
          </Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Oscar Categories</span>
        </div>
        <h1 className="font-display text-5xl text-white tracking-wide leading-none">CATEGORIES</h1>
        <p className="font-serif italic text-base text-gray-400 mt-3 max-w-xl">
          Add a category the year the Academy introduces it, retire one the year it ends.
          "From" and "Until" are ceremony years, inclusive — leave Until blank while a category is current.
        </p>
      </div>

      {/* Add new */}
      <form onSubmit={addCategory} className="card mb-8">
        <p className="font-display text-lg text-white tracking-wide mb-3">ADD A CATEGORY</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-3 items-end">
          <div>
            <label className="block font-mono text-[10px] tracking-kicker text-gray-300 uppercase mb-1.5">Name</label>
            <input value={newCat.name} onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
                   placeholder="e.g. Best Achievement in Stunt Design" className="input w-full text-sm" />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-kicker text-gray-300 uppercase mb-1.5">From (year)</label>
            <input type="number" value={newCat.active_from}
                   onChange={e => setNewCat(c => ({ ...c, active_from: e.target.value }))}
                   placeholder="2028" className="input w-full text-sm" />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-kicker text-gray-300 uppercase mb-1.5">Order</label>
            <input type="number" value={newCat.display_order}
                   onChange={e => setNewCat(c => ({ ...c, display_order: e.target.value }))}
                   placeholder="auto" className="input w-full text-sm" />
          </div>
          <button type="submit" disabled={saving || !newCat.name.trim()}
                  className="btn-gold text-sm px-5 disabled:opacity-40">
            {saving ? 'Adding…' : '+ Add'}
          </button>
        </div>
        <p className="font-mono text-[10px] tracking-kicker text-gray-500 mt-3">
          NOTE: WIKIDATA AUTO-FILL FOR A BRAND-NEW CATEGORY ALSO NEEDS A MAPPING IN
          lib/oscarCategories.js — MENTION IT IN THE NEXT SESSION AND IT'S A ONE-LINE ADD.
        </p>
      </form>

      {/* Table */}
      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>
              <th className="table-header text-left">Category</th>
              <th className="table-header text-left w-28">Group</th>
              <th className="table-header w-20">Order</th>
              <th className="table-header w-24">From</th>
              <th className="table-header w-24">Until</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c, i) => {
              const retired = c.active_until != null
              const stripe = i % 2 === 0 ? 'bg-night-800/40' : 'bg-night-900/40'
              return (
                <tr key={c.id} className={`${stripe} table-row-hover`}>
                  <td className="table-cell py-2.5 px-5">
                    <CellInput value={c.name} onSave={v => saveField(c.id, 'name', v)}
                               className={`w-full ${retired ? 'text-gray-500' : 'text-gray-200'}`} />
                  </td>
                  <td className="table-cell py-2.5 px-5 font-mono text-xs text-gray-400 uppercase tracking-kicker">
                    {GROUP_META[groupOf(c.name)]}
                  </td>
                  <td className="table-cell py-2.5 px-3">
                    <CellInput value={c.display_order ?? ''} number
                               onSave={v => saveField(c.id, 'display_order', v)} className="w-16 text-center" />
                  </td>
                  <td className="table-cell py-2.5 px-3">
                    <CellInput value={c.active_from ?? ''} number placeholder="—"
                               onSave={v => saveField(c.id, 'active_from', v)} className="w-20 text-center" />
                  </td>
                  <td className="table-cell py-2.5 px-3">
                    <CellInput value={c.active_until ?? ''} number placeholder="current"
                               onSave={v => saveField(c.id, 'active_until', v)} className="w-20 text-center" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Inline cell — saves on blur/Enter only when changed. */
function CellInput({ value, onSave, number, placeholder, className = '' }) {
  const [val, setVal] = useState(String(value ?? ''))
  useEffect(() => { setVal(String(value ?? '')) }, [value])
  const commit = () => { if (val !== String(value ?? '')) onSave(val) }
  return (
    <input value={val} type={number ? 'number' : 'text'} placeholder={placeholder}
           onChange={e => setVal(e.target.value)} onBlur={commit}
           onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
           className={`input text-sm py-1 px-2 bg-transparent border-transparent hover:border-night-600
                       focus:border-gold-500/50 ${className}`} />
  )
}
