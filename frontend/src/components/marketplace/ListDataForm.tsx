import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Shield, CheckCircle, AlertTriangle, FileUp } from 'lucide-react'
import { useApp } from '../../context/app-context'
import { bytesToHex, encodeMeta, type ListingMeta } from '../../lib/hex'
import { createPackage, hashData } from '../../lib/package'
import { downloadText, parseVault, serializeVault, slugify, type VaultFile } from '../../lib/vault'
import { formatFileSize, nightToStar } from '../../lib/format'
import { waitFor } from '../../lib/wait'

interface ListDataFormProps {
  onSubmit?: (data: { name: string; description: string; price: string; category: string }) => void
}

const CATEGORIES = ['Finance', 'Healthcare', 'Marketing', 'Climate', 'Genomics', 'Other']

export function ListDataForm({ onSubmit }: ListDataFormProps) {
  const navigate = useNavigate()
  const { wallet, contract, marketplace, ensureContract, refresh } = useApp()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listed, setListed] = useState<string | null>(null)
  const navigateToListing = () => {
    if (listed) navigate(`/listing/${listed}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!wallet.connected || !wallet.addressHex) {
      setError('Connect your wallet before listing a dataset.')
      return
    }
    if (!file) {
      setError('Choose the dataset file to encrypt and list.')
      return
    }

    let priceStar: bigint
    try {
      priceStar = nightToStar(price)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid price')
      return
    }

    setLoading(true)
    try {
      await ensureContract()

      const bytes = new Uint8Array(await file.arrayBuffer())
      const dataHash = await hashData(bytes)
      const meta: ListingMeta = {
        title: name,
        description,
        category,
        size: formatFileSize(file.size),
        records: '',
      }
      const metaBytes = encodeMeta(meta)

      // The listing id is derived from an in-circuit random nonce, so snapshot
      // the ids we already know and pick up the one that appears after the tx.
      const known = new Set((await marketplace.fetchListings()).map(listing => listing.id))

      await contract.listData({
        dataHashHex: bytesToHex(dataHash),
        price: priceStar,
        meta,
        sellerAddrHex: wallet.addressHex,
      })

      const created = await waitFor(
        async () => {
          const all = await marketplace.fetchListings()
          return all.find(listing => !known.has(listing.id) && listing.sellerAddr === wallet.addressHex) ?? null
        },
        { tries: 16, delayMs: 3000 },
      )
      if (!created) {
        throw new Error(
          'Listing submitted, but it has not shown up on the indexer yet. Check the dashboard in a minute.',
        )
      }

      // The commitment salt is generated in-circuit during listData and stored
      // in this wallet's private state — package with that salt, not a fresh
      // random one, or the package will not verify against the chain.
      const salt = await contract.contractSalt(created.id)
      const { pkg, dataKey } = await createPackage({
        listingId: created.id,
        data: bytes,
        salt,
        meta: metaBytes,
      })
      const vault: VaultFile = {
        type: 'onyx:vault',
        version: 1,
        listingId: created.id,
        dataKey: bytesToHex(dataKey),
        package: pkg,
      }
      const roundTrip = parseVault(serializeVault(vault))
      if (roundTrip.listingId !== created.id) throw new Error('Vault verification failed after creation')
      downloadText(`${slugify(name)}.onyx-vault.json`, serializeVault(vault))

      await refresh()
      setListed(created.id)
      onSubmit?.({ name, description, price, category })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (listed) {
    return (
      <Card className="p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
          <CheckCircle size={20} className="text-success shrink-0" />
          <div>
            <p className="font-medium text-foreground">Listed on-chain</p>
            <p className="text-sm text-amber-muted">
              Keep the downloaded vault file: it holds the encryption key for delivery.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/browse')}>
            Browse Marketplace
          </Button>
          <Button
            onClick={() => {
              setListed(null)
              setName('')
              setDescription('')
              setPrice('')
              setCategory('')
              setFile(null)
            }}
          >
            List Another
          </Button>
          <Button variant="ghost" onClick={navigateToListing}>
            View Listing
          </Button>
        </div>
      </Card>
    )
  }

  if (!wallet.connected) {
    return (
      <Card className="p-6 max-w-xl mx-auto text-center">
        <Shield size={24} className="mx-auto text-amber-primary mb-3" />
        <p className="text-sm text-foreground-light mb-4">
          Listing writes to the Midnight contract, so a connected wallet is required.
        </p>
        <Button onClick={() => void wallet.connect()} loading={wallet.loading}>
          Connect Wallet
        </Button>
        {wallet.error && <p className="mt-3 text-sm text-danger">{wallet.error}</p>}
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 max-w-xl mx-auto">
        <div className="space-y-4">
          <Input
            label="Dataset Name"
            placeholder="e.g. Financial Market Data Q4"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />

          <div className="w-full">
            <label className="block text-sm font-medium text-foreground-light mb-1.5">Description</label>
            <textarea
              placeholder="Describe your dataset..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-cream-light border border-amber-border text-foreground placeholder-amber-muted/50 focus:outline-none focus:ring-2 focus:ring-amber-primary/30 focus:border-amber-primary transition-all duration-200 text-sm resize-none"
              required
            />
          </div>

          <Input
            label="Price (NIGHT)"
            type="number"
            step="0.000001"
            min="0.000001"
            placeholder="1500"
            value={price}
            onChange={e => setPrice(e.target.value)}
            required
          />

          <div className="w-full">
            <label className="block text-sm font-medium text-foreground-light mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-cream-light border border-amber-border text-foreground focus:outline-none focus:ring-2 focus:ring-amber-primary/30 focus:border-amber-primary transition-all duration-200 text-sm"
              required
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-foreground-light mb-1.5">Dataset file</label>
            <input
              type="file"
              onChange={event => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-foreground-light file:mr-3 file:rounded-lg file:border-0 file:bg-cream-dark file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-amber-border/40 cursor-pointer"
              required
            />
            <p className="mt-1 text-xs text-amber-muted">
              {file ? `${file.name} (${formatFileSize(file.size)})` : 'Encrypted locally; only a commitment hash goes on-chain'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 p-3 rounded-lg bg-cream-light border border-amber-border/50">
          <Shield size={16} className="text-amber-primary shrink-0" />
          <p className="text-xs text-amber-muted">
            <FileUp size={12} className="inline -mt-0.5 mr-1" />
            Data hash and encryption are computed in this browser
          </p>
        </div>

        <Button type="submit" loading={loading} className="w-full mt-5">
          {contract.contract ? 'List Dataset' : 'Connect and List Dataset'}
        </Button>
        {loading && (
          <p className="mt-3 text-xs text-amber-muted">
            Proving the transaction, then waiting for the indexer. This can take a minute.
          </p>
        )}
      </Card>
    </form>
  )
}
