import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-night-950">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-stone-200 dark:border-night-800 py-6 text-center text-xs text-gray-400 dark:text-gray-600">
        Hermz &amp; D — Est. 1995
      </footer>
    </div>
  )
}
