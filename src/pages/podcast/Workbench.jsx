import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { STATUSES, STATUS_META, fmtTime, parseTime } from '../../lib/podcast'

/*
 * Episode prep workbench — logistics + timestamps. Talking points moved into
 * RunOfShow.jsx (segment notes) on 2026-09-05.
 * The whole podcast section is login-protected, so no extra gating here.
 * Parent owns `ep` (podcast_episodes row) and `timestamps` (podcast_timestamps rows);
 * this component performs the writes and pushes fresh values back up.
 */

function SectionHeader({ label, sub }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
      <h2 className="font-display text-2xl text-white tracking-wide whitespace-nowrap">{label}</h2>
      {sub && <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase">{sub}</span>}
    </div>
  )
}

// ── Logistics ────────────────────────────────────────────────────────────────
function LogisticsCard({ ep, setEp }) {
  const [form, setForm] = useState({
    record_date:     ep.record_date     || '',
    publish_date:    ep.publish_date    || '',
    runtime_minutes: ep.runtime_minutes ?? '',
    youtube_url:     ep.youtube_url     || '',
    spotify_url:     ep.spotify_url     || '',
    apple_url:       ep.apple_url       || '',
    notes:           ep.notes           || '',
  })
  const [saving,  setSaving]  = useState(false)
  const [warn,    setWarn]    = useState(null)

  const dirty =
    form.record_date     !== (ep.record_date  || '') ||
    form.publish_date    !== (ep.publish_date || '') ||
    String(form.runtime_minutes) !== String(ep.runtime_minutes ?? '') ||
    form.youtube_url     !== (ep.youtube_url  || '') ||
    form.spotify_url     !== (ep.spotify_url  || '') ||
    form.apple_url       !== (ep.apple_url    || '') ||
    form.notes           !== (ep.notes        || '')

  async function save(extra = {}) {
    setSaving(true); setWarn(null)
    const patch = {
      record_date:     form.record_date  || null,
      publish_date:    form.publish_date || null,
      runtime_minutes: form.runtime_minutes === '' ? null : parseInt(form.runtime_minutes, 10),
      youtube_url:     form.youtube_url.trim()  || null,
      spotify_url:     form.spotify_url.trim()  || null,
      apple_url:       form.apple_url.trim()    || null,
      notes:           form.notes.trim()        || null,
      updated_at:      new Date().toISOString(),
      ...extra,
    }
    const { data, error } = await supabase
      .from('podcast_episodes').update(patch).eq('id', ep.id).select().single()
    setSaving(false)
    if (error) { setWarn(`Save failed: ${error.message}`); return }
    setEp(prev => ({ ...data, films: prev.films }))
    setForm(f => ({
      ...f,
      publish_date: data.publish_date || '',
      youtube_url:  data.youtube_url  || '',
    }))
  }

  async function setStatus(status) {
    setWarn(null)
    if (status === ep.status) return
    if (status === 'published' && !form.youtube_url.trim()) {
      setWarn('Add a YouTube link before marking this episode published.')
      return
    }
    const extra = { status }
    if (status === 'published' && !form.publish_date) {
      extra.publish_date = new Date().toISOString().slice(0, 10)
    }
    await save(extra)
  }

  const currentIdx = STATUSES.indexOf(ep.status)

  return (
    <div className="card p-6">
      <SectionHeader label="LOGISTICS" sub="Status, dates & links" />

      {/* Status stepper */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STATUSES.map((s, i) => {
          const meta   = STATUS_META[s]
          const active = s === ep.status
          const past   = i < currentIdx
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-xs tracking-kicker uppercase transition-all
                ${active
                  ? 'bg-gold-500 border-gold-500 text-night-950 font-semibold'
                  : past
                    ? 'bg-night-700/60 border-night-600 text-gray-300'
                    : 'bg-night-900/40 border-white/[0.06] text-gray-400 hover:text-gray-200 hover:border-white/[0.12]'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-night-950' : meta.dot}`} />
              {meta.label}
            </button>
          )
        })}
      </div>

      {warn && (
        <p className="mb-4 text-sm text-amber-300 font-mono">{warn}</p>
      )}

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <label className="block">
          <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase block mb-1.5">Record date</span>
          <input type="date" className="input w-full" value={form.record_date}
                 onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} />
        </label>
        <label className="block">
          <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase block mb-1.5">Publish date</span>
          <input type="date" className="input w-full" value={form.publish_date}
                 onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} />
        </label>
        <label className="block">
          <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase block mb-1.5">Runtime (min)</span>
          <input type="number" min="0" className="input w-full" value={form.runtime_minutes}
                 onChange={e => setForm(f => ({ ...f, runtime_minutes: e.target.value }))} />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {[
          ['youtube_url', 'YouTube'],
          ['spotify_url', 'Spotify'],
          ['apple_url',   'Apple Podcasts'],
        ].map(([key, label]) => (
          <label key={key} className="block">
            <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase block mb-1.5">{label}</span>
            <input type="url" placeholder="https://…" className="input w-full" value={form[key]}
                   onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          </label>
        ))}
      </div>

      <label className="block mb-5">
        <span className="font-mono text-xs tracking-kicker text-gray-300 uppercase block mb-1.5">Notes</span>
        <textarea rows={3} className="input w-full resize-y"
                  placeholder="Internal notes — logistics, reminders, gear, guests…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </label>

      <div className="flex items-center gap-3">
        <button className="btn-gold text-sm disabled:opacity-50" disabled={!dirty || saving} onClick={() => save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {dirty && !saving && (
          <span className="font-mono text-xs tracking-kicker text-amber-300 uppercase">Unsaved changes</span>
        )}
      </div>
    </div>
  )
}

// ── Timestamps ───────────────────────────────────────────────────────────────
function TimestampsCard({ ep, timestamps, setTimestamps }) {
  const [time,  setTime]  = useState('')
  const [label, setLabel] = useState('')
  const [warn,  setWarn]  = useState(null)
  const [busy,  setBusy]  = useState(false)

  async function add() {
    setWarn(null)
    const secs = parseTime(time)
    if (secs == null) { setWarn('Time should look like 12:34 or 1:02:34.'); return }
    const text = label.trim()
    if (!text) { setWarn('Give the chapter a label.'); return }
    setBusy(true)
    const { data, error } = await supabase
      .from('podcast_timestamps')
      .insert({ episode_id: ep.id, seconds: secs, label: text })
      .select().single()
    setBusy(false)
    if (error) { setWarn(`Save failed: ${error.message}`); return }
    setTimestamps(prev => [...prev, data].sort((a, b) => a.seconds - b.seconds))
    setTime(''); setLabel('')
  }

  async function remove(id) {
    setBusy(true)
    const { error } = await supabase.from('podcast_timestamps').delete().eq('id', id)
    setBusy(false)
    if (!error) setTimestamps(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="card p-6">
      <SectionHeader label="TIMESTAMPS" sub="Chapters — fill in after recording" />

      {timestamps.length === 0 && (
        <p className="text-gray-500 text-base mb-4">No chapters yet.</p>
      )}

      {timestamps.length > 0 && (
        <div className="space-y-1.5 mb-5">
          {timestamps.map(t => (
            <div key={t.id} className="group flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 hover:bg-night-900/50 transition-colors">
              <span className="font-mono text-sm text-cinema-400 w-20 shrink-0">{fmtTime(t.seconds)}</span>
              <span className="flex-1 text-base text-gray-200">{t.label}</span>
              <button onClick={() => remove(t.id)} disabled={busy}
                      className="shrink-0 w-6 h-6 rounded text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}

      {warn && <p className="mb-3 text-sm text-amber-300 font-mono">{warn}</p>}

      <div className="flex flex-wrap gap-2">
        <input
          className="input w-28 font-mono text-base" placeholder="12:34"
          value={time} onChange={e => setTime(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
        />
        <input
          className="input flex-1 min-w-[160px] text-base" placeholder="Chapter label…"
          value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
        />
        <button className="btn-gold text-sm disabled:opacity-50" disabled={busy} onClick={add}>Add</button>
      </div>
    </div>
  )
}

// ── Workbench (exported) ─────────────────────────────────────────────────────
export default function Workbench({ ep, setEp, timestamps, setTimestamps }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="block flex-1 h-px bg-white/[0.06]" />
        <span className="font-mono text-xs tracking-kicker text-gray-400 uppercase">Prep Workbench</span>
        <span className="block flex-1 h-px bg-white/[0.06]" />
      </div>
      <LogisticsCard ep={ep} setEp={setEp} />
      <TimestampsCard ep={ep} timestamps={timestamps} setTimestamps={setTimestamps} />
    </div>
  )
}
