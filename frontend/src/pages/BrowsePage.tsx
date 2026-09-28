import { useEffect, useMemo, useState } from 'react'
import type { ListingState } from '../types'
import { SearchBar } from '../components/marketplace/SearchBar'
import { ListingGrid } from '../components/marketplace/ListingGrid'
import { Spinner } from '../components/ui/Spinner'
import { useApp } from '../context/app-context'

const FILTERS: { label: string; value: ListingState | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Sold', value: 'sold' },
  { label: 'Disputed', value: 'disputed' },
  { label: 'Completed', value: 'completed' },
]

export function BrowsePage() {
  const { marketplace } = useApp()
  const { fetchListings, listings, loading, error } = marketplace
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ListingState | 'all'>('all')

  useEffect(() => {
    void fetchListings()
  }, [fetchListings])

  const filtered = useMemo(() => {
    let results = listings
    if (filter !== 'all') {
      results = results.filter(l => l.state === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(
        l =>
          l.id.toLowerCase().includes(q) ||
          l.seller.toLowerCase().includes(q) ||
          (l.title ?? '').toLowerCase().includes(q) ||
          (l.category ?? '').toLowerCase().includes(q),
      )
    }
    return results
  }, [listings, search, filter])

  return (
    <div className="min-h-screen bg-cream pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Browse Marketplace
          </h1>
          <p className="text-foreground-light text-sm sm:text-base">
            Discover encrypted datasets available on the marketplace
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <SearchBar value={search} onChange={setSearch} />
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer border ${
                  filter === f.value
                    ? 'bg-amber-primary text-white border-amber-primary'
                    : 'bg-transparent text-foreground-light border-amber-border hover:bg-cream-dark'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && listings.length === 0 ? (
          <div className="flex items-center justify-center gap-3 py-16 text-foreground-light">
            <Spinner size="sm" />
            <span className="text-sm">Loading listings from the Midnight indexer…</span>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <ListingGrid listings={filtered} />
          </>
        )}
      </div>
    </div>
  )
}
