import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { Listing } from '../../lib/mockData'
import { formatDust } from '../../lib/mockData'
import { Shield, CheckCircle } from 'lucide-react'
import { useState } from 'react'

interface BuyDialogProps {
  listing: Listing | null
  open: boolean
  onClose: () => void
}

export function BuyDialog({ listing, open, onClose }: BuyDialogProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!listing) return null

  const handleBuy = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLoading(false)
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onClose()
    }, 2000)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Purchase Dataset">
      {success ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
          <CheckCircle size={20} className="text-success shrink-0" />
          <div>
            <p className="font-medium text-foreground">Purchase Complete</p>
            <p className="text-sm text-amber-muted">Dataset encrypted and delivered</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-muted">Listing</span>
            <span className="text-sm font-mono text-foreground">{listing.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-muted">Status</span>
            <Badge variant={listing.state}>{listing.state}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-muted">Price</span>
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
              {formatDust(listing.price)} <span className="text-xs font-normal text-amber-muted">DUST</span>
            </span>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-cream-light border border-amber-border/50">
            <Shield size={16} className="text-amber-primary shrink-0" />
            <p className="text-xs text-amber-muted">
              Proved without revealing your identity
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleBuy} loading={loading} className="flex-1">Buy Now</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
