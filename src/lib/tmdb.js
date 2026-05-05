const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE    = 'https://api.themoviedb.org/3'

function apiUrl(path, params = {}) {
  const q = new URLSearchParams({ api_key: TMDB_API_KEY, ...params })
  return `${TMDB_BASE}${path}?${q}`
}

/**
 * Given an IMDb ID (e.g. 'tt0111161'), return the TMDb movie ID.
 * Returns null if not found.
 */
export async function tmdbIdFromImdbId(imdbId) {
  const res  = await fetch(apiUrl(`/find/${imdbId}`, { external_source: 'imdb_id' }))
  const data = await res.json()
  return data.movie_results?.[0]?.id ?? null
}

/**
 * Search TMDb by title + optional year.
 * Returns the TMDb movie ID of the first result, or null.
 */
export async function tmdbIdFromSearch(title, year) {
  const params = { query: title, include_adult: false }
  if (year) params.year = year
  const res  = await fetch(apiUrl('/search/movie', params))
  const data = await res.json()
  return data.results?.[0]?.id ?? null
}

/**
 * Fetch cast for a TMDb movie ID.
 * Returns an array of up to `limit` actor name strings, in billing order.
 */
export async function fetchCast(tmdbId, limit = 10) {
  const res  = await fetch(apiUrl(`/movie/${tmdbId}/credits`))
  const data = await res.json()
  return (data.cast || [])
    .filter(c => c.known_for_department === 'Acting')
    .sort((a, b) => a.order - b.order)
    .slice(0, limit)
    .map(c => c.name)
}

/**
 * Full enrichment for one film:
 * 1. Resolve TMDb ID (via IMDb ID if available, otherwise title search)
 * 2. Fetch cast
 * Returns { tmdbId, cast: string[] } or throws.
 */
export async function enrichFilmCast(film) {
  let tmdbId = null

  if (film.omdb_id) {
    tmdbId = await tmdbIdFromImdbId(film.omdb_id)
  }
  if (!tmdbId) {
    tmdbId = await tmdbIdFromSearch(film.title, film.release_year)
  }
  if (!tmdbId) throw new Error('Not found on TMDb')

  const cast = await fetchCast(tmdbId)
  if (!cast.length) throw new Error('No cast data returned')

  return { tmdbId, cast }
}
