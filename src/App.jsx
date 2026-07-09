import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/layout/Layout'

// Pages
import Home        from './pages/Home'
import Login       from './pages/Login'
import Settings    from './pages/Settings'
import SiteUpdates from './pages/SiteUpdates'

// Oscar pages
import OscarsHome    from './pages/oscars/OscarsHome'
import OscarsYear    from './pages/oscars/OscarsYear'
import OscarsStats   from './pages/oscars/OscarsStats'
import OscarsNewYear from './pages/oscars/OscarsNewYear'

// Podcast pages
import PodcastHome    from './pages/podcast/PodcastHome'
import PodcastEpisode from './pages/podcast/PodcastEpisode'

// Movies pages
import MoviesHome    from './pages/movies/MoviesHome'
import MoviesList    from './pages/movies/MoviesList'
import MoviesAll     from './pages/movies/MoviesAll'
import MovieDetail   from './pages/movies/MovieDetail'
import MoviesStats   from './pages/movies/MoviesStats'
import MoviesAcclaim  from './pages/movies/MoviesAcclaim'
import MoviesLists    from './pages/movies/MoviesLists'
import MoviesBackfill      from './pages/movies/MoviesBackfill'
import MoviesOscarBackfill from './pages/movies/MoviesOscarBackfill'
import MoviesDataHealth    from './pages/movies/MoviesDataHealth'
import MoviesWatchlist     from './pages/movies/MoviesWatchlist'
import MoviesEventAdmin    from './pages/movies/MoviesEventAdmin'
import MoviesPool          from './pages/movies/MoviesPool'
import MoviesCultivate     from './pages/movies/MoviesCultivate'
import MoviesAcclaimSources from './pages/movies/MoviesAcclaimSources'
import MoviesEventAcclaim   from './pages/movies/MoviesEventAcclaim'
import MoviesScore          from './pages/movies/MoviesScore'

/** Redirect to /login if not authenticated */
function Protected({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <span className="text-gray-500 text-sm">Loading…</span>
    </div>
  )
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — all wrapped in shared Layout */}
      <Route element={<Layout />}>
        <Route path="/"         element={<Protected><Home /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="/updates"  element={<Protected><SiteUpdates /></Protected>} />

        {/* Oscars */}
        <Route path="/oscars"        element={<Protected><OscarsHome /></Protected>} />
        <Route path="/oscars/stats"  element={<Protected><OscarsStats /></Protected>} />
        <Route path="/oscars/new"    element={<Protected><OscarsNewYear /></Protected>} />
        <Route path="/oscars/:year"  element={<Protected><OscarsYear /></Protected>} />

        {/* Podcast */}
        <Route path="/podcast"              element={<Protected><PodcastHome /></Protected>} />
        <Route path="/podcast/:episodeNum"  element={<Protected><PodcastEpisode /></Protected>} />

        {/* Movies */}
        <Route path="/movies"          element={<Protected><MoviesHome /></Protected>} />
        <Route path="/movies/list"     element={<Protected><MoviesList /></Protected>} />
        <Route path="/movies/all"      element={<Protected><MoviesAll /></Protected>} />
        <Route path="/movies/stats"    element={<Protected><MoviesStats /></Protected>} />
        <Route path="/movies/acclaim"   element={<Protected><MoviesAcclaim /></Protected>} />
        <Route path="/movies/lists"     element={<Protected><MoviesLists /></Protected>} />
        <Route path="/movies/watchlist"       element={<Protected><MoviesWatchlist /></Protected>} />
        <Route path="/movies/backfill"        element={<Protected><MoviesBackfill /></Protected>} />
        <Route path="/movies/oscar-backfill"  element={<Protected><MoviesOscarBackfill /></Protected>} />
        <Route path="/movies/data-health"     element={<Protected><MoviesDataHealth /></Protected>} />
        <Route path="/movies/event-admin"     element={<Protected><MoviesEventAdmin /></Protected>} />
        <Route path="/movies/pool"            element={<Protected><MoviesPool /></Protected>} />
        <Route path="/movies/cultivate"       element={<Protected><MoviesCultivate /></Protected>} />
        <Route path="/movies/acclaim-sources" element={<Protected><MoviesAcclaimSources /></Protected>} />
        <Route path="/movies/event-acclaim"   element={<Protected><MoviesEventAcclaim /></Protected>} />
        <Route path="/movies/score"           element={<Protected><MoviesScore /></Protected>} />
        <Route path="/movies/:filmId"   element={<Protected><MovieDetail /></Protected>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
