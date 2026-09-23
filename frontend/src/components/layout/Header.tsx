import { NavLink, Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { WalletConnect } from '../wallet/WalletConnect'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/browse', label: 'Browse' },
  { to: '/list', label: 'List Data' },
  { to: '/dashboard', label: 'Dashboard' },
]

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-cream/85 backdrop-blur-lg border-b border-amber-border/60 shadow-[0_1px_3px_0_rgba(217,119,6,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <Shield size={26} className="text-amber-primary" strokeWidth={1.5} />
          <span className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Onyx</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'text-amber-primary bg-amber-primary/10'
                    : 'text-foreground-light hover:text-foreground hover:bg-cream-dark'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <WalletConnect />
      </div>
    </header>
  )
}
