import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Navbar() {
  const { isAuthenticated, displayName, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="border-b border-night-700 bg-night-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center gap-1">
              <span className="text-gold-400 font-display text-xl font-bold tracking-tight group-hover:text-gold-300 transition-colors">
                Hermz
              </span>
              <span className="text-gray-500 font-display text-xl">&</span>
              <span className="text-film-400 font-display text-xl font-bold tracking-tight group-hover:text-film-300 transition-colors">
                D
              </span>
            </div>
          </Link>

          {/* Primary nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink
              to="/oscars"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-gold-400 bg-gold-900/30'
                    : 'text-gray-400 hover:text-gold-400 hover:bg-night-700'
                }`
              }
            >
              🏆 Oscars
            </NavLink>
            <NavLink
              to="/movies"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-film-400 bg-film-900/30'
                    : 'text-gray-400 hover:text-film-400 hover:bg-night-700'
                }`
              }
            >
              🎬 Movies
            </NavLink>
          </nav>

          {/* Auth / User */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-400 hidden sm:block">
                  <span className="text-white font-medium">{displayName}</span>
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-gold text-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
