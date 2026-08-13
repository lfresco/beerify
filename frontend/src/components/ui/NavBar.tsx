import { Link, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Feed', icon: '🫗' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/profile', label: 'Me', icon: '👤' },
]

export function NavBar() {
  const { pathname } = useLocation()

  return (
    <>
      {/* ── Mobile: fixed bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 safe-area-bottom"
           style={{ background: 'var(--nav-bg)', borderTop: '1px solid var(--nav-border)' }}>
        <div className="max-w-xl mx-auto flex">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors
                ${pathname === t.to ? 'text-white' : 'text-[#444] hover:text-[#888]'}`}
            >
              <span className="text-xl">{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* ── Desktop: top bar (rendered in App.tsx slot via sticky) ── */}
      <nav className="hidden md:flex fixed top-0 inset-x-0 z-50 items-stretch h-12"
           style={{ background: 'var(--nav-bg)', borderBottom: '1px solid var(--nav-border)' }}>
        <div className="max-w-[1280px] mx-auto flex items-stretch w-full">
          {/* Logo */}
          <div className="flex items-center px-5 font-black text-base tracking-[-0.04em] uppercase text-white"
               style={{ borderRight: '1px solid var(--nav-border)' }}>
            Beer<span className="font-light text-[#888]">Log</span>
          </div>

          {/* Nav links */}
          <div className="flex items-stretch ml-auto">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center px-5 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors
                  ${pathname === t.to
                    ? 'bg-white text-[#0a0a0a]'
                    : 'text-[#555] hover:text-white'}`}
                style={{ borderLeft: '1px solid var(--nav-border)' }}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}
