import { useNavigate } from 'react-router-dom'
import type { Listing } from '../../lib/mockData'
import { formatDust } from '../../lib/mockData'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Shield, Database } from 'lucide-react'

interface ListingCardProps {
  listing: Listing
}

export function ListingCard({ listing }: ListingCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow duration-200" onClick={() => navigate(`/listing/${listing.id}`)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-amber-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground leading-tight">{listing.title}</span>
        </div>
        <Badge variant={listing.state}>{listing.state}</Badge>
      </div>

      <p className="text-xs text-foreground-light leading-relaxed line-clamp-2">{listing.description}</p>

      <div className="flex items-center gap-3 text-xs text-amber-muted">
        <span className="rounded-full bg-amber-primary/10 px-2.5 py-0.5 font-medium text-amber-primary">{listing.category}</span>
        <span>{listing.size}</span>
        <span>{listing.records} records</span>
      </div>

      <div className="pt-2 border-t border-amber-border/50">
        <p className="text-xs text-amber-muted mb-0.5">Price</p>
        <p className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
          {formatDust(listing.price)} <span className="text-xs font-normal text-amber-muted">DUST</span>
        </p>
      </div>

      <button className="w-full mt-auto pt-2 border-t border-amber-border/50 text-sm font-medium text-amber-primary hover:text-amber-hover transition-colors cursor-pointer">
        View Details
      </button>
    </Card>
  )
}
