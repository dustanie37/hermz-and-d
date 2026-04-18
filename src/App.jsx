import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/layout/Layout'

// Pages
import Home  from './pages/Home'
import Login from './pages/Login'

// Oscar pages
import OscarsHome    from './pages/oscars/OscarsHome'
import OscarsYear    from './pages/oscars/OscarsYear'
import OscarsStats   from './pages/oscars/OscarsStats'
import OscarsNewYear from './pages/oscars/OscarsNewYear'

// Movies pages
import MoviesHome    from './pages/movies/MoviesHome'
import MoviesList    from './pages/movies/MoviesList'
import MoviesAll     from './pages/movies/MoviesAll'
import MovieDetail   from './pages/movies/MovieDetail'
import MoviesStats   from './pages/movies/MoviesStats'
import MoviesAcclaim from './pages/movies/MoviesAcclaim'

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
        <Route path="/" element={<Protected><Home /></Protected>} />

        {/* Oscars */}
        <Route path="/oscars"        element={<Protected><OscarsHome /></Protected>} />
        <Route path="/oscars/stats"  element={<Protected><OscarsStats /></Protected>} />
        <Route path="/oscars/new"    element={<Protected><OscarsNewYear /></Protected>} />
        <Route path="/oscars/:year"  element={<Protected><OscarsYear /></Protected>} />

        {/* Movies */}
        <Route path="/movies"          element={<Protected><MoviesHome /></Protected>} />
        <Route path="/movies/list"     element={<Protected><MoviesList /></Protected>} />
        <Route path="/movies/all"      element={<Protected><MoviesAll /></Protected>} />
        <Route path="/movies/stats"    element={<Protected><MoviesStats /></Protected>} />
        <Route path="/movies/acclaim"  element={<Protected><MoviesAcclaim /></Protected>} />
        <Route path="/movies/:filmId"  element={<Protected><MovieDetail /></Protected>} />

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
