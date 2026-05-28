import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-night-950">
      <Navbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <footer className="border-t border-night-700/60 py-6 text-center
                         font-mono text-[10px] tracking-kicker text-gray-600">
        EST. 1993 · HERMZ &amp; D
      </footer>
    </div>
  )
}
