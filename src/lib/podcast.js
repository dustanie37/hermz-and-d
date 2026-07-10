// ── Cinematrix podcast — SINGLE SOURCE ────────────────────────────────────────
// Name lives here only. When the final podcast name lands, change PODCAST_NAME
// and every page follows.

export const PODCAST_NAME    = 'Cinematrix'
export const PODCAST_TAGLINE = 'A deep dive into The Canon, one film at a time.'

// Episode lifecycle. Order matters — it drives the stepper.
export const STATUSES = ['planned', 'prepped', 'recorded', 'published']

export const STATUS_META = {
  planned:   { label: 'Planned',   dot: 'bg-gray-400',    text: 'text-gray-400'    },
  prepped:   { label: 'Prepped',   dot: 'bg-cinema-400',  text: 'text-cinema-400'  },
  recorded:  { label: 'Recorded',  dot: 'bg-amber-300',   text: 'text-amber-300'   },
  published: { label: 'Published', dot: 'bg-emerald-400', text: 'text-emerald-400' },
}

/** Display title for an episode row (expects films join or title_override). */
export function epTitle(ep) {
  return ep?.title_override || ep?.films?.title || 'Untitled'
}

/** 3725 -> "1:02:05" · 754 -> "12:34" */
export function fmtTime(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds)) return '0:00'
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

/** "1:02:05" | "12:34" | "45" -> seconds, or null if unparseable. */
export function parseTime(str) {
  if (!str) return null
  const parts = String(str).trim().split(':').map(p => p.trim())
  if (parts.some(p => p === '' || !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.length === 1) return nums[0]
  if (nums.length === 2) return nums[0] * 60 + nums[1]
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2]
  return null
}

/** Extract a YouTube video id from watch/share/shorts/embed URLs. */
export function youtubeId(url) {
  if (!url) return null
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
  )
  return m ? m[1] : null
}

/** New talking-point item. source: 'manual' | 'generated' */
export function newTalkingPoint(text, source = 'manual') {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `tp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return { id, text, done: false, source }
}
