import { useState } from 'react'
import { Wallet, LogOut } from 'lucide-react'
import { MOCK_WALLET, formatBalance } from '../../lib/mockData'

export function WalletConnect() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    setConnected(true)
    setLoading(false)
  }

  const handleDisconnect = () => {
    setConnected(false)
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cream-light border border-amber-border">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs font-mono text-foreground-light">
            {MOCK_WALLET.address.slice(0, 6)}...{MOCK_WALLET.address.slice(-4)}
          </span>
          <span className="text-xs text-amber-muted">
            {formatBalance(MOCK_WALLET.dustBalance)} DUST
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="p-2 rounded-lg hover:bg-cream-dark transition-colors cursor-pointer text-amber-muted hover:text-foreground"
          title="Disconnect"
        >
          <LogOut size={18} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-primary text-white text-sm font-medium hover:bg-amber-hover transition-colors duration-200 cursor-pointer disabled:opacity-50"
    >
      <Wallet size={16} />
      {loading ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
