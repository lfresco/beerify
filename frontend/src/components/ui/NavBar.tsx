import { Link, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Feed', icon: '🫗' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/profile', label: 'Me', icon: '👤' },
]

export function NavBar() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-700 z-50 safe-area-bottom">
      <div className="max-w-xl mx-auto flex">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors
              ${pathname === t.to ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
