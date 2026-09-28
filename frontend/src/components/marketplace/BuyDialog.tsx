import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { Listing } from '../../types'
import { formatNight } from '../../lib/format'
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface BuyDialogProps {
  listing: Listing | null
  open: boolean
  onClose: () => void
  /** Runs the real `buyListing` transaction, including confirmation polling. */
  onConfirm: () => Promise<void>
}

export function BuyDialog({ listing, open, onClose, onConfirm }: BuyDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!listing) return null

  const handleBuy = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Purchase Dataset">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-amber-muted">Listing</span>
          <span className="text-sm font-mono text-foreground">{listing.title || listing.id.slice(0, 16)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-amber-muted">Status</span>
          <Badge variant={listing.state}>{listing.state}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-amber-muted">Price</span>
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
            {formatNight(listing.price)} <span className="text-xs font-normal text-amber-muted">NIGHT</span>
          </span>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-cream-light border border-amber-border/50">
          <Shield size={16} className="text-amber-primary shrink-0" />
          <p className="text-xs text-amber-muted">
            Payment is locked in the contract escrow until you confirm delivery
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => void handleBuy()} loading={loading} className="flex-1">
            <CheckCircle size={15} />
            Buy Now
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
