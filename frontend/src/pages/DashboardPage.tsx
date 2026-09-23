import { Shield, ExternalLink, Package } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { MOCK_WALLET, MOCK_LISTINGS, formatBalance, formatDust } from '../lib/mockData'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const navigate = useNavigate()
  const myListings = MOCK_LISTINGS.filter(l => l.seller === MOCK_WALLET.address)
  const myPurchases = MOCK_LISTINGS.filter(l => l.buyer === MOCK_WALLET.address)

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
            <p className="text-xs text-amber-muted mb-1">tNIGHT Balance</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-amber-primary">
              {formatBalance(MOCK_WALLET.dustBalance)} <span className="text-sm font-normal text-amber-muted">DUST</span>
            </p>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm text-amber-muted shrink-0">Wallet Address</span>
              <span className="text-sm font-mono text-foreground-light truncate">{MOCK_WALLET.address}</span>
            </div>
            <ExternalLink size={14} className="text-amber-muted shrink-0" />
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
              {myListings.length === 0 ? (
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
                    <span className="text-xs font-mono text-foreground-light truncate min-w-0 flex-1">{listing.id}</span>
                    <span className="text-sm font-medium text-foreground shrink-0">{formatDust(listing.price)} DUST</span>
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
              {myPurchases.length === 0 ? (
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
                    <span className="text-xs font-mono text-foreground-light truncate min-w-0 flex-1">{listing.id}</span>
                    <span className="text-sm font-medium text-foreground shrink-0">{formatDust(listing.price)} DUST</span>
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
