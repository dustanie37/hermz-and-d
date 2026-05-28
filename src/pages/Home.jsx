import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { displayName, isAuthenticated } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-10">

      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 text-5xl md:text-6xl font-display font-bold">
          <span className="text-gold-400">Hermz</span>
          <span className="text-gray-600">&</span>
          <span className="text-film-400">D</span>
        </div>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          A decade of Oscar battles and a lifetime of great movies.
        </p>
        {isAuthenticated && (
          <p className="text-gold-400 text-sm">
            Welcome back, {displayName}.
          </p>
        )}
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">

        <Link to="/oscars" className="card-hover group text-left">
          <div className="text-3xl mb-3">🏆</div>
          <h2 className="font-display text-xl font-bold text-gold-400 group-hover:text-gold-300 transition-colors mb-1">
            Oscar Picks
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            19 years of Academy Awards competition. Category-by-category results,
            tiebreaker history, and deep stats.
          </p>
          <div className="mt-4 text-xs text-gray-600 font-medium uppercase tracking-wider">
            2008 – 2026 →
          </div>
        </Link>

        <Link to="/movies" className="card-hover group text-left">
          <div className="text-3xl mb-3">🎬</div>
          <h2 className="font-display text-xl font-bold text-film-400 group-hover:text-film-300 transition-colors mb-1">
            Movie Rankings
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Four events, hundreds of films, nine scoring categories.
            See how favorites have risen, fallen, and endured.
          </p>
          <div className="mt-4 text-xs text-gray-600 font-medium uppercase tracking-wider">
            2001 · 2007 · 2016 · 2026 →
          </div>
        </Link>

      </div>
    </div>
  )
}
