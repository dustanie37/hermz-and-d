import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  SEGMENTS, OWNERS, OWNER_CYCLE, SNAPSHOT_FIELDS,
  newNote, normalizeRunOfShow, allNotes,
} from '../../lib/runOfShow'

/*
 * Run of Show — the episode's spine. Six fixed segments, each with its own
 * notes and questions (owner-tagged D / M / D+M), with the film's stats woven
 * into the segment where they get used:
 *   3 Film Snapshot   → database facts + free-text context
 *   4 Main Discussion → ranking history, scorecard readout, score drift
 *   1 Cold Open       → generated insights as hook material
 * `mode` is 'edit' (inputs live) or 'record' (read-only, big type, tap to tick).
 * Parent owns `ep`; this component performs the writes and pushes rows back up.
 */

// ── small shared pieces ──────────────────────────────────────────────────────
function SegmentHeader({ seg, right, mode }) {
  return (
    <div className="flex items-start gap-4 mb-5">
      <span className={`font-display leading-none text-gold-500 ${mode === 'record' ? 'text-5xl' : 'text-4xl'}`}>
        {seg.n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className={`font-display text-white tracking-wide ${mode === 'record' ? 'text-3xl' : 'text-2xl'}`}>
            {seg.name.toUpperCase()}
          </h2>
          <span className="kicker-dim">{seg.aim}</span>
        </div>
        {mode === 'edit' && <p className="text-gray-400 text-sm mt-1 leading-relaxed">{seg.hint}</p>}
      </div>
      {right}
    </div>
  )
}

function OwnerChip({ owner, onCycle, size = 'sm' }) {
  const o = OWNERS[owner] || OWNERS.both
  const cls = size === 'lg' ? 'text-xs px-2 py-1 min-w-[38px]' : 'text-[10px] px-1.5 py-0.5 min-w-[30px]'
  return (
    <button
      type="button"
      onClick={onCycle}
      disabled={!onCycle}
      title={onCycle ? `Carried by ${o.title} — click to change` : o.title}
      className={`shrink-0 rounded font-mono tracking-kicker uppercase border text-center transition-colors ${cls} ${onCycle ? 'hover:brightness-125' : 'cursor-default'}`}
      style={{ color: o.color, borderColor: `${o.color}55`, background: `${o.color}14` }}
    >
      {o.label}
    </button>
  )
}

// ── Notes + questions inside one segment ─────────────────────────────────────
function NoteList({ notes, onChange, mode, emptyText = 'Nothing here yet.' }) {
  const [draft,     setDraft]     = useState('')
  const [kind,      setKind]      = useState('note')
  const [owner,     setOwner]     = useState('both')
  const [editingId, setEditingId] = useState(null)
  const [editText,  setEditText]  = useState('')
  const record = mode === 'record'

  const add = () => {
    const t = draft.trim(); if (!t) return
    setDraft('')
    onChange([...notes, newNote(t, { owner, kind })])
  }
  const update = (id, patch) => onChange(notes.map(n => n.id === id ? { ...n, ...patch } : n))
  const remove = (id) => onChange(notes.filter(n => n.id !== id))
  const move   = (id, dir) => {
    const i = notes.findIndex(n => n.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= notes.length) return
    const next = [...notes]; [next[i], next[j]] = [next[j], next[i]]; onChange(next)
  }
  const cycleOwner = (n) => update(n.id, { owner: OWNER_CYCLE[(OWNER_CYCLE.indexOf(n.owner) + 1) % OWNER_CYCLE.length] })
  const commitEdit = () => {
    const t = editText.trim()
    if (t) update(editingId, { text: t })
    setEditingId(null)
  }

  return (
    <div>
      {notes.length === 0 && (
        <p className={`text-gray-500 ${record ? 'text-base' : 'text-sm'} mb-3`}>{emptyText}</p>
      )}

      <div className={record ? 'space-y-3' : 'space-y-1.5'}>
        {notes.map((n, i) => (
          <div key={n.id}
               className={`group flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg -mx-2 px-2 transition-colors ${record ? 'py-2' : 'py-1.5 hover:bg-night-900/50'}`}>
            <button
              onClick={() => update(n.id, { done: !n.done })}
              aria-label={n.done ? 'Mark not covered' : 'Mark covered'}
              className={`shrink-0 rounded border flex items-center justify-center transition-all
                ${record ? 'w-7 h-7 mt-0.5 text-sm' : 'w-5 h-5 mt-1 text-[11px]'}
                ${n.done ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                         : 'bg-night-900 border-night-600 text-transparent hover:border-gray-500'}`}
            >✓</button>

            <OwnerChip owner={n.owner} onCycle={record ? null : () => cycleOwner(n)} size={record ? 'lg' : 'sm'} />

            {editingId === n.id ? (
              <div className="flex-1">
                <textarea autoFocus rows={2} className="input w-full text-base resize-y"
                          value={editText} onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() } if (e.key === 'Escape') setEditingId(null) }} />
                <div className="flex gap-2 mt-1.5">
                  <button className="btn-gold text-xs" onClick={commitEdit}>Save</button>
                  <button className="btn-ghost text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <p className={`flex-1 leading-relaxed whitespace-pre-wrap ${record ? 'text-lg' : 'text-base'} ${n.done ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                {n.kind === 'question' && (
                  <span className="font-mono text-xs tracking-kicker text-cinema-400 uppercase mr-2 align-middle">Q</span>
                )}
                {n.text}
                {n.source === 'generated' && !record && (
                  <span className="ml-2 align-middle font-mono text-[11px] tracking-kicker uppercase text-cinema-400 border border-cinema-500/30 rounded-full px-1.5 py-px">auto</span>
                )}
              </p>
            )}

            {/* Row actions: wrap under the text on phones (always visible — no hover on touch), inline + hover-revealed from sm up */}
            {!record && editingId !== n.id && (
              <div className="shrink-0 flex items-center gap-0.5 basis-full justify-end sm:basis-auto opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => update(n.id, { kind: n.kind === 'question' ? 'note' : 'question' })}
                        className="w-9 h-9 sm:w-6 sm:h-6 rounded text-gray-600 hover:text-cinema-400 font-mono text-xs" aria-label="Toggle question">Q</button>
                <button onClick={() => move(n.id, -1)} disabled={i === 0}
                        className="w-9 h-9 sm:w-6 sm:h-6 rounded text-gray-600 hover:text-gray-300 disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(n.id, 1)} disabled={i === notes.length - 1}
                        className="w-9 h-9 sm:w-6 sm:h-6 rounded text-gray-600 hover:text-gray-300 disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => { setEditingId(n.id); setEditText(n.text) }}
                        className="w-9 h-9 sm:w-6 sm:h-6 rounded text-gray-600 hover:text-cinema-400" aria-label="Edit">✎</button>
                <button onClick={() => remove(n.id)}
                        className="w-9 h-9 sm:w-6 sm:h-6 rounded text-gray-600 hover:text-red-400" aria-label="Delete">×</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!record && (
        <div className="mt-4 flex flex-wrap gap-2 items-start">
          <textarea rows={1} className="input flex-1 min-w-[200px] text-base resize-none"
                    placeholder={kind === 'question' ? 'Add a question to ask…' : 'Add a note…'}
                    value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }} />
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-full border border-white/[0.08] overflow-hidden">
              {['note', 'question'].map(k => (
                <button key={k} type="button" onClick={() => setKind(k)}
                        className={`px-2.5 py-1.5 font-mono text-[11px] tracking-kicker uppercase transition-colors
                          ${kind === k ? 'bg-night-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {k === 'note' ? 'Note' : 'Q'}
                </button>
              ))}
            </div>
            <div className="flex rounded-full border border-white/[0.08] overflow-hidden">
              {OWNER_CYCLE.map(o => (
                <button key={o} type="button" onClick={() => setOwner(o)}
                        className={`px-2.5 py-1.5 font-mono text-[11px] tracking-kicker uppercase transition-colors
                          ${owner === o ? 'bg-night-700' : 'hover:bg-night-900/60'}`}
                        style={{ color: owner === o ? OWNERS[o].color : '#6b7280' }}>
                  {OWNERS[o].label}
                </button>
              ))}
            </div>
            <button className="btn-gold text-sm disabled:opacity-50" disabled={!draft.trim()} onClick={add}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Free-text field that saves on blur ───────────────────────────────────────
function BlurField({ value, onSave, rows = 3, placeholder, className = '' }) {
  const [v, setV] = useState(value || '')
  useEffect(() => { setV(value || '') }, [value])
  const commit = () => { if ((v || '') !== (value || '')) onSave(v) }
  return (
    <textarea rows={rows} className={`input w-full resize-y text-base leading-relaxed ${className}`}
              placeholder={placeholder} value={v}
              onChange={e => setV(e.target.value)} onBlur={commit} />
  )
}

function RuntimeField({ value, onSave }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  const commit = () => {
    const n = v === '' ? null : parseInt(v, 10)
    if (n !== (value ?? null) && (n === null || !isNaN(n))) onSave(n)
  }
  return (
    <input type="number" min="1" className="input w-20 !py-1 font-mono" value={v}
           onChange={e => setV(e.target.value)} onBlur={commit}
           onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
  )
}

// ── Hook material: generated insights → any segment ──────────────────────────
function InsightPicker({ insights, existing, onAdd, mode }) {
  const [openIdx, setOpenIdx] = useState(null)
  if (!insights.length) return null
  return (
    <div className="mb-5 rounded-xl border border-cinema-500/20 bg-cinema-500/[0.04] p-4">
      <p className="kicker-cinema mb-3">Hook material · from the ranking data</p>
      <div className="space-y-2.5">
        {insights.map((text, i) => {
          const added = existing.has(text)
          return (
            <div key={i}>
              <div className="flex gap-3 items-start">
                <p className={`flex-1 leading-relaxed ${mode === 'record' ? 'text-base' : 'text-sm'} text-gray-300`}>{text}</p>
                {mode === 'edit' && (
                  <button onClick={() => setOpenIdx(openIdx === i ? null : i)} disabled={added}
                          className={`shrink-0 px-2 py-0.5 rounded-full border font-mono text-xs tracking-kicker uppercase transition-all
                            ${added ? 'border-emerald-500/30 text-emerald-400/70 cursor-default'
                                    : 'border-white/[0.08] text-gray-500 hover:text-cinema-400 hover:border-cinema-500/40'}`}>
                    {added ? '✓ added' : '+ add'}
                  </button>
                )}
              </div>
              {openIdx === i && !added && (
                <div className="flex flex-wrap gap-1.5 mt-2 pl-1">
                  <span className="kicker-dim self-center mr-1">Add to</span>
                  {SEGMENTS.filter(s => s.key !== 'feature').map(s => (
                    <button key={s.key} onClick={() => { onAdd(s.key, text); setOpenIdx(null) }}
                            className="px-2.5 py-1 rounded-full border border-white/[0.08] text-xs text-gray-300 hover:text-gold-400 hover:border-gold-500/40 transition-colors">
                      {s.n} · {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Recurring feature library (chips + inline manager) ───────────────────────
function FeatureLibrary({ features, setFeatures, selectedIds, onToggle, mode }) {
  const [manage,  setManage]  = useState(false)
  const [name,    setName]    = useState('')
  const [prompt,  setPrompt]  = useState('')
  const [busy,    setBusy]    = useState(false)
  const active = features.filter(f => f.active)

  async function addFeature() {
    const n = name.trim(); if (!n) return
    setBusy(true)
    const { data, error } = await supabase.from('podcast_features')
      .insert({ name: n, prompt: prompt.trim() || null, sort_order: features.length + 1 })
      .select().single()
    setBusy(false)
    if (!error) { setFeatures(prev => [...prev, data]); setName(''); setPrompt('') }
  }
  async function patchFeature(id, patch) {
    const { data, error } = await supabase.from('podcast_features').update(patch).eq('id', id).select().single()
    if (!error) setFeatures(prev => prev.map(f => f.id === id ? data : f))
  }

  if (mode === 'record') return null
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        {active.map(f => {
          const on = selectedIds.has(f.id)
          return (
            <button key={f.id} onClick={() => onToggle(f.id)} title={f.prompt || ''}
                    className={`px-3 py-1.5 rounded-full border font-mono text-xs tracking-kicker uppercase transition-all
                      ${on ? 'bg-gold-500 border-gold-500 text-night-950 font-semibold'
                           : 'bg-night-900/40 border-white/[0.08] text-gray-400 hover:text-gray-200 hover:border-white/[0.16]'}`}>
              {f.name}
            </button>
          )
        })}
        <button onClick={() => setManage(m => !m)}
                className="ml-auto font-mono text-xs tracking-kicker uppercase text-gray-500 hover:text-cinema-400 transition-colors">
          {manage ? 'Done' : 'Edit library'}
        </button>
      </div>

      {manage && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-night-900/40 p-4 space-y-3">
          {features.map(f => (
            <div key={f.id} className={`grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-start ${f.active ? '' : 'opacity-50'}`}>
              <BlurField rows={1} value={f.name} onSave={v => v.trim() && patchFeature(f.id, { name: v.trim() })} className="!py-1.5" />
              <BlurField rows={1} value={f.prompt} placeholder="What this segment is…" onSave={v => patchFeature(f.id, { prompt: v.trim() || null })} className="!py-1.5" />
              <button onClick={() => patchFeature(f.id, { active: !f.active })}
                      className="font-mono text-xs tracking-kicker uppercase text-gray-500 hover:text-gray-200 py-2">
                {f.active ? 'Retire' : 'Restore'}
              </button>
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-start pt-3 border-t border-white/[0.06]">
            <input className="input w-full !py-1.5" placeholder="New feature name" value={name} onChange={e => setName(e.target.value)} />
            <input className="input w-full !py-1.5" placeholder="One line on what it is" value={prompt} onChange={e => setPrompt(e.target.value)} />
            <button className="btn-gold text-sm disabled:opacity-50" disabled={!name.trim() || busy} onClick={addFeature}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Deep dives: score categories picked for a closer look ────────────────────
function DeepDives({ categories, dives, onToggle, onNotes, mode }) {
  const record   = mode === 'record'
  const selected = new Set(dives.map(d => d.cat_key))
  const byKey    = Object.fromEntries(categories.map(c => [c.key, c]))
  const path     = pts => pts.map(p => p.v ?? '·').join(' → ')
  if (!categories.length) return null
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <h3 className="font-display not-italic text-xl text-white tracking-wide">DEEP DIVES</h3>
        <span className="kicker-dim">{record ? 'Categories we\'re going long on' : 'Pick the categories worth going long on'}</span>
      </div>

      {!record && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(c => {
            const on = selected.has(c.key)
            const dl = c.d[c.d.length - 1]?.v, ml = c.m[c.m.length - 1]?.v
            return (
              <button key={c.key} onClick={() => onToggle(c.key)}
                      className={`px-3 py-1.5 rounded-full border font-mono text-xs tracking-kicker uppercase transition-all flex items-center gap-2
                        ${on ? 'bg-gold-500 border-gold-500 text-night-950 font-semibold'
                             : 'bg-night-900/40 border-white/[0.08] text-gray-400 hover:text-gray-200 hover:border-white/[0.16]'}`}>
                {c.label}
                <span className={`font-semibold ${on ? 'text-night-950/70' : 'text-gray-500'}`}>{dl ?? '·'}/{ml ?? '·'}</span>
              </button>
            )
          })}
        </div>
      )}

      {dives.length === 0 && (
        <p className={`text-gray-500 ${record ? 'text-base' : 'text-sm'}`}>No deep dive picked for this episode.</p>
      )}

      <div className="space-y-5">
        {dives.map(d => {
          const c = byKey[d.cat_key]
          if (!c) return null
          const eds = [...new Set([...c.d, ...c.m].map(p => p.yr))].sort()
          return (
            <div key={d.cat_key} className="rounded-xl border border-cinema-500/20 bg-cinema-500/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                <h4 className={`font-display not-italic text-white ${record ? 'text-2xl' : 'text-xl'}`}>{c.label.toUpperCase()}</h4>
                <span className="kicker-dim">out of {c.max} · {eds.join(' / ')}</span>
              </div>
              <div className={`flex flex-wrap gap-x-6 gap-y-1 mb-4 font-mono ${record ? 'text-base' : 'text-sm'}`}>
                <span><span className="tracking-kicker uppercase text-xs mr-2" style={{ color: OWNERS.D.color }}>Dust</span><span className="text-gray-200">{path(c.d)}</span></span>
                <span><span className="tracking-kicker uppercase text-xs mr-2" style={{ color: OWNERS.M.color }}>Hermz</span><span className="text-gray-200">{path(c.m)}</span></span>
              </div>
              <NoteList notes={d.notes} onChange={n => onNotes(d.cat_key, n)} mode={mode}
                        emptyText={record ? 'Nothing planned — wing it.' : 'No notes for this deep dive yet.'} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Run of Show (exported) ───────────────────────────────────────────────────
export default function RunOfShow({
  ep, setEp, film, mode = 'edit', stats = {}, insights = [], features = [], setFeatures, combinedRank,
  categories = [],   // [{ key, label, max, d: [{yr,v}], m: [{yr,v}] }] — score categories with data for this film
}) {
  const ros      = normalizeRunOfShow(ep.run_of_show, ep.talking_points)
  const snapshot = (ep.snapshot && typeof ep.snapshot === 'object') ? ep.snapshot : {}
  const record   = mode === 'record'
  const [warn, setWarn] = useState(null)

  async function persist(patch) {
    setWarn(null)
    const { data, error } = await supabase.from('podcast_episodes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', ep.id).select().single()
    if (error) { setWarn(`Save failed: ${error.message}`); return }
    setEp(prev => ({ ...data, films: prev.films }))
  }
  const saveRos      = (next) => persist({ run_of_show: next })
  const saveSnapshot = (key, v) => persist({ snapshot: { ...snapshot, [key]: v } })

  const setSegNotes = (key, notes) =>
    saveRos({ ...ros, segments: { ...ros.segments, [key]: { notes } } })
  const setFeatNotes = (fid, notes) =>
    saveRos({ ...ros, features: ros.features.map(f => f.feature_id === fid ? { ...f, notes } : f) })
  const setDiveNotes = (key, notes) =>
    saveRos({ ...ros, deep_dives: ros.deep_dives.map(d => d.cat_key === key ? { ...d, notes } : d) })
  const toggleDive = (key) => {
    const has = ros.deep_dives.some(d => d.cat_key === key)
    saveRos({ ...ros, deep_dives: has ? ros.deep_dives.filter(d => d.cat_key !== key) : [...ros.deep_dives, { cat_key: key, notes: [] }] })
  }
  const toggleFeature = (fid) => {
    const has = ros.features.some(f => f.feature_id === fid)
    saveRos({ ...ros, features: has ? ros.features.filter(f => f.feature_id !== fid) : [...ros.features, { feature_id: fid, notes: [] }] })
  }
  const addInsight = (segKey, text) =>
    setSegNotes(segKey, [...ros.segments[segKey].notes, newNote(text, { source: 'generated' })])

  const notesAll   = allNotes(ros)
  const existing   = new Set(notesAll.map(n => n.text))
  const selectedIds = new Set(ros.features.map(f => f.feature_id))
  const featureById = Object.fromEntries(features.map(f => [f.id, f]))
  const sizeCls = record ? 'text-lg' : 'text-base'

  const cardCls = 'card p-6'

  return (
    <div className="space-y-6">
      {warn && <p className="text-sm text-amber-300 font-mono">{warn}</p>}

      {/* ── Episode snapshot ─────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-5">
          <h2 className="font-display text-2xl text-white tracking-wide">EPISODE SNAPSHOT</h2>
          <span className="kicker-dim">The one idea, the numbers, the date</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div>
            <p className="stat-label mb-1">Episode</p>
            <p className="font-display text-3xl text-white leading-none">{String(ep.episode_num).padStart(2, '0')}</p>
          </div>
          <div>
            <p className="stat-label mb-1">Shared rank</p>
            <p className="font-display text-3xl leading-none" style={{ color: '#2DD4BF' }}>{combinedRank ? `#${combinedRank}` : '—'}</p>
          </div>
          <div>
            <p className="stat-label mb-1">Recording</p>
            <p className="font-mono text-base text-gray-200 mt-1">{ep.record_date || <span className="text-gray-500">not set</span>}</p>
          </div>
          <div>
            <p className="stat-label mb-1">Target runtime</p>
            {record ? (
              <p className="font-mono text-base text-gray-200 mt-1">{ros.target_runtime} min</p>
            ) : (
              <div className="flex items-center gap-2">
                <RuntimeField value={ros.target_runtime}
                              onSave={v => saveRos({ ...ros, target_runtime: v })} />
                <span className="text-gray-500 text-sm">min</span>
              </div>
            )}
          </div>
        </div>

        <p className="stat-label mb-1.5">Thesis / hook</p>
        {record ? (
          <p className={`${sizeCls} leading-relaxed ${ros.hook ? 'text-gray-100' : 'text-gray-500'}`}>{ros.hook || 'No hook written.'}</p>
        ) : (
          <BlurField rows={2} value={ros.hook} placeholder="The one idea this episode is built around."
                     onSave={v => saveRos({ ...ros, hook: v })} />
        )}
      </div>

      {/* ── Segments ──────────────────────────────────────────────────── */}
      {SEGMENTS.map(seg => {
        const notes = ros.segments[seg.key].notes
        return (
          <div key={seg.key} className={cardCls}>
            <SegmentHeader seg={seg} mode={mode} />

            {/* 1 · hook material */}
            {seg.key === 'cold_open' && (
              <InsightPicker insights={insights} existing={existing} onAdd={addInsight} mode={mode} />
            )}

            {/* 3 · database facts + free text */}
            {seg.key === 'snapshot' && film && (
              <div className="mb-6 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                  {[
                    ['Year',     film.release_year],
                    ['Director', film.director],
                    ['Writer',   film.writer],
                    ['Genre',    film.omdb_genres],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="stat-label mb-0.5">{k}</p>
                      <p className={`text-gray-200 ${sizeCls}`}>{v || <span className="text-gray-500">—</span>}</p>
                    </div>
                  ))}
                  <div className="col-span-2 sm:col-span-4">
                    <p className="stat-label mb-0.5">Cast</p>
                    <p className={`text-gray-200 ${sizeCls}`}>
                      {[1,2,3,4,5,6,7,8].map(i => film[`actor_${i}`]).filter(Boolean).join(', ') || <span className="text-gray-500">—</span>}
                    </p>
                  </div>
                </div>
                {stats.oscar}
                {stats.lists}
                <div className="grid grid-cols-1 gap-4">
                  {SNAPSHOT_FIELDS.map(f => {
                    const v = snapshot[f.key]
                    if (record && !v) return null
                    return (
                      <div key={f.key}>
                        <p className="stat-label mb-1.5">{f.label}</p>
                        {record
                          ? <p className={`${sizeCls} text-gray-100 leading-relaxed whitespace-pre-wrap`}>{v}</p>
                          : <BlurField rows={f.rows} value={v} placeholder={f.placeholder} onSave={val => saveSnapshot(f.key, val)} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 4 · scorecard */}
            {seg.key === 'discussion' && (
              <div className="mb-6 space-y-5">
                {stats.readout}
                {stats.canon}
                {stats.drift}
                <DeepDives categories={categories} dives={ros.deep_dives}
                           onToggle={toggleDive} onNotes={setDiveNotes} mode={mode} />
              </div>
            )}

            {/* 5 · recurring features */}
            {seg.key === 'feature' && (
              <>
                <FeatureLibrary features={features} setFeatures={setFeatures}
                                selectedIds={selectedIds} onToggle={toggleFeature} mode={mode} />
                {ros.features.length === 0 && (
                  <p className={`text-gray-500 ${record ? 'text-base' : 'text-sm'}`}>No feature picked for this episode.</p>
                )}
                <div className="space-y-6">
                  {ros.features.map(f => {
                    const meta = featureById[f.feature_id]
                    return (
                      <div key={f.feature_id} className="rounded-xl border border-gold-500/20 bg-gold-500/[0.03] p-4 sm:p-5">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                          <h3 className={`font-display not-italic text-white ${record ? 'text-2xl' : 'text-xl'}`}>{(meta?.name || 'Feature').toUpperCase()}</h3>
                          {meta?.prompt && <span className="text-gray-400 text-sm">{meta.prompt}</span>}
                        </div>
                        <NoteList notes={f.notes} onChange={n => setFeatNotes(f.feature_id, n)} mode={mode}
                                  emptyText="No notes for this feature yet." />
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {seg.key !== 'feature' && (
              <NoteList notes={notes} onChange={n => setSegNotes(seg.key, n)} mode={mode}
                        emptyText={record ? 'Nothing planned — wing it.' : 'No notes or questions yet.'} />
            )}
          </div>
        )
      })}
    </div>
  )
}
