import type { Listing } from '../../lib/mockData'
import { ListingCard } from './ListingCard'
import { Package } from 'lucide-react'
import { Button } from '../ui/Button'
import { useNavigate } from 'react-router-dom'

interface ListingGridProps {
  listings: Listing[]
}

export function ListingGrid({ listings }: ListingGridProps) {
  const navigate = useNavigate()

  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <Package size={48} className="mx-auto text-amber-border mb-4" />
        <p className="text-foreground-light mb-4">No listings found</p>
        <Button onClick={() => navigate('/list')}>List Your Data</Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {listings.map(listing => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
