import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FilmStill from '../components/FilmStill'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center px-4 py-12">
      {/* Cinematic backdrop */}
      <FilmStill
        title="Hermz and D Login"
        hue={34}
        mood="warm"
        className="absolute inset-0 w-full h-full"
      >
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(180deg, rgba(7,6,8,0.6) 0%, rgba(7,6,8,0.85) 60%, rgba(7,6,8,0.95) 100%)' }} />
      </FilmStill>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm
                      bg-night-900/85 backdrop-blur-md border border-white/[0.08]
                      rounded-2xl px-7 py-9 shadow-still-lg">

        {/* Logo */}
        <Link to="/" className="block text-center mb-7 group">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="font-display text-3xl tracking-wide text-gold-500 leading-none
                             group-hover:text-gold-400 transition-colors">HERMZ</span>
            <span className="font-serif italic text-lg text-gray-500 leading-none">&amp;</span>
            <span className="font-display text-3xl tracking-wide text-film-500 leading-none
                             group-hover:text-film-400 transition-colors">D</span>
          </div>
          <p className="kicker-dim">EST. 1993 · MEMBERS ONLY</p>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-kicker text-gray-400 uppercase mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input w-full"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-kicker text-gray-400 uppercase mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30
                          rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-gold w-full mt-3 disabled:opacity-50"
                  disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] tracking-kicker text-gray-600">
          ● THE LATE SHOW
        </p>
      </div>
    </div>
  )
}
