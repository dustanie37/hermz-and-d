import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'


const OSCARS_LINKS = [
  { to: '/oscars',       label: 'Ceremonies' },
  { to: '/oscars/stats', label: 'Stats' },
]

const FILMS_LINKS = [
  { to: '/movies/list',      label: 'Rankings' },
  { to: '/movies/all',       label: 'All Films' },
  { to: '/movies/stats',     label: 'Stats' },
  { to: '/movies/lists',     label: 'External Lists' },
]

const PODCAST_LINKS = [
  { to: '/podcast', label: 'Episodes' },
]

export default function Navbar() {
  const { isAuthenticated, displayName, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hasActiveEvent, setHasActiveEvent] = useState(false)

  // "Next Edition" sub-nav item appears once a ranking event opens (Phase 12a)
  useEffect(() => {
    if (!isAuthenticated) { setHasActiveEvent(false); return }
    supabase
      .from('ranking_events').select('id')
      .in('status', ['pooling', 'scoring', 'locked', 'revealed'])
      .limit(1)
      .then(({ data }) => setHasActiveEvent((data?.length ?? 0) > 0))
  }, [isAuthenticated])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const inOscars  = location.pathname.startsWith('/oscars')
  const inFilms   = location.pathname.startsWith('/movies')
  const inPodcast = location.pathname.startsWith('/podcast')

  const filmsLinks = hasActiveEvent
    ? [...FILMS_LINKS, { to: '/movies/pool', label: 'Next Edition' }]
    : FILMS_LINKS
  const subLinks  = inOscars ? OSCARS_LINKS : inFilms ? filmsLinks : inPodcast ? PODCAST_LINKS : null
  const subAccent = inOscars ? 'gold' : inPodcast ? 'cinema' : 'blue'

  const activeSubStyle = (active) =>
    active
      ? subAccent === 'gold'
        ? 'text-gold-400 bg-gold-500/10'
        : subAccent === 'cinema'
        ? 'text-cinema-400 bg-cinema-500/10'
        : 'text-film-400 bg-film-500/10'
      : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'

  return (
    <header className="sticky top-0 z-50 bg-night-950/85 backdrop-blur-md border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">

        {/* ── Main bar ── */}
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl tracking-wide text-gold-500
                               group-hover:text-gold-400 transition-colors leading-none">
                HERMZ
              </span>
              <span className="font-serif italic text-base text-gray-500 leading-none">&amp;</span>
              <span className="font-display text-2xl tracking-wide text-film-500
                               group-hover:text-film-400 transition-colors leading-none">
                D
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">

            <NavLink
              to="/oscars"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-sm font-medium tracking-wide transition-colors ${
                  inOscars
                    ? 'text-gold-400 bg-gold-500/10'
                    : 'text-gray-400 hover:text-gold-400 hover:bg-white/[0.04]'
                }`
              }
            >
              Oscars
            </NavLink>

            <NavLink
              to="/movies"
              className={() =>
                `px-3.5 py-1.5 rounded-full text-sm font-medium tracking-wide transition-colors ${
                  inFilms
                    ? 'text-film-400 bg-film-500/10'
                    : 'text-gray-400 hover:text-film-400 hover:bg-white/[0.04]'
                }`
              }
            >
              Films
            </NavLink>

            <NavLink
              to="/podcast"
              className={() =>
                `px-3.5 py-1.5 rounded-full text-sm font-medium tracking-wide transition-colors ${
                  inPodcast
                    ? 'text-cinema-400 bg-cinema-500/10'
                    : 'text-gray-400 hover:text-cinema-400 hover:bg-white/[0.04]'
                }`
              }
            >
              Cinematrix
            </NavLink>

          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Updates / changelog */}
            <Link
              to="/updates"
              title="Site Updates"
              aria-label="Site Updates"
              className={`btn-theme-toggle hidden sm:flex ${
                location.pathname === '/updates' ? 'text-gold-400' : ''
              }`}
            >
              {/* Clock / history icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </Link>

            {/* Watchlist */}
            {isAuthenticated && (
              <Link
                to="/movies/watchlist"
                title="My Watchlist"
                aria-label="My Watchlist"
                className={`btn-theme-toggle hidden sm:flex ${
                  location.pathname === '/movies/watchlist' ? 'text-cinema-400' : ''
                }`}
              >
                {/* Bookmark icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </Link>
            )}

            {isAuthenticated && (
              <Link to="/settings" title="Settings" className="btn-theme-toggle hidden sm:flex" aria-label="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
            )}

            {isAuthenticated ? (
              <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-white/[0.08]">
                <span className="font-mono text-[10px] tracking-kicker text-gray-500 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    displayName?.toLowerCase().includes('hermz') || displayName?.toLowerCase().includes('matt')
                      ? 'bg-gold-500' : 'bg-film-500'
                  }`} />
                  {displayName?.toUpperCase()}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-gold text-xs hidden sm:inline-flex">Sign in</Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="sm:hidden btn-theme-toggle"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Contextual sub-nav strip ── */}
      {subLinks && (
        <div className="hidden sm:block border-t border-white/[0.05] bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="flex items-center gap-1 h-9">

              {subLinks.map(({ to, label }) => {
                const isActive = to === '/oscars'
                  ? location.pathname === '/oscars'
                  : to === '/movies'
                  ? location.pathname === '/movies'
                  : location.pathname.startsWith(to)
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-colors ${activeSubStyle(isActive)}`}
                  >
                    {label}
                  </Link>
                )
              })}

              {/* Add new year — oscars section only, authenticated */}
              {inOscars && isAuthenticated && (
                <Link
                  to="/oscars/new"
                  className={`ml-auto px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-colors flex items-center gap-1.5 ${
                    location.pathname === '/oscars/new'
                      ? 'text-cinema-400 bg-cinema-500/10'
                      : 'text-cinema-400 hover:bg-cinema-500/10'
                  }`}
                >
                  <span className="text-[10px]">+</span>
                  New year
                </Link>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 top-14 z-40 bg-night-950 overflow-y-auto">
          <div className="px-5 py-6 space-y-1">

            {/* Oscars */}
            <div className="px-4 py-2 font-mono text-[10px] tracking-kicker text-gray-600 uppercase">Oscars</div>
            {OSCARS_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to}
                end={to === '/oscars'}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-xl text-sm transition-colors ${
                    isActive ? 'text-gold-400 bg-gold-500/10' : 'text-gray-300 hover:text-gold-400 hover:bg-white/[0.04]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {isAuthenticated && (
              <NavLink to="/oscars/new"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'text-cinema-400 bg-cinema-500/10' : 'text-cinema-400 hover:bg-cinema-500/10'
                  }`
                }
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cinema-500" /> New year
              </NavLink>
            )}

            <div className="border-t border-white/[0.06] my-4" />

            {/* Films */}
            <div className="px-4 py-2 font-mono text-[10px] tracking-kicker text-gray-600 uppercase">Films</div>
            {filmsLinks.map(({ to, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-xl text-sm transition-colors ${
                    isActive ? 'text-film-400 bg-film-500/10' : 'text-gray-300 hover:text-film-400 hover:bg-white/[0.04]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {isAuthenticated && (
              <NavLink to="/movies/watchlist"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'text-cinema-400 bg-cinema-500/10' : 'text-cinema-400 hover:bg-cinema-500/10'
                  }`
                }
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cinema-500" /> My Watchlist
              </NavLink>
            )}

            <div className="border-t border-white/[0.06] my-4" />

            {/* Cinematrix / Podcast */}
            <div className="px-4 py-2 font-mono text-[10px] tracking-kicker text-gray-600 uppercase">Cinematrix</div>
            <NavLink to="/podcast"
              end
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-xl text-sm transition-colors ${
                  isActive || inPodcast ? 'text-cinema-400 bg-cinema-500/10' : 'text-gray-300 hover:text-cinema-400 hover:bg-white/[0.04]'
                }`
              }
            >
              Episodes
            </NavLink>

            <div className="border-t border-white/[0.06] my-4" />

            <NavLink to="/updates"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-colors ${
                  isActive ? 'text-gold-400 bg-gold-500/10' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Site Updates
            </NavLink>

            {isAuthenticated && (
              <Link to="/settings"
                className="flex items-center px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors">
                Settings
              </Link>
            )}

            <div className="border-t border-white/[0.06] my-4" />

            {isAuthenticated ? (
              <div className="px-4 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-kicker text-gray-500 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    displayName?.toLowerCase().includes('hermz') || displayName?.toLowerCase().includes('matt')
                      ? 'bg-gold-500' : 'bg-film-500'
                  }`} />
                  {displayName?.toUpperCase()}
                </span>
                <button onClick={handleSignOut}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  Sign out
                </button>
              </div>
            ) : (
              <div className="px-4">
                <Link to="/login" className="btn-gold text-xs w-full text-center block">Sign in</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
