import { type ButtonHTMLAttributes, type ReactNode } from 'react'

interface CardProps extends ButtonHTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`bg-cream-dark border border-amber-border rounded-xl ${className}`} {...props}>
      {children}
    </div>
  )
}
