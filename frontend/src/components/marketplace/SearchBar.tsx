import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex-1">
      <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-muted/60" />
      <input
        type="text"
        placeholder="Search by title, category, or seller..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-cream-light border border-amber-border text-foreground placeholder-amber-muted/50 focus:outline-none focus:ring-2 focus:ring-amber-primary/30 focus:border-amber-primary transition-all duration-200 text-sm"
      />
    </div>
  )
}
