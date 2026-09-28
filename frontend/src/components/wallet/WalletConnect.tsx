import { Wallet, LogOut } from 'lucide-react'
import { useApp } from '../../context/app-context'
import { formatNight, formatRaw, shortAddress } from '../../lib/format'

export function WalletConnect() {
  const { wallet } = useApp()

  const handleConnect = () => {
    void wallet.connect()
  }

  if (wallet.connected) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cream-light border border-amber-border"
          title={wallet.address ?? ''}
        >
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs font-mono text-foreground-light">
            {shortAddress(wallet.address ?? '')}
          </span>
          <span className="text-xs text-amber-muted">{formatNight(wallet.balance)} NIGHT</span>
          <span className="text-xs text-amber-muted">{formatRaw(wallet.dustBalance)} DUST</span>
        </div>
        <button
          onClick={wallet.disconnect}
          className="p-2 rounded-lg hover:bg-cream-dark transition-colors cursor-pointer text-amber-muted hover:text-foreground"
          title="Disconnect"
        >
          <LogOut size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {wallet.error && (
        <span className="hidden md:inline max-w-[220px] truncate text-xs text-danger" title={wallet.error}>
          {wallet.error}
        </span>
      )}
      <button
        onClick={handleConnect}
        disabled={wallet.loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-primary text-white text-sm font-medium hover:bg-amber-hover transition-colors duration-200 cursor-pointer disabled:opacity-50"
      >
        <Wallet size={16} />
        {wallet.loading ? 'Connecting...' : 'Connect Wallet'}
      </button>
    </div>
  )
}
