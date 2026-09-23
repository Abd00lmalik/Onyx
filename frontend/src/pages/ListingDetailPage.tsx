import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, Database, HardDrive, Users } from 'lucide-react'
import { getListingById, formatDust } from '../lib/mockData'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { BuyDialog } from '../components/marketplace/BuyDialog'

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [buyOpen, setBuyOpen] = useState(false)

  const listing = id ? getListingById(id) : undefined

  if (!listing) {
    return (
      <div className="min-h-screen bg-cream pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <p className="text-foreground-light mb-4">Listing not found</p>
          <Button variant="secondary" onClick={() => navigate('/browse')}>Back to Browse</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/browse')}
          className="flex items-center gap-2 text-sm text-amber-muted hover:text-foreground transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to Browse
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {listing.title}
            </h1>
            <p className="text-xs font-mono text-amber-muted">{listing.id}</p>
          </div>
          <Badge variant={listing.state}>{listing.state.toUpperCase()}</Badge>
        </div>

        <Card className="p-6 mb-6">
          <p className="text-sm text-foreground-light leading-relaxed mb-5">{listing.description}</p>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="rounded-xl border border-amber-border/50 bg-cream-light p-3 text-center">
              <Database size={18} className="mx-auto text-amber-primary mb-1.5" />
              <p className="text-xs text-amber-muted mb-0.5">Category</p>
              <p className="text-sm font-medium text-foreground">{listing.category}</p>
            </div>
            <div className="rounded-xl border border-amber-border/50 bg-cream-light p-3 text-center">
              <HardDrive size={18} className="mx-auto text-amber-primary mb-1.5" />
              <p className="text-xs text-amber-muted mb-0.5">Size</p>
              <p className="text-sm font-medium text-foreground">{listing.size}</p>
            </div>
            <div className="rounded-xl border border-amber-border/50 bg-cream-light p-3 text-center">
              <Users size={18} className="mx-auto text-amber-primary mb-1.5" />
              <p className="text-xs text-amber-muted mb-0.5">Records</p>
              <p className="text-sm font-medium text-foreground">{listing.records}</p>
            </div>
          </div>

          <div className="space-y-0">
            <div className="flex items-center justify-between py-2.5 border-b border-amber-border/50">
              <span className="text-sm text-amber-muted">Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-sm font-medium text-foreground uppercase">{listing.state}</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-amber-border/50">
              <span className="text-sm text-amber-muted">Price</span>
              <span className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                {formatDust(listing.price)} <span className="text-xs font-normal text-amber-muted">DUST</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-amber-border/50">
              <span className="text-sm text-amber-muted">Seller</span>
              <span className="text-xs font-mono text-foreground-light truncate max-w-[220px]">{listing.seller}</span>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-amber-border/50">
              <span className="text-sm text-amber-muted">Data Commitment</span>
              <span className="text-xs font-mono text-foreground-light truncate max-w-[220px]">{listing.dataCommitment}</span>
            </div>

            {listing.buyer && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-amber-muted">Buyer</span>
                <span className="text-xs font-mono text-foreground-light truncate max-w-[220px]">{listing.buyer}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 mb-6">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-amber-primary shrink-0" />
            <p className="text-xs text-amber-muted">
              Only a commitment hash is stored on-chain. The actual data is never revealed.
            </p>
          </div>
        </Card>

        {listing.state === 'active' && (
          <Button className="w-full" onClick={() => setBuyOpen(true)}>
            Buy This Dataset
          </Button>
        )}

        {listing.state === 'sold' && (
          <div className="flex gap-3">
            <Button className="flex-1">Confirm Delivery</Button>
            <Button variant="destructive" className="flex-1">File Dispute</Button>
          </div>
        )}

        {listing.state === 'disputed' && (
          <Card className="p-4 border-danger/30 bg-danger/5">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-danger shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">This listing is under dispute</p>
                <p className="text-xs text-amber-muted">The admin will review and resolve</p>
              </div>
            </div>
          </Card>
        )}

        {listing.state === 'completed' && (
          <Card className="p-4 border-success/30 bg-success/5">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-success shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">Transaction completed</p>
                <p className="text-xs text-amber-muted">This sale has been finalized</p>
              </div>
            </div>
          </Card>
        )}

        <BuyDialog listing={listing} open={buyOpen} onClose={() => setBuyOpen(false)} />
      </div>
    </div>
  )
}
