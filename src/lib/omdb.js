const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY
const OMDB_BASE    = 'https://www.omdbapi.com'

/**
 * Fetch a film by its IMDB ID (preferred — most reliable)
 * @param {string} imdbId  e.g. 'tt0111161'
 */
export async function fetchFilmById(imdbId) {
  const res = await fetch(`${OMDB_BASE}/?i=${imdbId}&apikey=${OMDB_API_KEY}`)
  const data = await res.json()
  if (data.Response === 'False') throw new Error(data.Error)
  return normalise(data)
}

/**
 * Search OMDB by title and optional year
 * Returns the first match; caller should confirm before saving
 * @param {string} title
 * @param {number} [year]
 */
export async function searchFilmByTitle(title, year) {
  const yearParam = year ? `&y=${year}` : ''
  const res  = await fetch(`${OMDB_BASE}/?t=${encodeURIComponent(title)}${yearParam}&apikey=${OMDB_API_KEY}`)
  const data = await res.json()
  if (data.Response === 'False') throw new Error(data.Error)
  return normalise(data)
}

/**
 * Search OMDB by query string — returns up to 10 results (posters + years)
 * Uses the OMDB search endpoint (?s=) for multi-result picker UIs
 * @param {string} query
 * @returns {Promise<Array<{ imdbId, title, year, posterUrl }>>}
 */
export async function searchFilmsByQuery(query) {
  const res  = await fetch(`${OMDB_BASE}/?s=${encodeURIComponent(query)}&type=movie&apikey=${OMDB_API_KEY}`)
  const data = await res.json()
  if (data.Response === 'False') return []   // no results — don't throw
  return (data.Search || []).map(item => ({
    imdbId:    item.imdbID,
    title:     item.Title,
    year:      item.Year,
    posterUrl: item.Poster !== 'N/A' ? item.Poster : null,
  }))
}

/**
 * Normalise a raw OMDB response into our app's shape
 */
function normalise(data) {
  const actors = (data.Actors || '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean)
    .slice(0, 10)  // OMDB typically returns 3–4; TMDb backfill fills the rest

  return {
    omdbId:    data.imdbID,
    title:     data.Title,
    year:      parseInt(data.Year, 10) || null,
    director:  data.Director !== 'N/A' ? data.Director : null,
    genres:    data.Genre   !== 'N/A' ? data.Genre   : null,   // comma-separated string
    posterUrl: data.Poster  !== 'N/A' ? data.Poster  : null,
    actors,
    imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
  }
}
