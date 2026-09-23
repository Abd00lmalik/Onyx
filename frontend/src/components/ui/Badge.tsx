interface BadgeProps {
  variant: 'active' | 'sold' | 'disputed' | 'completed'
  children: React.ReactNode
}

const variantStyles = {
  active: 'bg-success/10 text-success border-success/30',
  sold: 'bg-amber-primary/10 text-amber-primary border-amber-border',
  disputed: 'bg-danger/10 text-danger border-danger/30',
  completed: 'bg-gray-badge/10 text-gray-badge border-gray-badge/30',
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]}`}>
      {children}
    </span>
  )
}
