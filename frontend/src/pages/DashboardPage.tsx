import { useEffect } from 'react'
import { Shield, Package, Wallet } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { useApp } from '../context/app-context'
import { formatNight, formatRaw, shortAddress } from '../lib/format'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const navigate = useNavigate()
  const { wallet, marketplace, refresh } = useApp()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const address = wallet.addressHex ?? ''
  const myListings = marketplace.listings.filter(l => l.sellerAddr && l.sellerAddr === address)
  const myPurchases = marketplace.listings.filter(l => l.buyerAddr && l.buyerAddr === address)

  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-cream pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-foreground-light text-sm sm:text-base">
              Manage your listings and purchases
            </p>
          </div>
          <Card className="p-8 text-center">
            <Wallet size={28} className="mx-auto text-amber-primary mb-3" />
            <p className="text-sm text-foreground-light mb-4">
              Connect a Midnight wallet to see your listings, purchases and balances.
            </p>
            <Button onClick={() => void wallet.connect()} loading={wallet.loading}>
              Connect Wallet
            </Button>
            {wallet.error && <p className="mt-3 text-sm text-danger">{wallet.error}</p>}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Dashboard
          </h1>
          <p className="text-foreground-light text-sm sm:text-base">
            Manage your listings and purchases
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="p-5">
            <p className="text-xs text-amber-muted mb-1">NIGHT Balance</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-amber-primary">
              {formatNight(wallet.balance)} <span className="text-sm font-normal text-amber-muted">NIGHT</span>
            </p>
            <p className="mt-1 text-xs text-amber-muted">{formatRaw(wallet.dustBalance)} DUST available for fees</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-amber-muted mb-1">My Listings</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">{myListings.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-amber-muted mb-1">My Purchases</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">{myPurchases.length}</p>
          </Card>
        </div>

        <Card className="p-4 mb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm text-amber-muted shrink-0">Wallet Address</span>
              <span className="text-sm font-mono text-foreground-light truncate" title={wallet.address ?? ''}>
                {wallet.address}
              </span>
            </div>
            <span className="text-xs font-mono text-amber-muted shrink-0">{shortAddress(wallet.address ?? '', 8, 4)}</span>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">My Listings</h2>
              <button onClick={() => navigate('/browse')} className="text-sm text-amber-primary hover:text-amber-hover transition-colors cursor-pointer">
                View all →
              </button>
            </div>
            <div className="space-y-3">
              {marketplace.loading && marketplace.listings.length === 0 ? (
                <Card className="p-4 text-center">
                  <Spinner size="sm" />
                </Card>
              ) : myListings.length === 0 ? (
                <Card className="p-4 text-center">
                  <p className="text-sm text-amber-muted">No listings yet</p>
                </Card>
              ) : (
                myListings.map(listing => (
                  <Card
                    key={listing.id}
                    className="p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/listing/${listing.id}`)}
                  >
                    <Shield size={16} className="text-amber-primary shrink-0" />
                    <span className="text-xs font-mono text-foreground-light truncate min-w-0 flex-1">{listing.title || listing.id}</span>
                    <span className="text-sm font-medium text-foreground shrink-0">{formatNight(listing.price)} NIGHT</span>
                    <Badge variant={listing.state}>{listing.state}</Badge>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">My Purchases</h2>
              <button onClick={() => navigate('/browse')} className="text-sm text-amber-primary hover:text-amber-hover transition-colors cursor-pointer">
                View all →
              </button>
            </div>
            <div className="space-y-3">
              {marketplace.loading && marketplace.listings.length === 0 ? (
                <Card className="p-4 text-center">
                  <Spinner size="sm" />
                </Card>
              ) : myPurchases.length === 0 ? (
                <Card className="p-4 text-center">
                  <p className="text-sm text-amber-muted">No purchases yet</p>
                </Card>
              ) : (
                myPurchases.map(listing => (
                  <Card
                    key={listing.id}
                    className="p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/listing/${listing.id}`)}
                  >
                    <Package size={16} className="text-amber-primary shrink-0" />
                    <span className="text-xs font-mono text-foreground-light truncate min-w-0 flex-1">{listing.title || listing.id}</span>
                    <span className="text-sm font-medium text-foreground shrink-0">{formatNight(listing.price)} NIGHT</span>
                    <Badge variant={listing.state}>{listing.state}</Badge>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
