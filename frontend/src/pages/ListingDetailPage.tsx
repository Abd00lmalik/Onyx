import { useParams, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, Database, HardDrive, Users, Wallet } from 'lucide-react'
import type { Listing, ListingState } from '../types'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { BuyDialog } from '../components/marketplace/BuyDialog'
import { DeliveryPanel } from '../components/marketplace/DeliveryPanel'
import { useApp } from '../context/app-context'
import { addressDisplay, formatNight, shortAddress } from '../lib/format'
import { waitFor } from '../lib/wait'

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { wallet, contract, marketplace, ensureContract, refresh } = useApp()
  const { fetchListing } = marketplace

  const [loaded, setLoaded] = useState<{ id: string; listing: Listing | null } | null>(null)
  const [buyOpen, setBuyOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    const found = await fetchListing(id)
    setLoaded({ id, listing: found })
  }, [id, fetchListing])

  useEffect(() => {
    let alive = true
    if (!id) return
    void fetchListing(id).then(found => {
      if (alive) setLoaded({ id, listing: found })
    })
    return () => {
      alive = false
    }
  }, [id, fetchListing])

  const listing = loaded && loaded.id === id ? loaded.listing : null
  const status: 'loading' | 'ready' | 'missing' = !id
    ? 'missing'
    : loaded?.id !== id
      ? 'loading'
      : listing
        ? 'ready'
        : 'missing'

  const waitForState = async (expected: ListingState) => {
    if (!id) return
    const settled = await waitFor(
      async () => {
        const current = await fetchListing(id)
        if (current && current.state === expected) {
          setLoaded({ id, listing: current })
          return true
        }
        return false
      },
      { tries: 12, delayMs: 2500 },
    )
    if (!settled) {
      setActionNotice('Transaction submitted. This view updates once the indexer catches up.')
      await reload()
    }
  }

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setActionError(null)
    setActionNotice(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleBuy = async () => {
    setActionError(null)
    setActionNotice(null)
    if (!wallet.connected || !wallet.addressHex) throw new Error('Connect your wallet first')
    if (!listing) throw new Error('Listing not loaded')
    await ensureContract()
    await contract.buyListing(listing.id, wallet.addressHex)
    await waitForState('sold')
    await refresh()
  }

  const handleConfirm = () =>
    runAction('confirm', async () => {
      if (!listing) throw new Error('Listing not loaded')
      await ensureContract()
      await contract.confirmDelivery(listing.id)
      await waitForState('completed')
      await refresh()
    })

  const handleDispute = () =>
    runAction('dispute', async () => {
      if (!listing) throw new Error('Listing not loaded')
      await ensureContract()
      await contract.disputeListing(listing.id)
      await waitForState('disputed')
      await refresh()
    })

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-cream pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <Spinner size="md" />
          <p className="mt-4 text-sm text-foreground-light">Loading listing…</p>
        </div>
      </div>
    )
  }

  if (status === 'missing' || !listing) {
    return (
      <div className="min-h-screen bg-cream pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <p className="text-foreground-light mb-2">Listing not found</p>
          {marketplace.error && <p className="text-sm text-danger mb-4">{marketplace.error}</p>}
          <Button variant="secondary" onClick={() => navigate('/browse')}>
            Back to Browse
          </Button>
        </div>
      </div>
    )
  }

  const isBuyer = !!wallet.addressHex && listing.buyerAddr === wallet.addressHex
  const isSeller = !!wallet.addressHex && listing.sellerAddr === wallet.addressHex

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
              {listing.title || 'Untitled dataset'}
            </h1>
            <p className="text-xs font-mono text-amber-muted">{listing.id}</p>
          </div>
          <Badge variant={listing.state}>{listing.state.toUpperCase()}</Badge>
        </div>

        <Card className="p-6 mb-6">
          <p className="text-sm text-foreground-light leading-relaxed mb-5">
            {listing.description || 'No description provided.'}
          </p>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="rounded-xl border border-amber-border/50 bg-cream-light p-3 text-center">
              <Database size={18} className="mx-auto text-amber-primary mb-1.5" />
              <p className="text-xs text-amber-muted mb-0.5">Category</p>
              <p className="text-sm font-medium text-foreground">{listing.category || 'Other'}</p>
            </div>
            <div className="rounded-xl border border-amber-border/50 bg-cream-light p-3 text-center">
              <HardDrive size={18} className="mx-auto text-amber-primary mb-1.5" />
              <p className="text-xs text-amber-muted mb-0.5">Size</p>
              <p className="text-sm font-medium text-foreground">{listing.size || 'Unknown'}</p>
            </div>
            <div className="rounded-xl border border-amber-border/50 bg-cream-light p-3 text-center">
              <Users size={18} className="mx-auto text-amber-primary mb-1.5" />
              <p className="text-xs text-amber-muted mb-0.5">Records</p>
              <p className="text-sm font-medium text-foreground">{listing.records || 'n/a'}</p>
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
                {formatNight(listing.price)} <span className="text-xs font-normal text-amber-muted">NIGHT</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-amber-border/50">
              <span className="text-sm text-amber-muted">Seller</span>
              <span className="text-xs font-mono text-foreground-light truncate max-w-[260px]" title={addressDisplay(listing.sellerAddr ?? '')}>
                {isSeller ? shortAddress(wallet.address ?? '') : addressDisplay(listing.sellerAddr ?? '') || 'unknown'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-amber-border/50">
              <span className="text-sm text-amber-muted">Data Commitment</span>
              <span className="text-xs font-mono text-foreground-light truncate max-w-[220px]">{listing.dataCommitment}</span>
            </div>

            {listing.buyerAddr && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-amber-muted">Buyer</span>
                <span className="text-xs font-mono text-foreground-light truncate max-w-[260px]" title={addressDisplay(listing.buyerAddr)}>
                  {isBuyer ? shortAddress(wallet.address ?? '') : addressDisplay(listing.buyerAddr)}
                </span>
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

        {actionError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}
        {actionNotice && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-primary/10 border border-amber-border px-3 py-2 text-sm text-foreground-light">
            <Shield size={15} className="shrink-0 mt-0.5 text-amber-primary" />
            <span>{actionNotice}</span>
          </div>
        )}

        {listing.state === 'active' && (
          <>
            {wallet.connected ? (
              <Button className="w-full" onClick={() => setBuyOpen(true)} disabled={busy !== null}>
                Buy This Dataset
              </Button>
            ) : (
              <Card className="p-5 text-center">
                <Wallet size={20} className="mx-auto text-amber-primary mb-2" />
                <p className="text-sm text-foreground-light mb-3">
                  Connect a Midnight wallet to buy this dataset.
                </p>
                <Button onClick={() => void wallet.connect()} loading={wallet.loading}>
                  Connect Wallet
                </Button>
                {wallet.error && <p className="mt-2 text-xs text-danger">{wallet.error}</p>}
              </Card>
            )}
          </>
        )}

        {listing.state === 'sold' && isBuyer && (
          <>
            <DeliveryPanel listing={listing} role="buyer" />
            <div className="flex gap-3">
              <Button className="flex-1" loading={busy === 'confirm'} disabled={busy !== null} onClick={() => void handleConfirm()}>
                Confirm Delivery
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                loading={busy === 'dispute'}
                disabled={busy !== null}
                onClick={() => void handleDispute()}
              >
                File Dispute
              </Button>
            </div>
          </>
        )}

        {listing.state === 'sold' && isSeller && <DeliveryPanel listing={listing} role="seller" />}

        {listing.state === 'sold' && !isBuyer && !isSeller && (
          <Card className="p-4">
            <p className="text-sm text-foreground-light">
              This dataset has been sold. Delivery is handled directly between the two parties.
            </p>
          </Card>
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
          <>
            <Card className="p-4 border-success/30 bg-success/5 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle size={18} className="text-success shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Transaction completed</p>
                  <p className="text-xs text-amber-muted">This sale has been finalized</p>
                </div>
              </div>
            </Card>
            {isBuyer && <DeliveryPanel listing={listing} role="buyer" />}
          </>
        )}

        <BuyDialog listing={listing} open={buyOpen} onClose={() => setBuyOpen(false)} onConfirm={handleBuy} />
      </div>
    </div>
  )
}
