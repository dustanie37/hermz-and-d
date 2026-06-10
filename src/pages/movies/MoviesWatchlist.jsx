import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { searchFilmsByQuery } from '../../lib/omdb'
import FilmStill from '../../components/FilmStill'

// ── constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'unseen',     label: 'Want to Watch',   kicker: 'HAVEN\'T SEEN',  color: 'text-gold-400' },
  { id: 'first_time', label: 'First Watch',       kicker: 'FIRST TIME',     color: 'text-film-400' },
  { id: 'rewatch',   label: 'Rewatched',         kicker: 'REWATCH',        color: 'text-cinema-400' },
]

const TAB_META = Object.fromEntries(TABS.map(t => [t.id, t]))

// ── helpers ───────────────────────────────────────────────────────────────────

function sortTitle(title = '') {
  return title.replace(/^(a |an |the )/i, '').trim().toLowerCase()
}

function addedLabel(ts) {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d)) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()
}

// ── Notes area (shared by first_time + rewatch cards) ────────────────────────

function NotesArea({ item, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(item.notes ?? '')
  const [saving, setSaving]   = useState(false)
  const textRef = useRef(null)

  useEffect(() => {
    if (editing) textRef.current?.focus()
  }, [editing])

  async function save() {
    if (draft === (item.notes ?? '')) { setEditing(false); return }
    setSaving(true)
    await onSave(item.id, draft.trim())
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setDraft(item.notes ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-1.5">
        <textarea
          ref={textRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') cancel() }}
          rows={3}
          placeholder="Add notes for ranking consideration…"
          className="w-full bg-night-800 border border-white/10 rounded-lg px-3 py-2
                     text-xs text-gray-200 placeholder-gray-600 resize-none
                     focus:outline-none focus:border-cinema-500/60 transition-colors"
        />
        <div className="flex gap-1.5">
          <button
            onClick={save}
            disabled={saving}
            className="btn-cinema text-[11px] px-3 py-1 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={cancel}
            className="font-mono text-[11px] tracking-kicker text-gray-500 hover:text-gray-300 transition-colors px-2"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left mt-1 group/notes"
    >
      {item.notes ? (
        <p className="text-sm text-gray-300 leading-relaxed line-clamp-4 group-hover/notes:text-gray-100 transition-colors">
          {item.notes}
        </p>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-cinema-400
                         border border-dashed border-cinema-500/30 rounded-lg px-3 py-1.5
                         group-hover/notes:border-cinema-400/60 group-hover/notes:text-cinema-300
                         transition-all">
          ＋ Add notes
        </span>
      )}
    </button>
  )
}

// ── Poster card (Want to Watch — no notes) ────────────────────────────────────

function UnseenCard({ item, onRemove, onMoveTab }) {
  return (
    <div className="group relative">
      <FilmStill
        src={item.poster_url}
        title={item.title}
        className="aspect-[2/3] rounded-lg border border-white/10 shadow-still
                   group-hover:border-gold-500/50 group-hover:-translate-y-0.5 transition-all"
      >
        {/* Title overlay */}
        <div
          className="absolute inset-x-0 bottom-0 p-3 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.93) 100%)' }}
        >
          {item.year && (
            <p className="font-mono text-xs tracking-kicker text-white/60 uppercase mb-0.5">{item.year}</p>
          )}
          {item.film_id ? (
            <Link
              to={`/movies/${item.film_id}`}
              className="font-display text-base text-white tracking-wide leading-tight line-clamp-2 block
                         hover:text-gold-400 transition-colors pointer-events-auto"
            >
              {item.title?.toUpperCase()}
            </Link>
          ) : (
            <p className="font-display text-base text-white tracking-wide leading-tight line-clamp-2">
              {item.title?.toUpperCase()}
            </p>
          )}
          {addedLabel(item.added_at) && (
            <p className="font-mono text-[10.5px] tracking-kicker text-white/45 uppercase mt-1.5">
              Added · {addedLabel(item.added_at)}
            </p>
          )}
        </div>

        {/* Controls — appear on hover */}
        <div className="absolute top-2 right-2 flex flex-col gap-1
                        opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={() => onRemove(item.id)}
            className="w-7 h-7 rounded-full bg-night-950/80 border border-white/20
                       text-gray-300 hover:bg-red-500/80 hover:text-white hover:border-red-500
                       transition-all flex items-center justify-center text-xs"
            title="Remove"
          >✕</button>
        </div>

        {/* Move buttons */}
        <div className="absolute bottom-0 inset-x-0 opacity-0 group-hover:opacity-100 transition-all pointer-events-auto pb-1 px-1">
          <div className="flex gap-1">
            <button
              onClick={() => onMoveTab(item.id, 'first_time')}
              className="flex-1 font-mono text-[11px] tracking-kicker uppercase py-1
                         bg-film-600/80 text-white rounded hover:bg-film-500 transition-colors"
              title="Move to First Watch"
            >→ First Watch</button>
            <button
              onClick={() => onMoveTab(item.id, 'rewatch')}
              className="flex-1 font-mono text-[11px] tracking-kicker uppercase py-1
                         bg-cinema-600/80 text-white rounded hover:bg-cinema-500 transition-colors"
              title="Move to Rewatched"
            >→ Rewatch</button>
          </div>
        </div>

        {/* In-DB dot */}
        {item.film_id && (
          <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-cinema-500
                           shadow-[0_0_8px_rgba(0,224,217,0.7)]"
                title="In our database" />
        )}
      </FilmStill>
    </div>
  )
}

// ── Seen / Rewatch card (full-height poster left, content right) ──────────────

function NotesCard({ item, onRemove, onSaveNotes, onMoveTab, tab }) {
  return (
    <div className={`card overflow-hidden flex border transition-all
      ${tab === 'first_time'
        ? 'border-film-800/40 hover:border-film-600/60'
        : 'border-cinema-800/40 hover:border-cinema-600/60'
      }`}>

      {/* Poster — flush left, fills full card height */}
      <div className="flex-shrink-0 w-36 self-stretch relative">
        <FilmStill
          src={item.poster_url}
          title={item.title}
          className="absolute inset-0 w-full h-full shadow-still"
        />
        {item.film_id && (
          <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-cinema-500
                           shadow-[0_0_8px_rgba(0,224,217,0.7)]"
                title="In our database" />
        )}
      </div>

      {/* Content — right column */}
      <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">

        {/* Year + title */}
        <div>
          <p className="font-mono text-xs tracking-kicker text-gray-500 uppercase mb-1">
            {item.year ?? '—'}
            {tab === 'first_time' && <span className="ml-2 text-film-500">● First Watch</span>}
            {tab === 'rewatch'    && <span className="ml-2 text-cinema-500">● Rewatch</span>}
          </p>
          {item.film_id ? (
            <Link
              to={`/movies/${item.film_id}`}
              className="font-display text-base text-white tracking-wide leading-tight line-clamp-2
                         hover:text-cinema-400 transition-colors block"
            >
              {item.title?.toUpperCase()}
            </Link>
          ) : (
            <p className="font-display text-base text-white tracking-wide leading-tight line-clamp-2">
              {item.title?.toUpperCase()}
            </p>
          )}
        </div>

        {/* Notes — grows to fill space */}
        <div className="border-t border-white/5 pt-3 flex-1">
          <p className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase mb-2">Ranking Notes</p>
          <NotesArea item={item} onSave={onSaveNotes} />
        </div>

        {/* Actions — pinned to bottom */}
        <div className="flex items-center gap-3 border-t border-white/5 pt-2">
          {tab === 'first_time' && (
            <button
              onClick={() => onMoveTab(item.id, 'rewatch')}
              className="font-mono text-xs tracking-kicker text-cinema-500 hover:text-cinema-300 uppercase transition-colors"
            >
              → Rewatched
            </button>
          )}
          {tab === 'rewatch' && (
            <button
              onClick={() => onMoveTab(item.id, 'first_time')}
              className="font-mono text-xs tracking-kicker text-film-500 hover:text-film-300 uppercase transition-colors"
            >
              ← First Watch
            </button>
          )}
          <button
            onClick={() => onRemove(item.id)}
            className="font-mono text-xs tracking-kicker text-gray-600 hover:text-red-400 uppercase transition-colors ml-auto"
          >
            Remove
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Add Film Modal ────────────────────────────────────────────────────────────

function AddFilmModal({ onClose, onAdd, existingImdbIds, defaultTab }) {
  const [listType, setListType] = useState(defaultTab)
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState(null)
  const [adding, setAdding]     = useState(null)
  const [added, setAdded]       = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true); setSearchErr(null); setResults([])
    try {
      const hits = await searchFilmsByQuery(query.trim())
      if (hits.length === 0) setSearchErr('No results found. Try a different title.')
      setResults(hits)
    } catch {
      setSearchErr('Search failed. Check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd(item) {
    if (adding) return
    setAdding(item.imdbId)
    await onAdd(item, listType)
    setAdded(item.imdbId)
    setAdding(null)
  }

  const TYPE_OPTIONS = [
    { id: 'unseen',     label: 'Want to Watch',  desc: 'Haven\'t seen it yet' },
    { id: 'first_time', label: 'First Watch',      desc: 'Just watched for the first time' },
    { id: 'rewatch',   label: 'Rewatched',        desc: 'Watched again — keeping notes' },
  ]

  return (
   <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="absolute inset-0 bg-night-950/80 backdrop-blur-md" onClick={onClose} />

  <div className="relative z-10 w-full max-w-lg
                  bg-night-900 border border-white/[0.1]
                  rounded-2xl shadow-still-lg flex flex-col max-h-[90vh]"
       onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-night-700/60">
          <div>
            <span className="kicker">Watchlist</span>
            <h2 className="font-display text-2xl text-white tracking-wide leading-none mt-1.5">
              ADD A FILM
            </h2>
          </div>
          <button onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-xl leading-none w-8 h-8
                       flex items-center justify-center rounded-full hover:bg-white/5">
            ✕
          </button>
        </div>

        {/* List type selector */}
        <div className="p-5 border-b border-night-700/60">
          <p className="font-mono text-[11px] tracking-kicker text-gray-500 uppercase mb-3">Add to</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setListType(opt.id)}
                className={`rounded-xl px-3 py-2.5 text-left border transition-all
                  ${listType === opt.id
                    ? opt.id === 'unseen'
                      ? 'bg-gold-500/10 border-gold-500/50 text-gold-300'
                      : opt.id === 'first_time'
                      ? 'bg-film-500/10 border-film-500/50 text-film-300'
                      : 'bg-cinema-500/10 border-cinema-500/50 text-cinema-300'
                    : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                  }`}
              >
                <p className="font-display text-xs tracking-wide leading-none">{opt.label.toUpperCase()}</p>
                <p className="font-mono text-[11px] tracking-kicker text-current/70 mt-1 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Search form */}
        <div className="p-5 border-b border-night-700/60">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by title…"
              className="input flex-1 text-sm"
            />
            <button type="submit" disabled={searching || !query.trim()}
                    className="btn-film text-sm px-4 disabled:opacity-50">
              {searching ? '…' : 'Search'}
            </button>
          </form>
          {searchErr && <p className="text-xs text-red-400 mt-2">{searchErr}</p>}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 p-2">
          {results.length === 0 && !searching && (
            <p className="text-sm text-gray-500 text-center py-8 italic">
              Search for a film above to add it.
            </p>
          )}

          {results.map(item => {
            const onList = existingImdbIds.has(item.imdbId)
            const isAdded = added === item.imdbId
            const isAdding = adding === item.imdbId
            return (
              <div key={item.imdbId}
                   className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                              hover:bg-night-700/40 transition-colors">
                <FilmStill src={item.posterUrl} title={item.title}
                           className="w-10 h-14 rounded border border-white/10 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <p className="font-mono text-[11px] tracking-kicker text-gray-500 mt-0.5 uppercase">{item.year}</p>
                </div>
                {onList ? (
                  <span className="font-mono text-[11px] tracking-kicker text-film-400 uppercase whitespace-nowrap">
                    On list
                  </span>
                ) : isAdded ? (
                  <span className="font-mono text-[11px] tracking-kicker text-emerald-400 uppercase whitespace-nowrap">
                    ✓ Added
                  </span>
                ) : (
                  <button onClick={() => handleAdd(item)} disabled={!!adding}
                          className="btn-film text-xs px-3 py-1.5 disabled:opacity-50 whitespace-nowrap">
                    {isAdding ? '…' : '+ Add'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MoviesWatchlist() {
  const { session } = useAuth()
  const user = session?.user
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [sort, setSort]           = useState('alpha')
  const [activeTab, setActiveTab] = useState('unseen')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
      if (error) setError(error.message)
      else setItems(data || [])
      setLoading(false)
    }
    load()
  }, [user])

  // Split items by list_type
  const byTab = useMemo(() => {
    const grouped = { unseen: [], first_time: [], rewatch: [] }
    items.forEach(item => {
      const key = item.list_type ?? 'unseen'
      if (grouped[key]) grouped[key].push(item)
    })
    return grouped
  }, [items])

  const sorted = useMemo(() => {
    const list = byTab[activeTab] ?? []
    if (sort === 'alpha') {
      return [...list].sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
    }
    return list
  }, [byTab, activeTab, sort])

  const existingImdbIds = useMemo(() =>
    new Set(items.map(i => i.imdb_id).filter(Boolean)),
  [items])

  async function handleAdd(omdbItem, listType) {
    if (!user) return
    if (existingImdbIds.has(omdbItem.imdbId)) return

    let filmId = null
    if (omdbItem.imdbId) {
      const { data: match } = await supabase
        .from('films').select('id').eq('omdb_id', omdbItem.imdbId).maybeSingle()
      filmId = match?.id ?? null
    }
    // Guard: film_id must be a valid integer or null (prevents "NaN" type errors)
    const safeFilmId = (filmId !== null && filmId !== undefined && !Number.isNaN(filmId))
      ? filmId
      : null

    const entry = {
      user_id:    user.id,
      title:      omdbItem.title,
      year:       omdbItem.year ? String(omdbItem.year) : null,
      poster_url: omdbItem.posterUrl ?? null,
      imdb_id:    omdbItem.imdbId ?? null,
      film_id:    safeFilmId,
      list_type:  listType,
      notes:      null,
    }
    const { data: inserted, error } = await supabase
      .from('watchlist').insert(entry).select().single()
    if (!error && inserted) {
      setItems(prev => [inserted, ...prev])
      setActiveTab(listType)
    }
  }

  async function handleRemove(id) {
    const { error } = await supabase
      .from('watchlist').delete().eq('id', id).eq('user_id', user.id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleSaveNotes(id, notes) {
    const { error } = await supabase
      .from('watchlist').update({ notes }).eq('id', id).eq('user_id', user.id)
    if (!error) setItems(prev => prev.map(i => i.id === id ? { ...i, notes } : i))
  }

  async function handleMoveTab(id, newType) {
    const { error } = await supabase
      .from('watchlist').update({ list_type: newType }).eq('id', id).eq('user_id', user.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, list_type: newType } : i))
    }
  }

  const tabMeta = TAB_META[activeTab]

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <FilmStill
        title="Hermz and D Watchlist"
        hue={172}
        mood="cool"
        className="w-full h-[300px] sm:h-[340px]"
      >
        <div className="absolute inset-0 scrim-bottom" />

        {/* Action — top right */}
        <div className="absolute top-6 right-6 sm:right-10 flex items-center gap-2 z-10">
          <div className="flex gap-1 p-1 bg-night-950/60 backdrop-blur-md border border-white/10 rounded-full">
            <button onClick={() => setSort('alpha')}
              className={`px-3 py-1 rounded-full font-mono text-[11px] tracking-kicker uppercase transition-all ${
                sort === 'alpha' ? 'bg-white text-night-950' : 'text-gray-400 hover:text-white'
              }`}>A–Z</button>
            <button onClick={() => setSort('chrono')}
              className={`px-3 py-1 rounded-full font-mono text-[11px] tracking-kicker uppercase transition-all ${
                sort === 'chrono' ? 'bg-white text-night-950' : 'text-gray-400 hover:text-white'
              }`}>Recent</button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-cinema text-xs">＋ Add Film</button>
        </div>

        {/* Headline */}
        <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-7 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/movies" className="font-mono text-[11px] tracking-kicker text-cinema-400 hover:text-cinema-300 transition-colors">
              ← FILMS
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-[11px] tracking-kicker text-white uppercase">Future Consideration</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-wide leading-none">
            FUTURE CONSIDERATION
          </h1>
          <p className="font-serif italic text-base text-gray-400 mt-3">
            Films to watch, first-time views to consider, and rewatch notes for the next edition
            {!loading && items.length > 0 && (
              <span className="text-gray-500 ml-2">· {items.length} total</span>
            )}
          </p>
        </div>
      </FilmStill>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">

        {/* Tab strip */}
        <div className="flex gap-1 mb-8 border-b border-white/[0.06] pb-0">
          {TABS.map(tab => {
            const count = byTab[tab.id]?.length ?? 0
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-5 py-3 font-display text-base tracking-wide transition-all
                  ${isActive
                    ? `${tab.color} after:absolute after:bottom-0 after:inset-x-0 after:h-[2px]
                       ${tab.id === 'unseen' ? 'after:bg-gold-400' : tab.id === 'first_time' ? 'after:bg-film-400' : 'after:bg-cinema-400'}`
                    : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                {tab.label.toUpperCase()}
                {count > 0 && (
                  <span className={`ml-2 font-mono text-[11px] px-1.5 py-0.5 rounded-full
                    ${isActive
                      ? tab.id === 'unseen' ? 'bg-gold-500/20 text-gold-400'
                        : tab.id === 'first_time' ? 'bg-film-500/20 text-film-400'
                        : 'bg-cinema-500/20 text-cinema-400'
                      : 'bg-white/5 text-gray-500'
                    }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="py-20 text-center font-mono text-[11px] tracking-kicker text-gray-500 animate-pulse">
            LOADING WATCHLIST…
          </div>
        )}
        {error && <div className="py-20 text-center text-red-400 text-sm">{error}</div>}

        {/* Empty state */}
        {!loading && !error && sorted.length === 0 && (
          <div className="card text-center py-16 space-y-4">
            <div className="font-display text-7xl text-gray-700 tracking-wide leading-none">
              {activeTab === 'unseen' ? '🎬' : activeTab === 'first_time' ? '👁' : '🔁'}
            </div>
            <p className="font-display text-2xl text-white tracking-wide leading-none">
              {activeTab === 'unseen'
                ? 'NOTHING ON DECK'
                : activeTab === 'first_time'
                ? 'NO FIRST WATCHES YET'
                : 'NO REWATCHES YET'}
            </p>
            <p className="font-serif italic text-base text-gray-500 max-w-sm mx-auto">
              {activeTab === 'unseen'
                ? 'Add films you want to see for the first time.'
                : activeTab === 'first_time'
                ? 'Log films you\'ve just seen and are considering for ranking.'
                : 'Track films you\'ve rewatched. Add notes to capture your ranking thoughts.'}
            </p>
            <button onClick={() => setShowModal(true)} className="btn-cinema text-sm mt-2">
              ＋ Add a Film
            </button>
          </div>
        )}

        {/* ── UNSEEN: poster grid ──────────────────────────────────────────── */}
        {!loading && activeTab === 'unseen' && sorted.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sorted.map(item => (
              <UnseenCard
                key={item.id}
                item={item}
                onRemove={handleRemove}
                onMoveTab={handleMoveTab}
              />
            ))}
          </div>
        )}

        {/* ── FIRST TIME + REWATCH: notes card grid ───────────────────────── */}
        {!loading && (activeTab === 'first_time' || activeTab === 'rewatch') && sorted.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sorted.map(item => (
              <NotesCard
                key={item.id}
                item={item}
                tab={activeTab}
                onRemove={handleRemove}
                onSaveNotes={handleSaveNotes}
                onMoveTab={handleMoveTab}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AddFilmModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
          existingImdbIds={existingImdbIds}
          defaultTab={activeTab}
        />
      )}
    </div>
  )
}
