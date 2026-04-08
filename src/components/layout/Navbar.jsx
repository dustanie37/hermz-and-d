import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import OscarIcon from '../OscarIcon'

export default function Navbar() {
  const { isAuthenticated, displayName, signOut } = useAuth()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur-sm sticky top-0 z-50
                       dark:border-night-700 dark:bg-night-900/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center gap-1">
              <span className="text-gold-600 font-display text-xl font-bold tracking-tight
                               group-hover:text-gold-500 transition-colors
                               dark:text-gold-400 dark:group-hover:text-gold-300">
                Hermz
              </span>
              <span className="text-gray-400 font-display text-xl dark:text-gray-500">&</span>
              <span className="text-film-600 font-display text-xl font-bold tracking-tight
                               group-hover:text-film-500 transition-colors
                               dark:text-film-400 dark:group-hover:text-film-300">
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
                    ? 'text-gold-700 bg-gold-50 dark:text-gold-400 dark:bg-gold-900/30'
                    : 'text-gray-500 hover:text-gold-600 hover:bg-stone-100 dark:text-gray-400 dark:hover:text-gold-400 dark:hover:bg-night-700'
                }`
              }
            >
              <span className="flex items-center gap-1.5">
                <OscarIcon size={16} />
                Oscars
              </span>
            </NavLink>
            <NavLink
              to="/movies"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-film-700 bg-film-50 dark:text-film-400 dark:bg-film-900/30'
                    : 'text-gray-500 hover:text-film-600 hover:bg-stone-100 dark:text-gray-400 dark:hover:text-film-400 dark:hover:bg-night-700'
                }`
              }
            >
              🎬 Movies
            </NavLink>
          </nav>

          {/* Right side: theme toggle + auth */}
          <div className="flex items-center gap-2">

            {/* Light / Dark toggle */}
            <button
              onClick={toggle}
              className="btn-theme-toggle"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle light/dark mode"
            >
              {isDark ? (
                /* Sun icon */
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              ) : (
                /* Moon icon */
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Auth */}
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-500 hidden sm:block dark:text-gray-400">
                  <span className="text-gray-800 font-medium dark:text-white">{displayName}</span>
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors
                             dark:text-gray-500 dark:hover:text-gray-300"
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
